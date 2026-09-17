import { db, auth, isFirestoreQuotaExceeded } from './firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';

export interface SystemErrorLog {
  id: string;
  message: string;
  context: string; // 'Firestore' | 'API' | 'Network' | 'Auth' | 'Geral'
  stack?: string;
  timestamp: string;
  userEmail?: string;
  sev: 'critical' | 'warning' | 'info';
}

export async function logSystemError(error: unknown, context = 'Geral', sev: 'critical' | 'warning' | 'info' = 'critical') {
  const message = String((error as any)?.message || error || 'Erro desconhecido');
  const stack = String((error as any)?.stack || '');
  const currentUser = auth.currentUser;
  const userEmail = currentUser?.email || 'sistema@atlas.com';

  const logEntry: SystemErrorLog = {
    id: 'err-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    message,
    context,
    stack,
    timestamp: new Date().toISOString(),
    userEmail,
    sev
  };

  // 1. LocalStorage update (Real-time local feed)
  try {
    const existing = JSON.parse(localStorage.getItem('atlas_system_errors') || '[]');
    existing.unshift(logEntry);
    localStorage.setItem('atlas_system_errors', JSON.stringify(existing.slice(0, 150)));
    
    // Dispatch custom event for real-time UI listeners
    window.dispatchEvent(new CustomEvent('atlas_error_logged', { detail: logEntry }));
  } catch (e) {
    console.warn('Erro ao gravar log de erro no localStorage:', e);
  }

  // 2. Try to persist to Firestore if online & quota OK
  try {
    if (!isFirestoreQuotaExceeded()) {
      await addDoc(collection(db, 'system_erros'), {
        ...logEntry,
        createdAt: serverTimestamp()
      });
    }
  } catch (err) {
    // Silent fail for error logger network errors to avoid infinite loops
  }

  // 3. Try backend API endpoint
  try {
    const token = localStorage.getItem('atlas_auth_token');
    await fetch('/api/admin/erros', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify(logEntry)
    });
  } catch (e) {
    // Ignore backend reporting failures
  }

  console.error(`[Atlas ErrorMonitor] [${context}] (${sev.toUpperCase()}):`, message);
}

export function getLocalSystemErrors(): SystemErrorLog[] {
  try {
    return JSON.parse(localStorage.getItem('atlas_system_errors') || '[]');
  } catch (e) {
    return [];
  }
}

export function clearLocalSystemErrors() {
  try {
    localStorage.removeItem('atlas_system_errors');
    window.dispatchEvent(new CustomEvent('atlas_error_logged', { detail: null }));
  } catch (e) {
    // Ignore
  }
}
