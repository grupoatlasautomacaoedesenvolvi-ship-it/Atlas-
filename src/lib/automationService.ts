import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db, safeWrite } from './firebase';

export interface AutomationLog {
  id?: string;
  timestamp: string;
  spedId: string;
  alteracoes: number;
  detalhes: any[];
}

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    throw new Error('escritorioId é obrigatório — operação bloqueada para evitar vazamento entre escritórios.');
  }
  return escritorioId;
}

export async function isAutoCrosscheckEnabled(escritorioId: string): Promise<boolean> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const docRef = doc(db, 'escritorios', eid, 'config', 'automacao');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().autoCrosscheckEnabled || false;
    }
  } catch (error) {
    console.error('Error fetching auto crosscheck config:', error);
  }
  return false;
}

export async function setAutoCrosscheckEnabled(enabled: boolean, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  await safeWrite(async () => {
    const docRef = doc(db, 'escritorios', eid, 'config', 'automacao');
    await setDoc(docRef, { autoCrosscheckEnabled: enabled }, { merge: true });
  });
}

export async function logAutomationRun(spedId: string, alteracoes: number, detalhes: any[], escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const log: AutomationLog = {
    timestamp: new Date().toISOString(),
    spedId,
    alteracoes,
    detalhes
  };
  
  await safeWrite(async () => {
    await addDoc(collection(db, 'escritorios', eid, 'automation_logs'), log);
  });
}

export async function getAutomationLogs(escritorioId: string): Promise<AutomationLog[]> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const q = query(collection(db, 'escritorios', eid, 'automation_logs'), orderBy('timestamp', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutomationLog));
  } catch (error) {
    console.error('Error fetching automation logs:', error);
    return [];
  }
}
