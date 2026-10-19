import { readHealthData } from './health';
import { applyHealthData, getState } from './store';

let running: Promise<void> | undefined;

/** Reads new steps, workouts and scale weights, if Apple Health / Health Connect is connected. */
export function syncHealth(): Promise<void> {
  if (!getState().device?.health?.enabled) return Promise.resolve();
  running ??= readHealthData()
    .then(applyHealthData)
    .catch((err) => console.warn('Health sync failed', err))
    .finally(() => (running = undefined));
  return running;
}
