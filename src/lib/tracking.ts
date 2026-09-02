import { db, auth, isFirestoreQuotaExceeded, handleFirestoreWriteError } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { UserData } from './auth';

export interface ConferenciaParams {
  empresaNome: string;
  arquivoNome: string;
  resumo: string;
  tempoSegundos: number;
  userData?: UserData | null;
}

export function formatTempoConferencia(segundos: number): string {
  if (!segundos || segundos <= 0) return '0s';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);

  if (h > 0) {
    return `${h}h ${m > 0 ? `${m}m ` : ''}${s > 0 ? `${s}s` : ''}`.trim();
  }
  if (m > 0) {
    return `${m}m ${s > 0 ? `${s}s` : ''}`.trim();
  }
  return `${s}s`;
}

export async function trackLoginEvent(userData?: UserData | null) {
  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || userData?.email || 'usuario@sistema.com';
  const userNome = currentUser?.displayName || userData?.nome || userEmail.split('@')[0];
  const uid = currentUser?.uid || 'user-' + Date.now();
  const escritorioId = userData?.escritorioId || '';

  const payload = {
    tipo: 'login',
    userId: uid,
    userEmail,
    userNome,
    escritorioId,
    papel: userData?.papel || 'colaborador',
    data: new Date().toISOString(),
    timestamp: serverTimestamp()
  };

  try {
    if (!isFirestoreQuotaExceeded()) {
      await addDoc(collection(db, 'eventosUso'), payload);
    }
  } catch (err) {
    handleFirestoreWriteError(err);
  }

  // Backup local storage for demo/offline
  try {
    const existing = JSON.parse(localStorage.getItem('atlas_demo_eventos') || '[]');
    existing.unshift({
      id: 'ev-login-' + Date.now(),
      ...payload,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('atlas_demo_eventos', JSON.stringify(existing.slice(0, 300)));
  } catch (e) {
    console.error('Erro ao armazenar em localStorage:', e);
  }
}

export async function trackConferenciaEvent({
  empresaNome,
  arquivoNome,
  resumo,
  tempoSegundos,
  userData
}: ConferenciaParams) {
  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || userData?.email || 'auditor@escritorio.com';
  const userNome = currentUser?.displayName || userData?.nome || userEmail.split('@')[0];
  const uid = currentUser?.uid || 'user-' + Date.now();
  const escritorioId = userData?.escritorioId || '';

  const tempoFormatado = formatTempoConferencia(tempoSegundos);

  const payload = {
    tipo: 'conferencia_arquivo',
    userId: uid,
    userEmail,
    userNome,
    escritorioId,
    empresaNome: empresaNome || 'Empresa Não Identificada',
    arquivoNome: arquivoNome || 'Arquivo Fiscal',
    resumo: resumo || 'Conferência Fiscal Realizada',
    tempoSegundos: Math.max(1, Math.round(tempoSegundos)),
    tempoFormatado,
    data: new Date().toISOString(),
    timestamp: serverTimestamp()
  };

  try {
    if (!isFirestoreQuotaExceeded()) {
      await addDoc(collection(db, 'eventosUso'), payload);
    }
  } catch (err) {
    handleFirestoreWriteError(err);
  }

  // Backup local storage for demo/offline
  try {
    const existing = JSON.parse(localStorage.getItem('atlas_demo_eventos') || '[]');
    existing.unshift({
      id: 'ev-conf-' + Date.now(),
      ...payload,
      timestamp: new Date().toISOString()
    });
    localStorage.setItem('atlas_demo_eventos', JSON.stringify(existing.slice(0, 300)));
  } catch (e) {
    console.error('Erro ao armazenar em localStorage:', e);
  }
}

export async function trackEvent(tipo: string, details?: Record<string, any>) {
  const currentUser = auth.currentUser;
  const payload = {
    tipo,
    userId: currentUser?.uid || 'anon',
    userEmail: currentUser?.email || '',
    data: new Date().toISOString(),
    timestamp: serverTimestamp(),
    ...(details || {})
  };

  try {
    if (!isFirestoreQuotaExceeded()) {
      await addDoc(collection(db, 'eventosUso'), payload);
    }
  } catch (err) {
    handleFirestoreWriteError(err);
  }
}

