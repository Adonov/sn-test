import { Capacitor } from '@capacitor/core';
import type { PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { ApiError } from './api';
import { startOfWeek, toISODate } from './dates';
import { isNative } from './platform';
import { getState, recordAiUse, setPremium, useAppState } from './store';
import type { AppState } from './types';

/** AI estimates (photo, description, recipe nutrients) included without Premium, per week. */
export const FREE_AI_PER_WEEK = 5;
/** The entitlement set up in RevenueCat that unlocks Premium. */
export const ENTITLEMENT = 'premium';

const API_KEY: string | undefined =
  Capacitor.getPlatform() === 'ios'
    ? import.meta.env.VITE_REVENUECAT_IOS_KEY
    : Capacitor.getPlatform() === 'android'
    ? import.meta.env.VITE_REVENUECAT_ANDROID_KEY
    : undefined;

/** Subscriptions are sold in the apps once RevenueCat is set up; until then AI has no limit. */
export const premiumAvailable = isNative && !!API_KEY;

export function aiWeek(now: Date): string {
  return toISODate(startOfWeek(now));
}

/** Free AI estimates left this week; Infinity with Premium or when subscriptions aren't sold. */
export function aiLeft(s: Pick<AppState, 'device'>, now: Date, available = premiumAvailable): number {
  if (!available || s.device?.premium) return Infinity;
  const usage = s.device?.aiUsage;
  return Math.max(0, FREE_AI_PER_WEEK - (usage?.week === aiWeek(now) ? usage.used : 0));
}

/** Runs an AI request if one is left, and counts it once it succeeds. */
export async function withAiQuota<T>(run: () => Promise<T>): Promise<T> {
  const now = new Date();
  if (aiLeft(getState(), now) <= 0) throw new ApiError('premium_required', 402);
  const result = await run();
  if (premiumAvailable && !getState().device?.premium) recordAiUse(aiWeek(now));
  return result;
}

export function usePremium(): { premium: boolean; left: number } {
  const s = useAppState();
  return { premium: !!s.device?.premium, left: aiLeft(s, new Date()) };
}

// ---- RevenueCat ----

async function purchases() {
  const { Purchases } = await import('@revenuecat/purchases-capacitor');
  return Purchases;
}

type Info = { entitlements: { active: Record<string, unknown> } };
const apply = (info: Info) => setPremium(ENTITLEMENT in info.entitlements.active);

let ready: Promise<void> | undefined;

/** Connects to RevenueCat and keeps the Premium status current. */
export function setupPremium(): Promise<void> {
  if (!premiumAvailable) return Promise.resolve();
  ready ??= (async () => {
    const p = await purchases();
    await p.configure({ apiKey: API_KEY! });
    await p.addCustomerInfoUpdateListener(apply);
    apply((await p.getCustomerInfo()).customerInfo);
  })().catch((err) => {
    ready = undefined;
    console.warn('RevenueCat setup failed', err);
  });
  return ready;
}

export interface Plan {
  id: string;
  period: 'monthly' | 'annual' | 'other';
  price: string;
  pkg: PurchasesPackage;
}

export async function loadPlans(): Promise<Plan[]> {
  await setupPremium();
  const offering = (await (await purchases()).getOfferings()).current;
  return (offering?.availablePackages ?? []).map((pkg) => ({
    id: pkg.identifier,
    period: String(pkg.packageType) === 'MONTHLY' ? 'monthly' : String(pkg.packageType) === 'ANNUAL' ? 'annual' : 'other',
    price: pkg.product.priceString,
    pkg,
  }));
}

/** Resolves false when the buyer cancelled. */
export async function buy(plan: Plan): Promise<boolean> {
  try {
    apply((await (await purchases()).purchasePackage({ aPackage: plan.pkg })).customerInfo);
    return true;
  } catch (err) {
    if ((err as { userCancelled?: boolean }).userCancelled) return false;
    throw err;
  }
}

/** Resolves whether Premium is active afterwards. */
export async function restore(): Promise<boolean> {
  await setupPremium();
  const { customerInfo } = await (await purchases()).restorePurchases();
  apply(customerInfo);
  return ENTITLEMENT in customerInfo.entitlements.active;
}
