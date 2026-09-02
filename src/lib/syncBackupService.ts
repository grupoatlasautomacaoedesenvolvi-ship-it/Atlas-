import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, isFirestoreQuotaExceeded, handleFirestoreWriteError } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  if (handleFirestoreWriteError(error)) {
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function backupLocalStorageToCloud(escritorioId?: string): Promise<{ success: boolean; timestamp?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false };
  }
  const user = auth.currentUser;
  if (!user) {
    return { success: false };
  }

  const effectiveEscritorioId = escritorioId || localStorage.getItem('atlas_escritorio_id') || 'default-escritorio';
  const path = `escritorios/${effectiveEscritorioId}/backups/${user.uid}`;

  try {
    const dataSnapshot: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('atlas_') || key.startsWith('decisoes_') || key.startsWith('periodos_') || key.startsWith('xml_'))) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            dataSnapshot[key] = JSON.parse(val);
          }
        } catch {
          const val = localStorage.getItem(key);
          if (val) dataSnapshot[key] = val;
        }
      }
    }

    const payload = {
      userId: user.uid,
      userEmail: user.email,
      escritorioId: effectiveEscritorioId,
      data: dataSnapshot,
      updatedAt: serverTimestamp(),
      clientTimestamp: new Date().toISOString(),
    };

    await setDoc(doc(db, 'escritorios', effectiveEscritorioId, 'backups', user.uid), payload, { merge: true });
    
    const nowStr = new Date().toLocaleTimeString('pt-BR');
    localStorage.setItem('atlas_last_backup_time', nowStr);
    return { success: true, timestamp: nowStr };
  } catch (error) {
    if (handleFirestoreWriteError(error)) {
      return { success: false };
    }
    handleFirestoreError(error, OperationType.WRITE, path);
    return { success: false };
  }
}

export async function restoreLocalStorageFromCloud(escritorioId?: string): Promise<{ success: boolean; restoredKeysCount?: number }> {
  const user = auth.currentUser;
  if (!user) return { success: false };

  const effectiveEscritorioId = escritorioId || localStorage.getItem('atlas_escritorio_id') || 'default-escritorio';
  const path = `escritorios/${effectiveEscritorioId}/backups/${user.uid}`;

  try {
    const docRef = doc(db, 'escritorios', effectiveEscritorioId, 'backups', user.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return { success: false };
    }

    const cloudData = snap.data();
    const dataMap = cloudData?.data || {};
    let count = 0;

    for (const [key, value] of Object.entries(dataMap)) {
      if (typeof value === 'object' && value !== null) {
        localStorage.setItem(key, JSON.stringify(value));
      } else {
        localStorage.setItem(key, String(value));
      }
      count++;
    }

    return { success: true, restoredKeysCount: count };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return { success: false };
  }
}

let backupIntervalId: any = null;

export function initPeriodicBackup(escritorioId?: string, intervalMinutes = 5) {
  if (backupIntervalId) clearInterval(backupIntervalId);

  setTimeout(() => {
    backupLocalStorageToCloud(escritorioId).catch(err => console.log('Initial backup sync:', err));
  }, 4000);

  backupIntervalId = setInterval(() => {
    backupLocalStorageToCloud(escritorioId).catch(err => console.log('Periodic backup sync:', err));
  }, intervalMinutes * 60 * 1000);

  window.addEventListener('beforeunload', () => {
    try {
      backupLocalStorageToCloud(escritorioId);
    } catch {}
  });
}
