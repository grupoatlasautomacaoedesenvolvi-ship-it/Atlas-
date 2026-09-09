import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function isFirestoreQuotaExceeded(): boolean {
  return localStorage.getItem('atlas_firestore_quota_exceeded') === 'true';
}

export function handleFirestoreWriteError(error: unknown): boolean {
  const errStr = String((error as any)?.message || error);
  if (errStr.includes('resource-exhausted') || errStr.includes('Quota exceeded') || errStr.includes('quota') || errStr.includes('PERMISSION_DENIED')) {
    localStorage.setItem('atlas_firestore_quota_exceeded', 'true');
    console.warn('Firestore quota exceeded or restricted. Operating in local offline mode.');
    return true;
  }
  return false;
}

export async function safeWrite<T>(writeFn: () => Promise<T>): Promise<T | null> {
  if (isFirestoreQuotaExceeded()) {
    return null;
  }
  try {
    return await writeFn();
  } catch (error) {
    if (handleFirestoreWriteError(error)) {
      return null;
    }
    throw error;
  }
}


