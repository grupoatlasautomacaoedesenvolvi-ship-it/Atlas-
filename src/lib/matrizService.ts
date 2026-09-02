import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, safeWrite } from './firebase';
import { StateTaxRule } from '../types';

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    return 'escritorio-default';
  }
  return escritorioId;
}

export const DEFAULT_TAX_RULES: StateTaxRule[] = [
  {
    id: 'rule_cst_060_st',
    uf: 'ALL',
    ncmPrefix: '',
    expectedCst: '060',
    expectedCfop: ['1403', '5403', '2403', '6403'],
    descricao: 'Regra Banco de Dados: Produtos CST 060 (ST) -> CFOPs obrigatoriamente 1403 (entradas) ou 5403 (saídas)'
  },
  {
    id: 'rule_cst_outros_1102',
    uf: 'ALL',
    ncmPrefix: '',
    expectedCst: '000',
    expectedCfop: ['1102', '5102', '2102', '6102'],
    descricao: 'Regra Banco de Dados: Demais CSTs (diferentes de 060) -> CFOPs 1102 (entradas) ou 5102 (saídas)'
  }
];

export async function fetchGlobalStateTaxMatrix(escritorioId?: string): Promise<StateTaxRule[]> {
  const eid = exigirEscritorio(escritorioId);
  const token = localStorage.getItem('atlas_auth_token');

  // 1. Try Backend API (Admin SDK)
  try {
    const res = await fetch(`/api/escritorio/matriz?escritorioId=${eid}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.rules) && data.rules.length > 0) {
        localStorage.setItem(`atlas_state_tax_matrix_${eid}`, JSON.stringify(data.rules));
        localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(data.rules));
        return data.rules;
      }
    }
  } catch (apiErr) {
    console.warn('API fetchGlobalStateTaxMatrix warning:', apiErr);
  }

  // 2. Try Client Firestore
  try {
    const docRef = doc(db, 'escritorios', eid, 'config', 'matriz_tributaria');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const dataRules = docSnap.data().rules;
      if (Array.isArray(dataRules) && dataRules.length > 0) {
        localStorage.setItem(`atlas_state_tax_matrix_${eid}`, JSON.stringify(dataRules));
        localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(dataRules));
        return dataRules;
      }
    }
  } catch (error) {
    console.warn('Firestore fetchGlobalStateTaxMatrix warning:', error);
  }

  // 3. Try LocalStorage
  try {
    const local = localStorage.getItem(`atlas_state_tax_matrix_${eid}`) || localStorage.getItem('atlas_state_tax_matrix');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (localErr) {
    console.warn('LocalStorage fetch error:', localErr);
  }

  // 4. Save and return defaults
  await saveGlobalStateTaxMatrix(DEFAULT_TAX_RULES, eid);
  return DEFAULT_TAX_RULES;
}

export async function saveGlobalStateTaxMatrix(rules: StateTaxRule[], escritorioId?: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const token = localStorage.getItem('atlas_auth_token');

  // Always save to localStorage immediately for guaranteed offline/instant persistence
  try {
    localStorage.setItem('atlas_state_tax_matrix', JSON.stringify(rules));
    localStorage.setItem(`atlas_state_tax_matrix_${eid}`, JSON.stringify(rules));
  } catch (err) {
    console.warn('Could not save to localStorage:', err);
  }

  // 1. Try Backend API (Admin SDK - bypasses client Firestore rules)
  let savedToDb = false;
  try {
    const res = await fetch('/api/escritorio/matriz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ rules, escritorioId: eid })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        savedToDb = true;
      }
    }
  } catch (apiErr) {
    console.warn('API saveGlobalStateTaxMatrix warning:', apiErr);
  }

  // 2. Try Client Firestore via safeWrite if backend API didn't confirm
  if (!savedToDb) {
    try {
      await safeWrite(async () => {
        const docRef = doc(db, 'escritorios', eid, 'config', 'matriz_tributaria');
        await setDoc(docRef, { rules, updatedAt: new Date().toISOString() }, { merge: true });
      });
    } catch (fsErr) {
      console.warn('Firestore saveGlobalStateTaxMatrix warning:', fsErr);
    }
  }
}
