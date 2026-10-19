import { createClient, type AuthError, type SupabaseClient, type User } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { applySyncedState, getState, onLocalChange } from './store';
import { mergeStates, syncDirection } from './syncMerge';
import type { AppState } from './types';

// Accounts are optional: without these settings the app works on this device only.
const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

const supabase: SupabaseClient | undefined = cloudConfigured ? createClient(SUPABASE_URL!, SUPABASE_KEY!) : undefined;

const TABLE = 'user_data';
const PUSH_DELAY_MS = 1500;
// Remembers which account this device's data was last merged into.
const MERGED_USER_KEY = 'forkful-merged-user';

export interface AccountState {
  user?: { id: string; email?: string };
  syncing: boolean;
  lastSyncedAt?: number;
  syncError: boolean;
}

let account: AccountState = { syncing: false, syncError: false };
const listeners = new Set<() => void>();

function setAccount(patch: Partial<AccountState>) {
  account = { ...account, ...patch };
  listeners.forEach((l) => l());
}

export function useAccount(): AccountState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => account,
  );
}

function readMergedUser(): string | null {
  try {
    return localStorage.getItem(MERGED_USER_KEY);
  } catch {
    return null;
  }
}

function writeMergedUser(id: string) {
  try {
    localStorage.setItem(MERGED_USER_KEY, id);
  } catch {
    // Worst case the next sign-in merges again, which loses nothing.
  }
}

async function fetchRemote(userId: string): Promise<AppState | undefined> {
  const { data, error } = await supabase!.from(TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.data as AppState | undefined) ?? undefined;
}

async function push(userId: string, state: AppState) {
  // The UI language is a per-device setting.
  const { language: _language, ...data } = state;
  const { error } = await supabase!.from(TABLE).upsert({ user_id: userId, data, updated_at: new Date().toISOString() });
  if (error) throw error;
}

let syncQueue: Promise<void> = Promise.resolve();

/** Brings this device and the account in line. Runs one at a time. */
function sync(): Promise<void> {
  syncQueue = syncQueue.then(async () => {
    const user = account.user;
    if (!supabase || !user) return;
    setAccount({ syncing: true });
    try {
      const remote = await fetchRemote(user.id);
      const local = getState();
      if (readMergedUser() !== user.id) {
        const merged = remote ? mergeStates(local, remote) : local;
        if (remote) applySyncedState(merged);
        await push(user.id, merged);
        writeMergedUser(user.id);
      } else {
        const direction = syncDirection(local, remote);
        if (direction === 'pull') applySyncedState(remote!);
        if (direction === 'push') await push(user.id, local);
      }
      setAccount({ syncing: false, syncError: false, lastSyncedAt: Date.now() });
    } catch (err) {
      console.warn('Sinhronizacija ni uspela', err);
      setAccount({ syncing: false, syncError: true });
    }
  });
  return syncQueue;
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;

function setUser(user: User | null | undefined) {
  const next = user ? { id: user.id, email: user.email } : undefined;
  if (next?.id === account.user?.id) return;
  setAccount({ user: next, lastSyncedAt: undefined, syncError: false });
  if (next) sync();
}

/** Starts listening for sign-in changes and local edits. Call once at startup. */
export function setupCloud(): void {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user));
  supabase.auth.getSession().then(({ data }) => setUser(data.session?.user));
  onLocalChange(() => {
    if (!account.user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(sync, PUSH_DELAY_MS);
  });
  // Pick up changes made on another device when the app comes back to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && account.user) sync();
  });
}

export type AuthResult = { ok: true; needsConfirmation?: boolean } | { ok: false; code: AuthErrorCode };
export type AuthErrorCode = 'invalid_credentials' | 'email_not_confirmed' | 'user_already_exists' | 'weak_password' | 'generic';

function errorCode(error: AuthError): AuthErrorCode {
  const known: AuthErrorCode[] = ['invalid_credentials', 'email_not_confirmed', 'user_already_exists', 'weak_password'];
  return known.find((c) => c === error.code) ?? 'generic';
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) return { ok: false, code: errorCode(error) };
  // With email confirmation on (Supabase's default) there is no session until the link is clicked.
  return { ok: true, needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase!.auth.signInWithPassword({ email, password });
  return error ? { ok: false, code: errorCode(error) } : { ok: true };
}

export async function signOut(): Promise<void> {
  clearTimeout(pushTimer);
  await syncQueue;
  await supabase!.auth.signOut();
}

/** Deletes the account and its cloud copy. Recipes on this device are kept. */
export async function deleteAccount(): Promise<boolean> {
  const { error } = await supabase!.rpc('delete_user');
  if (error) {
    console.warn('Brisanje računa ni uspelo', error);
    return false;
  }
  await supabase!.auth.signOut();
  return true;
}
