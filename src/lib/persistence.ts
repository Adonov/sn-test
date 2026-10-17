import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { isNative } from './platform';

const STORAGE_KEY = 'forkful-state';
const FILE = 'forkful-state.json';

// In the apps the state lives in a file, because iOS may evict WebView localStorage.
// Writes are chained so an older snapshot can never overwrite a newer one.
let writeQueue: Promise<unknown> = Promise.resolve();

export async function loadSaved(): Promise<string | null> {
  if (isNative) {
    try {
      const { data } = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      if (typeof data === 'string') return data;
    } catch {
      // No file yet on first launch.
    }
  }
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Returns false when the browser storage quota is exceeded. */
export function save(json: string): boolean {
  if (isNative) {
    writeQueue = writeQueue
      .then(() => Filesystem.writeFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8, data: json }))
      .catch((err) => console.warn('Shranjevanje ni uspelo', err));
    return true;
  }
  try {
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (err) {
    console.warn('Shranjevanje ni uspelo', err);
    return false;
  }
}
