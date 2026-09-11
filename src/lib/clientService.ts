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
  if (escritorioId && escritorioId.trim().length > 0) {
    return escritorioId.trim();
  }
  const savedActive = typeof localStorage !== 'undefined' ? localStorage.getItem('atlas_active_escritorio_id') : null;
  if (savedActive && savedActive.trim().length > 0) {
    return savedActive.trim();
  }
  return 'padrao';
}

export interface EscritorioInfo {
  id: string;
  nome: string;
  cnpj?: string;
  ativo?: boolean;
}

export async function fetchAllEscritorios(): Promise<EscritorioInfo[]> {
  try {
    const q = query(collection(db, 'escritorios'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as EscritorioInfo));
    }
  } catch (e) {
    console.warn('Erro ao listar escritórios no Firestore:', e);
  }
  return [
    { id: 'padrao', nome: 'Escritório Modelo', cnpj: '12.345.678/0001-99', ativo: true }
  ];
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
  const id = clienteData.id || `cli-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Audit raw incoming input for missing or undefined mandatory fields (helpful for Robô Fiscal diagnosis)
  const rawAudit = {
    nomeNullOrUndefined: clienteData.nome === undefined || clienteData.nome === null,
    nomeEmpty: !clienteData.nome || clienteData.nome.trim() === '',
    cnpjNullOrUndefined: clienteData.cnpj === undefined || clienteData.cnpj === null,
    cnpjEmpty: !clienteData.cnpj || clienteData.cnpj.trim() === '',
    ufNullOrUndefined: clienteData.uf === undefined || clienteData.uf === null,
    ufEmpty: !clienteData.uf || clienteData.uf.trim() === '',
    regimeNullOrUndefined: clienteData.regimeTributario === undefined || clienteData.regimeTributario === null,
    escritorioIdPassed: escritorioId,
    resolvedEscritorioId: eid
  };

  if (rawAudit.nomeNullOrUndefined || rawAudit.nomeEmpty || rawAudit.cnpjNullOrUndefined || rawAudit.cnpjEmpty) {
    console.warn('[clientService.saveCliente] ATENÇÃO: Campos obrigatórios ausentes ou nulos no clienteData bruto:', {
      rawInput: clienteData,
      audit: rawAudit
    });
  }

  // Standardize & Format CNPJ (00.000.000/0000-00 if 14 raw digits)
  let cleanCnpj = (clienteData.cnpj || '').trim();
  const digitsOnly = cleanCnpj.replace(/\D/g, '');
  if (digitsOnly.length === 14) {
    cleanCnpj = digitsOnly.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }

  // Ensure mandatory fields are populated or provided with sensible defaults
  const nomeLimpo = (clienteData.nome || '').trim();
  const nomeFinal = nomeLimpo.length > 0
    ? nomeLimpo
    : (cleanCnpj ? `Empresa ${cleanCnpj}` : 'Nova Empresa');

  const ufFinal = (clienteData.uf || 'SP').trim().toUpperCase() || 'SP';
  const regimeFinal = clienteData.regimeTributario || 'Lucro Real';

  const fullCliente: Cliente = {
    id,
    nome: nomeFinal,
    cnpj: cleanCnpj,
    uf: ufFinal,
    ie: (clienteData.ie || '').trim(),
    regimeTributario: regimeFinal,
    email: (clienteData.email || '').trim(),
    telefone: (clienteData.telefone || '').trim(),
    observacoes: (clienteData.observacoes || '').trim(),
    tags: clienteData.tags || [],
    escritorioId: eid,
    createdAt: clienteData.createdAt || now,
    updatedAt: now
  };

  // Explicit pre-write log before attempting Firestore document creation
  console.log('[clientService.saveCliente] [PRE-GRAVAÇÃO] Verificando dados para gravação no Firestore:', {
    targetPath: `escritorios/${eid}/clientes/${id}`,
    escritorioId: eid,
    dadosBrutosRecebidos: clienteData,
    dadosProcessados: fullCliente,
    diagnosticoCamposBrutos: rawAudit
  });

  // Update local cache immediately for UI responsiveness
  const cache = getLocalCache<Cliente>(CLIENTES_LOCAL_KEY, eid);
  const idx = cache.findIndex(c => c.id === id);
  if (idx >= 0) {
    cache[idx] = fullCliente;
  } else {
    cache.unshift(fullCliente);
  }
  setLocalCache(CLIENTES_LOCAL_KEY, eid, cache);
  localStorage.setItem(`${CLIENTES_LOCAL_KEY}_${eid}_initialized`, 'true');

  // Explicit try-catch around the Firestore document operation (setDoc / addDoc)
  try {
    const docRef = doc(db, 'escritorios', eid, 'clientes', id);
    const payload = {
      ...fullCliente,
      serverTimestamp: serverTimestamp()
    };

    console.log('[clientService.saveCliente] [DURANTE-GRAVAÇÃO] Iniciando setDoc/addDoc no Firestore:', {
      docPath: docRef.path,
      payload
    });

    await safeWrite(async () => {
      await setDoc(docRef, payload, { merge: true });
    });

    console.log('[clientService.saveCliente] [PÓS-GRAVAÇÃO] Sucesso na gravação no Firestore:', {
      id: fullCliente.id,
      nome: fullCliente.nome,
      cnpj: fullCliente.cnpj,
      escritorioId: eid
    });
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    const missingOrInvalidFields: string[] = [];

    if (!fullCliente.nome) missingOrInvalidFields.push('nome');
    if (!fullCliente.cnpj) missingOrInvalidFields.push('cnpj');
    if (!fullCliente.uf) missingOrInvalidFields.push('uf');
    if (!eid) missingOrInvalidFields.push('escritorioId');

    console.error('[clientService.saveCliente] [FALHA-GRAVAÇÃO] Erro durante a chamada do Firestore:', {
      erro: errorMessage,
      camposEnviadosClienteData: clienteData,
      objetoProcessadoFullCliente: fullCliente,
      escritorioId: eid,
      diagnosticoCamposBrutos: rawAudit,
      camposSuspeitos: missingOrInvalidFields
    });

    throw new Error(
      `Falha na operação Firestore (saveCliente) no caminho 'escritorios/${eid}/clientes/${id}': ${errorMessage}. ` +
      `Campos recebidos em clienteData: ${JSON.stringify(clienteData)}. ` +
      `Diagnóstico de campos nulos/ausentes: ${JSON.stringify(rawAudit)}`
    );
  }

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
  const id = pastaData.id || `pasta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
