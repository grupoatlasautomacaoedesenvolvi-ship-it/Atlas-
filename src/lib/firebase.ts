import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const QUOTA_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutos

export function clearFirestoreQuotaExceeded(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('atlas_firestore_quota_exceeded');
    localStorage.removeItem('atlas_firestore_quota_timestamp');
  }
}

export function isFirestoreQuotaExceeded(): boolean {
  if (typeof localStorage === 'undefined') return false;
  const isExceeded = localStorage.getItem('atlas_firestore_quota_exceeded') === 'true';
  if (!isExceeded) return false;

  const timestamp = Number(localStorage.getItem('atlas_firestore_quota_timestamp') || '0');
  if (timestamp && Date.now() - timestamp > QUOTA_EXPIRATION_MS) {
    clearFirestoreQuotaExceeded();
    return false;
  }
  return true;
}

export function handleFirestoreWriteError(error: unknown): boolean {
  const errStr = String((error as any)?.message || (error as any)?.code || error).toLowerCase();
  
  // Apenas erros de cota / resource-exhausted entram no modo offline
  const isQuotaError = errStr.includes('resource-exhausted') || 
                       errStr.includes('quota exceeded') || 
                       errStr.includes('quota-exceeded');

  if (isQuotaError) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('atlas_firestore_quota_exceeded', 'true');
      localStorage.setItem('atlas_firestore_quota_timestamp', String(Date.now()));
    }
    console.warn('Firestore quota exceeded. Operating in local offline mode.');
    return true;
  }
  return false;
}

export async function safeWrite<T>(writeFn: () => Promise<T>): Promise<T | null> {
  if (isFirestoreQuotaExceeded()) {
    return null;
  }
  try {
    const result = await writeFn();
    clearFirestoreQuotaExceeded();
    return result;
  } catch (error) {
    if (handleFirestoreWriteError(error)) {
      return null;
    }
    throw error;
  }
}


