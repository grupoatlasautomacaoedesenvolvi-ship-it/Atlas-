import { db, isFirestoreQuotaExceeded, handleFirestoreWriteError, safeWrite } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { Cliente, PastaCliente, ArquivoCliente } from '../types';

const CLIENTES_LOCAL_KEY = 'atlas_clientes_cache';
const PASTAS_LOCAL_KEY = 'atlas_pastas_cache';
const ARQUIVOS_LOCAL_KEY = 'atlas_arquivos_cache';

function getLocalCache<T>(key: string, escritorioId: string): T[] {
  try {
    const raw = localStorage.getItem(`${key}_${escritorioId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalCache<T>(key: string, escritorioId: string, data: T[]) {
  try {
    localStorage.setItem(`${key}_${escritorioId}`, JSON.stringify(data));
  } catch (e) {
    console.warn(`Local cache storage warning for ${key}:`, e);
  }
}

const INITIAL_CLIENTS: Cliente[] = [
  {
    id: 'cli-demo-1',
    nome: 'Comércio de Bebidas e Alimentos Matriz LTDA',
    cnpj: '12.345.678/0001-90',
    uf: 'SP',
    ie: '110.123.456.789',
    regimeTributario: 'Lucro Real',
    email: 'fiscal@comerciobebidas.com.br',
    telefone: '(11) 3456-7890',
    observacoes: 'Cliente prioritário - Auditoria contínua de SPED ICMS/IPI e Bloco H',
    tags: ['Lucro Real', 'Atacado', 'SP'],
    escritorioId: 'padrao',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'cli-demo-2',
    nome: 'Indústria Metalúrgica do Vale S/A',
    cnpj: '98.765.432/0001-10',
    uf: 'MG',
    ie: '062.987.654.321',
    regimeTributario: 'Lucro Presumido',
    email: 'contabilidade@metalurgicavale.com.br',
    telefone: '(31) 98877-6655',
    observacoes: 'Auditoria de aproveitamento de créditos de ICMS sobre insumos',
    tags: ['Lucro Presumido', 'Indústria', 'MG'],
    escritorioId: 'padrao',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const INITIAL_PASTAS: PastaCliente[] = [
  {
    id: 'pasta-demo-1',
    clienteId: 'cli-demo-1',
    nome: 'Exercício 2024',
    descricao: 'Arquivos SPED Fiscal e XMLs de Entrada/Saída do ano fiscal 2024',
    cor: 'emerald',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pasta-demo-2',
    clienteId: 'cli-demo-1',
    nome: 'Exercício 2025 - em andamento',
    descricao: 'SPEDs mensais e XMLs de terceiros para conferência retroativa',
    cor: 'blue',
    createdAt: new Date().toISOString()
  },
  {
    id: 'pasta-demo-3',
    clienteId: 'cli-demo-2',
    nome: 'Inventário e Bloco H',
    descricao: 'Apurações de Estoque H010/H020 e reclassificações NCM',
    cor: 'amber',
    createdAt: new Date().toISOString()
  }
];

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    throw new Error('escritorioId é obrigatório — operação bloqueada para evitar vazamento entre escritórios.');
  }
  return escritorioId;
}

export interface EscritorioInfo {
  id: string;
  nome: string;
  cnpj?: string;
  ativo?: boolean;
}

export async function fetchEscritorioInfo(escritorioId: string): Promise<EscritorioInfo> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const docRef = doc(db, 'escritorios', eid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as EscritorioInfo;
    }
  } catch (e) {
    console.warn('Erro ao carregar escritório do Firestore:', e);
  }
  return {
    id: eid,
    nome: `Escritório ${eid}`,
    cnpj: '12.345.678/0001-99',
    ativo: true
  };
}

export async function fetchClientes(escritorioId: string): Promise<Cliente[]> {
  const eid = exigirEscritorio(escritorioId);
  const initKey = `${CLIENTES_LOCAL_KEY}_${eid}_initialized`;
  const isInitialized = localStorage.getItem(initKey) === 'true';

  try {
    const q = query(collection(db, 'escritorios', eid, 'clientes'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
      setLocalCache(CLIENTES_LOCAL_KEY, eid, items);
      localStorage.setItem(initKey, 'true');
      return items;
    }

    if (isInitialized) {
      setLocalCache(CLIENTES_LOCAL_KEY, eid, []);
      return [];
    }
  } catch (e) {
    console.warn('Firestore fetchClientes offline/error, loading cache:', e);
  }

  let local = getLocalCache<Cliente>(CLIENTES_LOCAL_KEY, eid);
  if (!isInitialized && local.length === 0) {
    local = INITIAL_CLIENTS.map(c => ({ ...c, escritorioId: eid }));
    setLocalCache(CLIENTES_LOCAL_KEY, eid, local);
    localStorage.setItem(initKey, 'true');

    for (const cli of local) {
      await safeWrite(async () => {
        setDoc(doc(db, 'escritorios', eid, 'clientes', cli.id), cli, { merge: true });
      });
    }
  }
  return local;
}

export async function saveCliente(clienteData: Partial<Cliente>, escritorioId: string): Promise<Cliente> {
  const eid = exigirEscritorio(escritorioId);
  const id = clienteData.id || `cli-${Date.now()}`;
  const now = new Date().toISOString();

  const fullCliente: Cliente = {
    id,
    nome: clienteData.nome || 'Novo Cliente',
    cnpj: clienteData.cnpj || '',
    uf: clienteData.uf || 'SP',
    ie: clienteData.ie || '',
    regimeTributario: clienteData.regimeTributario || 'Lucro Real',
    email: clienteData.email || '',
    telefone: clienteData.telefone || '',
    observacoes: clienteData.observacoes || '',
    tags: clienteData.tags || [],
    escritorioId: eid,
    createdAt: clienteData.createdAt || now,
    updatedAt: now
  };

  const cache = getLocalCache<Cliente>(CLIENTES_LOCAL_KEY, eid);
  const idx = cache.findIndex(c => c.id === id);
  if (idx >= 0) {
    cache[idx] = fullCliente;
  } else {
    cache.unshift(fullCliente);
  }
  setLocalCache(CLIENTES_LOCAL_KEY, eid, cache);
  localStorage.setItem(`${CLIENTES_LOCAL_KEY}_${eid}_initialized`, 'true');

  await safeWrite(async () => {
    await setDoc(doc(db, 'escritorios', eid, 'clientes', id), {
      ...fullCliente,
      serverTimestamp: serverTimestamp()
    }, { merge: true });
  });

  return fullCliente;
}

export async function deleteCliente(id: string, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  localStorage.setItem(`${CLIENTES_LOCAL_KEY}_${eid}_initialized`, 'true');

  const cache = getLocalCache<Cliente>(CLIENTES_LOCAL_KEY, eid).filter(c => c.id !== id);
  setLocalCache(CLIENTES_LOCAL_KEY, eid, cache);

  await safeWrite(async () => {
    await deleteDoc(doc(db, 'escritorios', eid, 'clientes', id));
  });
}

const MESES = [
  '01 - Janeiro', '02 - Fevereiro', '03 - Março', '04 - Abril',
  '05 - Maio', '06 - Junho', '07 - Julho', '08 - Agosto',
  '09 - Setembro', '10 - Outubro', '11 - Novembro', '12 - Dezembro'
];

export async function ensureStandardFiscalFolders(
  clienteId: string, 
  anos: string[] = ['2025', '2024'],
  escritorioId: string
): Promise<PastaCliente[]> {
  const eid = exigirEscritorio(escritorioId);
  const existingPastas = await fetchPastasCliente(clienteId, eid);
  const createdOrUpdated: PastaCliente[] = [...existingPastas];

  for (const ano of anos) {
    const exercicioNome = `Exercício ${ano}`;
    let exercicioPasta = createdOrUpdated.find(p => p.clienteId === clienteId && p.nome === exercicioNome && !p.parentId);

    if (!exercicioPasta) {
      exercicioPasta = await savePastaCliente({
        clienteId,
        nome: exercicioNome,
        descricao: `Pasta do Exercício Fiscal ${ano}`,
        parentId: null,
        cor: ano === '2025' ? 'blue' : 'slate'
      }, eid);
      createdOrUpdated.push(exercicioPasta);
    }

    for (const mes of MESES) {
      const existsMes = createdOrUpdated.some(
        p => p.clienteId === clienteId && p.parentId === exercicioPasta!.id && p.nome === mes
      );

      if (!existsMes) {
        const mesPasta = await savePastaCliente({
          clienteId,
          nome: mes,
          descricao: `Documentos fiscais e apurações de ${mes.split(' - ')[1]}/${ano}`,
          parentId: exercicioPasta.id,
          cor: 'amber'
        }, eid);
        createdOrUpdated.push(mesPasta);
      }
    }
  }

  return createdOrUpdated;
}

export async function fetchPastasCliente(clienteId: string, escritorioId: string): Promise<PastaCliente[]> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const q = query(collection(db, 'escritorios', eid, 'pastas_clientes'), where('clienteId', '==', clienteId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PastaCliente));
      const allCache = getLocalCache<PastaCliente>(PASTAS_LOCAL_KEY, eid).filter(p => p.clienteId !== clienteId);
      setLocalCache(PASTAS_LOCAL_KEY, eid, [...allCache, ...items]);
      return items;
    }
  } catch (e) {
    console.warn('Firestore fetchPastasCliente offline/error:', e);
  }

  let cache = getLocalCache<PastaCliente>(PASTAS_LOCAL_KEY, eid);
  if (cache.length === 0) {
    cache = INITIAL_PASTAS;
    setLocalCache(PASTAS_LOCAL_KEY, eid, cache);
  }
  return cache.filter(p => p.clienteId === clienteId);
}

export async function savePastaCliente(pastaData: Partial<PastaCliente>, escritorioId: string): Promise<PastaCliente> {
  const eid = exigirEscritorio(escritorioId);
  const id = pastaData.id || `pasta-${Date.now()}`;
  const now = new Date().toISOString();

  const fullPasta: PastaCliente = {
    id,
    clienteId: pastaData.clienteId || '',
    nome: pastaData.nome || 'Nova Pasta',
    descricao: pastaData.descricao || '',
    parentId: pastaData.parentId || null,
    cor: pastaData.cor || 'blue',
    createdAt: pastaData.createdAt || now
  };

  const cache = getLocalCache<PastaCliente>(PASTAS_LOCAL_KEY, eid);
  const idx = cache.findIndex(p => p.id === id);
  if (idx >= 0) {
    cache[idx] = fullPasta;
  } else {
    cache.unshift(fullPasta);
  }
  setLocalCache(PASTAS_LOCAL_KEY, eid, cache);

  await safeWrite(async () => {
    await setDoc(doc(db, 'escritorios', eid, 'pastas_clientes', id), fullPasta, { merge: true });
  });

  return fullPasta;
}

export async function deletePastaCliente(id: string, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const cache = getLocalCache<PastaCliente>(PASTAS_LOCAL_KEY, eid).filter(p => p.id !== id);
  setLocalCache(PASTAS_LOCAL_KEY, eid, cache);

  await safeWrite(async () => {
    await deleteDoc(doc(db, 'escritorios', eid, 'pastas_clientes', id));
  });
}

export async function fetchArquivosCliente(clienteId: string, escritorioId: string, pastaId?: string): Promise<ArquivoCliente[]> {
  const eid = exigirEscritorio(escritorioId);
  try {
    let q;
    if (pastaId) {
      q = query(collection(db, 'escritorios', eid, 'arquivos_clientes'), where('clienteId', '==', clienteId), where('pastaId', '==', pastaId));
    } else {
      q = query(collection(db, 'escritorios', eid, 'arquivos_clientes'), where('clienteId', '==', clienteId));
    }
    const snap = await getDocs(q);
    if (!snap.empty) {
      const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ArquivoCliente));
      return items;
    }
  } catch (e) {
    console.warn('Firestore fetchArquivosCliente error:', e);
  }

  const cache = getLocalCache<ArquivoCliente>(ARQUIVOS_LOCAL_KEY, eid);
  return cache.filter(a => a.clienteId === clienteId && (!pastaId || a.pastaId === pastaId));
}

export async function saveArquivoCliente(arqData: Partial<ArquivoCliente>, escritorioId: string): Promise<ArquivoCliente> {
  const eid = exigirEscritorio(escritorioId);
  const id = arqData.id || `arq-${Date.now()}`;
  const now = new Date().toISOString();

  const fullArq: ArquivoCliente = {
    id,
    clienteId: arqData.clienteId || '',
    pastaId: arqData.pastaId || '',
    nome: arqData.nome || 'Arquivo Auditado',
    tipo: arqData.tipo || 'SPED',
    periodo: arqData.periodo || '',
    tamanhoBytes: arqData.tamanhoBytes || 0,
    qtdDocumentos: arqData.qtdDocumentos || 0,
    criadoPor: arqData.criadoPor || 'Sistema',
    dataUpload: arqData.dataUpload || now,
    dadosSped: arqData.dadosSped,
    xmlsTerceiros: arqData.xmlsTerceiros,
    xmlsProprios: arqData.xmlsProprios,
    xmlsNfce: arqData.xmlsNfce,
    observacoes: arqData.observacoes || ''
  };

  const cache = getLocalCache<ArquivoCliente>(ARQUIVOS_LOCAL_KEY, eid);
  const idx = cache.findIndex(a => a.id === id);
  if (idx >= 0) {
    cache[idx] = fullArq;
  } else {
    cache.unshift(fullArq);
  }
  setLocalCache(ARQUIVOS_LOCAL_KEY, eid, cache);

  await safeWrite(async () => {
    await setDoc(doc(db, 'escritorios', eid, 'arquivos_clientes', id), fullArq, { merge: true });
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atlas_file_saved', { detail: fullArq }));
  }

  return fullArq;
}

export async function deleteArquivoCliente(id: string, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const cache = getLocalCache<ArquivoCliente>(ARQUIVOS_LOCAL_KEY, eid).filter(a => a.id !== id);
  setLocalCache(ARQUIVOS_LOCAL_KEY, eid, cache);

  await safeWrite(async () => {
    await deleteDoc(doc(db, 'escritorios', eid, 'arquivos_clientes', id));
  });
}
