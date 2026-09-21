import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db, safeWrite } from './firebase';
import { RoboConfig, RoboExecutionLog, LearnedTaxRule, StateTaxRule, SpedData, XmlRecord, Cliente, ArquivoCliente, SpedItem, Achado, AuditFinding, CorrecaoItemC170, PlanoCorrecaoC170Result, RegimeTributario } from '../types';
import { saveGlobalStateTaxMatrix } from './matrizService';
import { orchestrateTaxAudit, TaxItemInput } from './aiOrchestrator';

const NCMS_FCP_2PCT = ['3303', '3304', '3305', '3307'];

let robôFiscalEmExecucao = false;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const DEFAULT_ROBO_CONFIG: RoboConfig = {
  ativo: fontCheckDemo(),
  intervaloMinutos: 5,
  notificarInconsistencias: true,
  validarSpedXmlCruzado: true
};

function fontCheckDemo(): boolean {
  return localStorage.getItem('atlas_robo_ativo') !== 'false';
}

function exigirEscritorio(escritorioId: string | undefined): string {
  if (!escritorioId) {
    throw new Error('escritorioId é obrigatório — operação de robô sem escritório definido foi bloqueada para evitar vazamento entre escritórios.');
  }
  return escritorioId;
}

export async function getRoboConfig(escritorioId: string): Promise<RoboConfig> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const docRef = doc(db, 'escritorios', eid, 'config', 'robo_fiscal');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { ...DEFAULT_ROBO_CONFIG, ...docSnap.data() };
    }
  } catch (error) {
    console.warn('Configuração do Robô Fiscal não encontrada ou offline, usando fallback local/default:', error);
  }

  const localSaved = localStorage.getItem(`atlas_robo_config_${eid}`);
  if (localSaved) {
    try {
      return JSON.parse(localSaved);
    } catch (e) {
      console.error('Erro ao ler config local do robô:', e);
    }
  }

  return DEFAULT_ROBO_CONFIG;
}

export async function saveRoboConfig(config: RoboConfig, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  localStorage.setItem(`atlas_robo_config_${eid}`, JSON.stringify(config));
  localStorage.setItem(`atlas_robo_ativo_${eid}`, config.ativo ? 'true' : 'false');

  await safeWrite(async () => {
    const docRef = doc(db, 'escritorios', eid, 'config', 'robo_fiscal');
    await setDoc(docRef, config, { merge: true });
  });
}

export async function getRoboLogs(limitCount = 50, escritorioId: string): Promise<RoboExecutionLog[]> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const q = query(collection(db, 'escritorios', eid, 'robo_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoboExecutionLog));
    }
  } catch (error) {
    console.warn('Logs do Robô indisponíveis ou offline, usando fallback local:', error);
  }

  const localSaved = localStorage.getItem(`atlas_robo_logs_${eid}`);
  if (localSaved) {
    try {
      return JSON.parse(localSaved);
    } catch (e) {
      console.error('Erro ao ler logs locais do robô:', e);
    }
  }

  // Sem log real no Firestore nem no localStorage: retorna vazio, nunca
  // dado fictício. Um escritório novo, sem histórico ainda, deve ver "nenhum
  // log ainda" — nunca uma auditoria inventada de uma empresa que não existe.
  return [];
}

export async function addRoboLog(logData: Omit<RoboExecutionLog, 'id'>, escritorioId: string): Promise<RoboExecutionLog> {
  const eid = exigirEscritorio(escritorioId);
  const newLog: RoboExecutionLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    ...logData
  };

  const existingStr = localStorage.getItem(`atlas_robo_logs_${eid}`);
  const existing: RoboExecutionLog[] = existingStr ? JSON.parse(existingStr) : [];
  existing.unshift(newLog);
  localStorage.setItem(`atlas_robo_logs_${eid}`, JSON.stringify(existing.slice(0, 100)));

  await safeWrite(async () => {
    await addDoc(collection(db, 'escritorios', eid, 'robo_logs'), newLog);
  });

  return newLog;
}

export async function getLearnedRules(escritorioId: string): Promise<LearnedTaxRule[]> {
  const eid = exigirEscritorio(escritorioId);
  try {
    const q = query(collection(db, 'escritorios', eid, 'robo_learned_rules'), orderBy('criadoEm', 'desc'));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearnedTaxRule));
    }
  } catch (error) {
    console.warn('Regras aprendidas do Robô indisponíveis ou offline, usando fallback local:', error);
  }

  const localSaved = localStorage.getItem(`atlas_robo_learned_rules_${eid}`);
  if (localSaved) {
    try {
      return JSON.parse(localSaved);
    } catch (e) {
      console.error('Erro ao ler regras aprendidas locais:', e);
    }
  }

  // Sem regra real ainda: retorna vazio, nunca uma sugestão inventada. Uma
  // regra fictícia com status 'pendente' correria o risco de ser aprovada
  // por engano, entrando na Matriz Tributária real como se fosse verdade.
  return [];
}

export async function saveLearnedRule(rule: LearnedTaxRule, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const existingStr = localStorage.getItem(`atlas_robo_learned_rules_${eid}`);
  const existing: LearnedTaxRule[] = existingStr ? JSON.parse(existingStr) : [];
  
  const idx = existing.findIndex(r => r.id === rule.id || (r.uf === rule.uf && r.ncmPrefix === rule.ncmPrefix));
  if (idx >= 0) {
    const prev = existing[idx];

    // Trava de Segurança: Se a regra já foi aprovada ou rejeitada, não rebaixa para 'pendente'
    if ((prev.status === 'aprovado' || prev.status === 'rejeitado') && rule.status === 'pendente') {
      return;
    }

    // Se ambas são pendentes, acumula a quantidade de amostras analisadas e recalcula a confiança
    if (prev.status === 'pendente' && rule.status === 'pendente') {
      const totalSamples = (prev.amostrasAnalisadas || 0) + (rule.amostrasAnalisadas || 1);
      const newConfidence = Math.min(99, 75 + Math.min(24, totalSamples * 3));
      
      const combinedCfops = Array.from(new Set([
        ...(prev.learnedCfop || []),
        ...(rule.learnedCfop || [])
      ]));

      rule = {
        ...prev,
        ...rule,
        id: prev.id,
        amostrasAnalisadas: totalSamples,
        confiancaPercentual: newConfidence,
        learnedCfop: combinedCfops,
        criadoEm: prev.criadoEm || rule.criadoEm
      };
    }

    existing[idx] = rule;
  } else {
    existing.unshift(rule);
  }
  localStorage.setItem(`atlas_robo_learned_rules_${eid}`, JSON.stringify(existing));

  await safeWrite(async () => {
    await setDoc(doc(db, 'escritorios', eid, 'robo_learned_rules', rule.id), rule, { merge: true });
  });
}

export async function approveLearnedRule(
  ruleId: string, 
  currentMatrix: StateTaxRule[], 
  escritorioId: string,
  onSaveMatrix?: (newMatrix: StateTaxRule[]) => void
): Promise<StateTaxRule[]> {
  const eid = exigirEscritorio(escritorioId);
  const learnedList = await getLearnedRules(eid);
  const ruleToApprove = learnedList.find(r => r.id === ruleId);

  if (!ruleToApprove) throw new Error('Regra não encontrada.');

  ruleToApprove.status = 'aprovado';
  await saveLearnedRule(ruleToApprove, eid);

  const primaryCfop = ruleToApprove.learnedCfop && ruleToApprove.learnedCfop.length > 0 
    ? ruleToApprove.learnedCfop[0] 
    : '5102';

  const productDesc = ruleToApprove.descricaoProduto 
    ? `${ruleToApprove.descricaoProduto}` 
    : ruleToApprove.descricao;

  const newMatrixRule: StateTaxRule = {
    id: `rule_learned_${Date.now()}`,
    uf: ruleToApprove.uf,
    ncmPrefix: ruleToApprove.ncmPrefix,
    expectedCst: ruleToApprove.learnedCst || '000',
    expectedCfop: [primaryCfop],
    expectedAliqIcms: ruleToApprove.learnedAliqIcms || 0,
    descricao: `[Aprovado pelo Auditor] Produto/NCM: ${productDesc} | Origem: ${ruleToApprove.clienteOrigem || 'Auditado em SPED/XML'}`
  };

  const updatedMatrix = [newMatrixRule, ...currentMatrix.filter(m => !(m.uf === newMatrixRule.uf && m.ncmPrefix === newMatrixRule.ncmPrefix))];
  
  await saveGlobalStateTaxMatrix(updatedMatrix, eid);
  if (onSaveMatrix) onSaveMatrix(updatedMatrix);

  await addRoboLog({
    timestamp: new Date().toISOString(),
    tipoAcao: 'APRENDIZADO',
    mensagem: `Regra NCM ${ruleToApprove.ncmPrefix} (CST ${ruleToApprove.learnedCst} | CFOP ${primaryCfop}) aprovada e integrada à Matriz Tributária.`,
    detalhes: `Produto: ${productDesc} | UF: ${ruleToApprove.uf}`
  }, eid);

  return updatedMatrix;
}

export async function rejectLearnedRule(ruleId: string, escritorioId: string): Promise<void> {
  const eid = exigirEscritorio(escritorioId);
  const learnedList = await getLearnedRules(eid);
  const ruleToReject = learnedList.find(r => r.id === ruleId);
  if (ruleToReject) {
    ruleToReject.status = 'rejeitado';
    await saveLearnedRule(ruleToReject, eid);
  }
}

export async function verificarEProcessarArquivosSalvos({
  matrizRules,
  clientes,
  onNotification,
  escritorioId
}: {
  matrizRules: StateTaxRule[];
  clientes: Cliente[];
  onNotification?: (title: string, message: string, type: any, actionUrl?: string) => void;
  escritorioId: string;
}): Promise<{
  arquivosEncontrados: number;
  novosProcessados: number;
}> {
  const eid = exigirEscritorio(escritorioId);
  if (robôFiscalEmExecucao) {
    return { arquivosEncontrados: 0, novosProcessados: 0 };
  }
  robôFiscalEmExecucao = true;

  try {
    const config = await getRoboConfig(eid);
    if (!config.ativo) {
      return { arquivosEncontrados: 0, novosProcessados: 0 };
    }

    const processedStr = localStorage.getItem(`atlas_robo_processed_files_${eid}`) || '[]';
    let processedIds: string[] = [];
    try {
      processedIds = JSON.parse(processedStr);
    } catch (e) {
      processedIds = [];
    }

    const allSavedArquivosStr = localStorage.getItem(`atlas_arquivos_cache_${eid}`);
    let allSavedArquivos: ArquivoCliente[] = [];
    if (allSavedArquivosStr) {
      try {
        allSavedArquivos = JSON.parse(allSavedArquivosStr);
      } catch (e) {
        console.warn('Erro ao ler arquivos do localStorage:', e);
      }
    }

    const pendentes = allSavedArquivos.filter(a => a.id && !processedIds.includes(a.id));
    let novosProcessados = 0;

    for (const arq of pendentes) {
      const clienteObj = clientes.find(c => c.id === arq.clienteId) || null;
      const clienteNome = clienteObj?.nome || 'Empresa Cliente';

      const spedData = arq.dadosSped || null;
      const xmls = [
        ...(arq.xmlsTerceiros || []),
        ...(arq.xmlsProprios || []),
        ...(arq.xmlsNfce || [])
      ];

      if (!spedData && xmls.length === 0) {
        processedIds.push(arq.id);
        continue;
      }

      const result = await processarArquivosComRobo({
        spedData,
        xmls,
        cliente: clienteObj,
        matrizRules,
        escritorioId: eid
      });

      await addRoboLog({
        timestamp: new Date().toISOString(),
        clienteNome,
        arquivoNome: arq.nome,
        tipoAcao: result.resumo.inconsistenciasCount > 0 ? 'INCONSISTENCIA' : 'PROCESSAMENTO',
        mensagem: `[Auto-Importador] Arquivo salvo "${arq.nome}" identificado na pasta e importado pelo Robô.`,
        detalhes: `${result.resumo.totalItensAnalisados} itens validados | ${result.resumo.inconsistenciasCount} divergência(s) | ${result.resumo.regrasNovasCount} padrão(ões) aprendido(s)`,
        inconsistenciasCount: result.resumo.inconsistenciasCount,
        regrasAprendidasCount: result.resumo.regrasNovasCount
      }, eid);

      if (onNotification) {
        onNotification(
          'Robô Fiscal - Novo Arquivo Importado',
          `Arquivo salvo "${arq.nome}" (${clienteNome}) foi detectado e processado automaticamente (${result.resumo.inconsistenciasCount} divergência(s)).`,
          result.resumo.inconsistenciasCount > 0 ? 'audit' : 'import'
        );

        if (result.resumo.regrasNovasCount > 0) {
          onNotification(
            'Novo Aprendizado Fiscal Identificado',
            `O Robô Fiscal aprendeu ${result.resumo.regrasNovasCount} novo(s) padrão(ões) tributário(s) no arquivo "${arq.nome}". Clique para revisar e aprovar na Matriz.`,
            'rule',
            'aprendizado'
          );
        }
      }

      processedIds.push(arq.id);
      novosProcessados++;
    }

    localStorage.setItem(`atlas_robo_processed_files_${eid}`, JSON.stringify(processedIds));

    return {
      arquivosEncontrados: allSavedArquivos.length,
      novosProcessados
    };
  } finally {
    robôFiscalEmExecucao = false;
  }
}

export async function processarArquivosComRobo({
  spedData,
  xmls,
  cliente,
  matrizRules,
  escritorioId,
  isSimulacao = false,
  arquivoNome
}: {
  spedData: SpedData | null;
  xmls: XmlRecord[];
  cliente?: Cliente | null;
  matrizRules: StateTaxRule[];
  escritorioId: string;
  isSimulacao?: boolean;
  arquivoNome?: string;
}): Promise<{
  inconsistencias: {
    tipo: string;
    numDoc: string;
    ncm: string;
    cstDeclarado: string;
    cstEsperado: string;
    cfopDeclarado: string;
    mensagem: string;
  }[];
  novasRegrasAprendidas: LearnedTaxRule[];
  resumo: {
    totalDocumentos: number;
    totalItensAnalisados: number;
    inconsistenciasCount: number;
    regrasNovasCount: number;
  };
}> {
  const eid = exigirEscritorio(escritorioId);
  const ufCliente = cliente?.uf || spedData?.header?.uf || 'SP';
  // Simulação nunca usa o nome do cliente real selecionado na tela — o dado
  // processado é fictício, e atribuí-lo a um cliente de verdade misturaria
  // resultado de teste com histórico real de auditoria.
  const clienteNome = isSimulacao
    ? 'Simulação de Teste (dado fictício)'
    : (cliente?.nome || spedData?.header?.nome || 'Empresa Analisada');

  const inconsistencias: {
    tipo: string;
    numDoc: string;
    ncm: string;
    cstDeclarado: string;
    cstEsperado: string;
    cfopDeclarado: string;
    mensagem: string;
  }[] = [];

  const padroesEncontrados = new Map<string, {
    uf: string;
    ncmPrefix: string;
    cst: string;
    cfop: string;
    aliqIcms?: number;
    count: number;
    descr: string;
  }>();

  let totalDocs = 0;
  let totalItens = 0;

  const itensParaIA: { docNumDoc: string; item: SpedItem }[] = [];

  if (spedData && spedData.documents) {
    totalDocs += spedData.documents.length;

    for (const doc of spedData.documents) {
      if (!doc.items) continue;

      for (const item of doc.items) {
        totalItens++;
        const ncm = (item.ncm || '').replace(/\D/g, '');
        if (!ncm || ncm.length < 2) continue;

        const ncmPrefix2 = ncm.substring(0, 2);
        const ncmPrefix4 = ncm.substring(0, 4);
        // NCM completo (6 ou 8 dígitos, o que o SPED trouxer) usado para
        // GRAVAR uma regra aprendida — nunca truncar para 4 dígitos aqui:
        // dentro da mesma posição fiscal (4 dígitos) podem existir NCMs de
        // 8 dígitos com CST/CFOP/ST diferentes, e generalizar demais faz o
        // Atlas aplicar uma correção errada a um "primo" da mesma posição.
        const ncmAprendizado = ncm.substring(0, 8);

        const matchedRule = matrizRules.find(r => 
          (r.uf === ufCliente || r.uf === 'ALL') &&
          (ncm.startsWith(r.ncmPrefix) || r.ncmPrefix === ncmPrefix4 || r.ncmPrefix === ncmPrefix2)
        );

        if (matchedRule) {
          const cstOk = item.cstIcms === matchedRule.expectedCst || item.cstIcms?.endsWith(matchedRule.expectedCst);
          const cfopOk = matchedRule.expectedCfop.length === 0 || matchedRule.expectedCfop.includes(item.cfop);

          if (!cstOk) {
            inconsistencias.push({
              tipo: 'CST_DIVERGENTE_MATRIZ',
              numDoc: doc.numDoc,
              ncm: item.ncm,
              cstDeclarado: item.cstIcms,
              cstEsperado: matchedRule.expectedCst,
              cfopDeclarado: item.cfop,
              mensagem: `CST ${item.cstIcms} diverge do padrão ${matchedRule.expectedCst} para NCM ${item.ncm} na Matriz (${matchedRule.uf}).`
            });
          } else if (!cfopOk) {
            inconsistencias.push({
              tipo: 'CFOP_DIVERGENTE_MATRIZ',
              numDoc: doc.numDoc,
              ncm: item.ncm,
              cstDeclarado: item.cstIcms,
              cstEsperado: matchedRule.expectedCst,
              cfopDeclarado: item.cfop,
              mensagem: `CFOP ${item.cfop} não consta entre os esperados [${matchedRule.expectedCfop.join(', ')}] na Matriz para NCM ${item.ncm}.`
            });
          }
        } else {
          itensParaIA.push({ docNumDoc: doc.numDoc, item });

          const patternKey = `${ufCliente}_${ncmAprendizado}_${item.cstIcms}_${item.cfop}`;
          const current = padroesEncontrados.get(patternKey) || {
            uf: ufCliente,
            ncmPrefix: ncmAprendizado,
            cst: item.cstIcms,
            cfop: item.cfop,
            aliqIcms: item.aliqIcms,
            count: 0,
            descr: item.descrItem || `Mercadoria NCM ${ncmAprendizado}`
          };
          current.count++;
          padroesEncontrados.set(patternKey, current);
        }
      }
    }

    if (itensParaIA.length > 0) {
      const aiResults = await mapWithConcurrency(itensParaIA, 5, async ({ item }) => {
        const taxInput: TaxItemInput = {
          descrItem: item.descrItem || `Mercadoria NCM ${item.ncm}`,
          ncm: item.ncm,
          cfop: item.cfop || '5102',
          cstIcms: item.cstIcms || '00',
          regimeEmpresa: cliente?.regimeTributario || 'Lucro Presumido'
        };
        try {
          return await orchestrateTaxAudit(taxInput);
        } catch (e) {
          console.warn('Erro na consulta rápida do orquestrador:', e);
          return null;
        }
      });

      aiResults.forEach((aiResult, idx) => {
        if (aiResult && aiResult.overallRisk === 'Alto') {
          const { docNumDoc, item } = itensParaIA[idx];
          inconsistencias.push({
            tipo: 'INCONSISTENCIA_ORQUESTRADOR_IA',
            numDoc: docNumDoc,
            ncm: item.ncm,
            cstDeclarado: item.cstIcms,
            cstEsperado: aiResult.suggestedCst,
            cfopDeclarado: item.cfop,
            mensagem: `[Orquestrador Multi-Agente IA] ${aiResult.finalVerdict}`
          });
        }
      });
    }
  }

  if (xmls && xmls.length > 0) {
    totalDocs += xmls.length;

    for (const xml of xmls) {
      if (!xml.items) continue;

      for (const item of xml.items) {
        totalItens++;
        const ncm = (item.ncm || '').replace(/\D/g, '');
        if (!ncm || ncm.length < 2) continue;

        const ncmPrefix4 = ncm.substring(0, 4);
        // NCM completo (6 ou 8 dígitos) para GRAVAR regra aprendida — ver
        // comentário equivalente no loop de spedData acima.
        const ncmAprendizado = ncm.substring(0, 8);

        // FCP (Fundo de Combate à Pobreza) — regra fixa: NCM 3303/3304/3305/3307,
        // 2% sobre o valor do item, só em nota de saída (tpNF === '1').
        if (xml.tpNF === '1' && NCMS_FCP_2PCT.includes(ncmPrefix4)) {
          const fcpCalculado = item.vProd * 0.02;
          const fcpDeclarado = item.vFcp || 0;
          inconsistencias.push({
            tipo: 'FCP_VALOR_CALCULADO',
            numDoc: xml.nNF,
            ncm: item.ncm,
            cstDeclarado: fcpDeclarado > 0 ? `R$ ${fcpDeclarado.toFixed(2)} (Destacado)` : `R$ 0,00 (Sem Destaque no XML)`,
            cstEsperado: `R$ ${fcpCalculado.toFixed(2)} (2% s/ R$ ${item.vProd.toFixed(2)})`,
            cfopDeclarado: item.cfop,
            mensagem: `XML NFe ${xml.nNF} (Saída): Item NCM ${item.ncm} (${item.xProd || 'Produto'}), Valor R$ ${item.vProd.toFixed(2)} — FCP Calculado (2%): R$ ${fcpCalculado.toFixed(2)}.`
          });
        }

        const matchedRule = matrizRules.find(r => 
          (r.uf === ufCliente || r.uf === 'ALL') &&
          (ncm.startsWith(r.ncmPrefix) || r.ncmPrefix === ncmPrefix4)
        );

        if (matchedRule) {
          const cstClean = item.cst.length > 2 ? item.cst.substring(1) : item.cst;
          if (cstClean !== matchedRule.expectedCst) {
            inconsistencias.push({
              tipo: 'CST_XML_DIVERGENTE_MATRIZ',
              numDoc: xml.nNF,
              ncm: item.ncm,
              cstDeclarado: item.cst,
              cstEsperado: matchedRule.expectedCst,
              cfopDeclarado: item.cfop,
              mensagem: `XML NFe ${xml.nNF}: CST ${item.cst} incompatível com a Matriz (${matchedRule.expectedCst}) para NCM ${item.ncm}.`
            });
          }
        } else {
          const cstClean = item.cst.length > 2 ? item.cst.substring(1) : item.cst;
          const patternKey = `${ufCliente}_${ncmAprendizado}_${cstClean}_${item.cfop}`;
          const current = padroesEncontrados.get(patternKey) || {
            uf: ufCliente,
            ncmPrefix: ncmAprendizado,
            cst: cstClean,
            cfop: item.cfop,
            aliqIcms: item.pIcms,
            count: 0,
            descr: item.xProd || `Produto NCM ${ncmAprendizado}`
          };
          current.count++;
          padroesEncontrados.set(patternKey, current);
        }
      }
    }
  }

  const novasRegrasAprendidas: LearnedTaxRule[] = [];
  
  for (const [, p] of padroesEncontrados) {
    const confianca = Math.min(99, 75 + Math.min(24, p.count * 3));
    
    if (p.count >= 1) {
      const learnedRule: LearnedTaxRule = {
        id: `learned_${Date.now()}_${p.ncmPrefix}_${p.cst}`,
        uf: p.uf,
        ncmPrefix: p.ncmPrefix,
        learnedCst: p.cst,
        learnedCfop: [p.cfop],
        learnedAliqIcms: p.aliqIcms,
        descricao: p.descr,
        confiancaPercentual: confianca,
        amostrasAnalisadas: p.count,
        clienteOrigem: clienteNome,
        status: 'pendente',
        criadoEm: new Date().toISOString()
      };

      novasRegrasAprendidas.push(learnedRule);
      await saveLearnedRule(learnedRule, eid);
    }
  }

  await addRoboLog({
    timestamp: new Date().toISOString(),
    clienteNome,
    arquivoNome: arquivoNome || (isSimulacao ? 'dado de exemplo (simulação)' : undefined),
    tipoAcao: inconsistencias.length > 0 ? 'INCONSISTENCIA' : 'PROCESSAMENTO',
    mensagem: isSimulacao
      ? `Simulação de teste executada — ${inconsistencias.length} divergência(s) em dado fictício, não representa cliente real.`
      : `Processamento concluído para ${clienteNome}: ${totalItens} itens analisados.`,
    detalhes: `${totalItens} itens analisados | ${inconsistencias.length} divergência(s) | ${novasRegrasAprendidas.length} padrão(ões) observado(s)`,
    inconsistenciasCount: inconsistencias.length,
    regrasAprendidasCount: novasRegrasAprendidas.length,
    isSimulacao
  }, eid);

  return {
    inconsistencias,
    novasRegrasAprendidas,
    resumo: {
      totalDocumentos: totalDocs,
      totalItensAnalisados: totalItens,
      inconsistenciasCount: inconsistencias.length,
      regrasNovasCount: novasRegrasAprendidas.length
    }
  };
}

export interface ParametrosGerarPlanoCorrecaoC170 {
  spedData?: SpedData | null;
  items?: { docNumDoc?: string; docId?: string; indOper?: string; item: SpedItem }[];
  achados?: (Achado | AuditFinding)[];
  matrizRules?: StateTaxRule[];
  cliente?: Cliente | { id?: string; nome?: string; uf?: string; regimeTributario?: RegimeTributario } | null;
  uf?: string;
  escritorioId?: string;
}

function ajustarCfopDirecao(cfop: string, indOper: string): string {
  const cleanCfop = (cfop || '').replace(/\D/g, '').padStart(4, '0');
  if (!cleanCfop || cleanCfop === '0000') return indOper === '0' ? '1102' : '5102';

  if (indOper === '1') {
    if (cleanCfop.startsWith('1')) return '5' + cleanCfop.substring(1);
    if (cleanCfop.startsWith('2')) return '6' + cleanCfop.substring(1);
    if (cleanCfop.startsWith('3')) return '7' + cleanCfop.substring(1);
  }

  if (indOper === '0') {
    if (cleanCfop.startsWith('5')) return '1' + cleanCfop.substring(1);
    if (cleanCfop.startsWith('6')) return '2' + cleanCfop.substring(1);
    if (cleanCfop.startsWith('7')) return '3' + cleanCfop.substring(1);
  }

  return cleanCfop;
}

function isCstSt(cst: string): boolean {
  const cleanCst = (cst || '').replace(/\D/g, '').padStart(3, '0');
  const sufixo = cleanCst.substring(1);
  return ['010', '030', '060', '070', '201', '202', '203', '500'].includes(cleanCst) || ['10', '30', '60', '70'].includes(sufixo);
}

function isCstSemCreditoSemIcmsProprio(cst: string): boolean {
  const cleanCst = (cst || '').replace(/\D/g, '').padStart(3, '0');
  const sufixo = cleanCst.substring(1);
  return ['040', '041', '050', '060', '090', '102', '103', '300', '400', '500'].includes(cleanCst) || ['40', '41', '50', '60', '90'].includes(sufixo);
}

/**
 * Consolida achados da auditoria e regras da Matriz em um plano de correção único por item C170,
 * garantindo coerência de CST/CFOP/ICMS e a aplicação da invariante de 'status: pendente' para qualquer aprendizado.
 */
export async function gerarPlanoCorrecaoC170(
  paramsOrSped: ParametrosGerarPlanoCorrecaoC170 | SpedData | null | undefined,
  stateTaxRulesArg?: StateTaxRule[],
  achadosArg?: (Achado | AuditFinding)[],
  agentesResultArg?: any,
  escritorioIdArg?: string
): Promise<CorrecaoItemC170[] & PlanoCorrecaoC170Result> {
  let params: ParametrosGerarPlanoCorrecaoC170;

  if (
    paramsOrSped &&
    typeof paramsOrSped === 'object' &&
    ('header' in paramsOrSped || 'documents' in paramsOrSped || 'reconciliation' in paramsOrSped)
  ) {
    // Invocação posicional: (spedData, stateTaxRules, achados, agentesResult, escritorioId)
    params = {
      spedData: paramsOrSped as SpedData,
      matrizRules: stateTaxRulesArg || [],
      achados: achadosArg || [],
      escritorioId: escritorioIdArg || (typeof agentesResultArg === 'string' ? agentesResultArg : agentesResultArg?.escritorioId)
    };
  } else if (paramsOrSped && typeof paramsOrSped === 'object') {
    params = { ...paramsOrSped } as ParametrosGerarPlanoCorrecaoC170;
    if (stateTaxRulesArg && !params.matrizRules) params.matrizRules = stateTaxRulesArg;
    if (achadosArg && !params.achados) params.achados = achadosArg;
  } else {
    params = {
      spedData: null,
      matrizRules: stateTaxRulesArg || [],
      achados: achadosArg || [],
      escritorioId: escritorioIdArg
    };
  }

  const eid = exigirEscritorio(params.escritorioId);
  const ufCliente = (params.uf || params.cliente?.uf || params.spedData?.header?.uf || 'SP').trim().toUpperCase();
  const matriz = params.matrizRules || [];
  const achados = params.achados || [];

  const itensParaProcessar: {
    docId: string;
    numDoc: string;
    indOper: string;
    item: SpedItem;
  }[] = [];

  if (params.spedData && params.spedData.documents) {
    for (const doc of params.spedData.documents) {
      if (!doc.items) continue;
      for (const item of doc.items) {
        itensParaProcessar.push({
          docId: doc.id || `doc_${doc.numDoc}`,
          numDoc: doc.numDoc || '0',
          indOper: doc.indOper || '1',
          item
        });
      }
    }
  }

  if (params.items && params.items.length > 0) {
    for (const entry of params.items) {
      itensParaProcessar.push({
        docId: entry.docId || `doc_${entry.docNumDoc || '0'}`,
        numDoc: entry.docNumDoc || '0',
        indOper: entry.indOper || '1',
        item: entry.item
      });
    }
  }

  const itensCorrecao: CorrecaoItemC170[] = [];
  const novasRegrasAprendidas: LearnedTaxRule[] = [];

  let totalCorrecoesCst = 0;
  let totalCorrecoesCfop = 0;
  let totalCorrecoesIcms = 0;

  for (let idx = 0; idx < itensParaProcessar.length; idx++) {
    const { docId, numDoc, indOper, item } = itensParaProcessar[idx];
    const ncm = (item.ncm || '').replace(/\D/g, '');
    const numItem = item.numItem || String(idx + 1);
    const codItem = item.codItem || `ITEM_${idx + 1}`;
    const descrItem = item.descrItem || `Mercadoria NCM ${ncm}`;

    const cstDeclarado = (item.cstIcms || '000').padStart(3, '0');
    const cfopDeclarado = (item.cfop || '5102').padStart(4, '0');
    const aliqIcmsDeclarada = item.aliqIcms || 0;
    const vlBcIcmsDeclarado = item.vlBcIcms || 0;
    const vlIcmsDeclarado = item.vlIcms || 0;
    const vlItem = item.vlItem || 0;

    let cstSugerido = cstDeclarado;
    let cfopSugerido = cfopDeclarado;
    let aliqIcmsSugerida = aliqIcmsDeclarada;
    let vlBcIcmsSugerido = vlBcIcmsDeclarado;
    let vlIcmsSugerido = vlIcmsDeclarado;

    const motivosInconsistencia: string[] = [];
    let fonteRegra: 'MATRIZ_TRIBUTARIA' | 'AUDITORIA_ACHADOS' | 'ORQUESTRADOR_IA' | 'APRENDIZADO_ROBO' | 'CONSOLIDADO' = 'APRENDIZADO_ROBO';

    // 1. Busca Regra Correspondente na Matriz Tributária
    const matchedRule = ncm.length >= 2 ? matriz.find(r =>
      (r.uf === ufCliente || r.uf === 'ALL') &&
      (ncm.startsWith(r.ncmPrefix) || r.ncmPrefix === ncm.substring(0, 4) || r.ncmPrefix === ncm.substring(0, 2))
    ) : undefined;

    if (matchedRule) {
      fonteRegra = 'MATRIZ_TRIBUTARIA';
      if (matchedRule.expectedCst && cstDeclarado !== matchedRule.expectedCst) {
        cstSugerido = matchedRule.expectedCst;
        motivosInconsistencia.push(`CST ${cstDeclarado} diverge da Matriz Tributária (${matchedRule.expectedCst}) para NCM ${ncm} [UF: ${matchedRule.uf}].`);
      }
      if (matchedRule.expectedCfop && matchedRule.expectedCfop.length > 0 && !matchedRule.expectedCfop.includes(cfopDeclarado)) {
        cfopSugerido = matchedRule.expectedCfop[0];
        motivosInconsistencia.push(`CFOP ${cfopDeclarado} diverge dos esperados na Matriz [${matchedRule.expectedCfop.join(', ')}].`);
      }
      if (matchedRule.expectedAliqIcms !== undefined) {
        aliqIcmsSugerida = matchedRule.expectedAliqIcms;
      }
    }

    // 2. Busca Achados da Auditoria relacionados a este item C170
    const itemAchados = achados.filter(a => {
      const docMatch = ('docId' in a && a.docId === docId) || ('numDoc' in a && a.numDoc === numDoc);
      if (!docMatch) return false;
      if ('numItem' in a && a.numItem) return a.numItem === numItem;
      if ('codItem' in a && a.codItem) return a.codItem === codItem;
      return true;
    });

    for (const achado of itemAchados) {
      if (fonteRegra === 'MATRIZ_TRIBUTARIA') {
        fonteRegra = 'CONSOLIDADO';
      } else {
        fonteRegra = 'AUDITORIA_ACHADOS';
      }

      const tituloAchado = 'titulo' in achado ? achado.titulo : achado.title;
      const descrAchado = 'descricao' in achado ? achado.descricao : achado.description;
      motivosInconsistencia.push(`Achado [${tituloAchado}]: ${descrAchado}`);

      if ('correcaoSugerida' in achado && achado.correcaoSugerida && Array.isArray(achado.correcaoSugerida)) {
        for (const corr of achado.correcaoSugerida) {
          if (corr.campo === 'cstIcms' && corr.valorSugerido !== undefined) {
            cstSugerido = String(corr.valorSugerido).padStart(3, '0');
          }
          if (corr.campo === 'cfop' && corr.valorSugerido !== undefined) {
            cfopSugerido = String(corr.valorSugerido).padStart(4, '0');
          }
          if (corr.campo === 'aliqIcms' && corr.valorSugerido !== undefined) {
            aliqIcmsSugerida = Number(corr.valorSugerido);
          }
          if (corr.campo === 'vlBcIcms' && corr.valorSugerido !== undefined) {
            vlBcIcmsSugerido = Number(corr.valorSugerido);
          }
          if (corr.campo === 'vlIcms' && corr.valorSugerido !== undefined) {
            vlIcmsSugerido = Number(corr.valorSugerido);
          }
        }
      }
    }

    // 3. Garantir Coerência de CST, CFOP e ICMS (Invariantes Fiscais)
    // a) Ajustar direção do CFOP (Entrada x Saída)
    const cfopDirecionado = ajustarCfopDirecao(cfopSugerido, indOper);
    if (cfopDirecionado !== cfopSugerido) {
      motivosInconsistencia.push(`CFOP ${cfopSugerido} corrigido para ${cfopDirecionado} para manter coerência com tipo de operação (${indOper === '1' ? 'Saída' : 'Entrada'}).`);
      cfopSugerido = cfopDirecionado;
    }

    // b) Coerência de CST ST vs CFOP ST
    const cfopsStOutbound = ['5401', '5403', '5405', '6401', '6403', '6404', '6405'];
    const cfopsStInbound = ['1401', '1403', '1409', '2401', '2403', '2409'];
    const isCfopSt = cfopsStOutbound.includes(cfopSugerido) || cfopsStInbound.includes(cfopSugerido);

    if (isCstSt(cstSugerido) && !isCfopSt) {
      if (indOper === '1') {
        cfopSugerido = cfopSugerido.startsWith('6') ? '6405' : '5405';
      } else {
        cfopSugerido = cfopSugerido.startsWith('2') ? '2403' : '1403';
      }
      motivosInconsistencia.push(`CST ${cstSugerido} (Substituição Tributária) exige CFOP correlato de ST (${cfopSugerido}).`);
    } else if (isCfopSt && !isCstSt(cstSugerido)) {
      cstSugerido = '060';
      motivosInconsistencia.push(`CFOP ${cfopSugerido} (Substituição Tributária) exige CST correlato de ST (${cstSugerido}).`);
    }

    // c) Recálculo e coerência de ICMS Próprio com precisão de duas casas decimais
    if (isCstSemCreditoSemIcmsProprio(cstSugerido)) {
      if (vlBcIcmsSugerido > 0 || vlIcmsSugerido > 0 || aliqIcmsSugerida > 0) {
        motivosInconsistencia.push(`CST ${cstSugerido} não possui destaque de ICMS próprio. BC e ICMS zerados para conformidade.`);
      }
      vlBcIcmsSugerido = 0;
      vlIcmsSugerido = 0;
      aliqIcmsSugerida = 0;
    } else if (cstSugerido === '000' || cstSugerido.endsWith('00')) {
      if (vlBcIcmsSugerido === 0 && vlItem > 0) {
        vlBcIcmsSugerido = vlItem;
      }
      if (aliqIcmsSugerida === 0) {
        aliqIcmsSugerida = matchedRule?.expectedAliqIcms || (aliqIcmsDeclarada > 0 ? aliqIcmsDeclarada : 18);
      }
      vlIcmsSugerido = Number(((vlBcIcmsSugerido * aliqIcmsSugerida) / 100).toFixed(2));
      if (Math.abs(vlIcmsSugerido - vlIcmsDeclarado) > 0.01) {
        motivosInconsistencia.push(`CST ${cstSugerido} (Tributado Integralmente): Recalculado BC R$ ${vlBcIcmsSugerido.toFixed(2)}, Alíquota ${aliqIcmsSugerida}%, ICMS R$ ${vlIcmsSugerido.toFixed(2)}.`);
      }
    }

    // 4. Invariante de Aprendizado: Novas regras aprendidas recebem SEMPRE status 'pendente'
    if (!matchedRule && ncm.length >= 2) {
      const ncmAprendizado = ncm.substring(0, 8);
      const learnedRule: LearnedTaxRule = {
        id: `learned_${Date.now()}_${ncmAprendizado}_${cstSugerido}`,
        uf: ufCliente,
        ncmPrefix: ncmAprendizado,
        learnedCst: cstSugerido,
        learnedCfop: [cfopSugerido],
        learnedAliqIcms: aliqIcmsSugerida,
        descricao: descrItem,
        confiancaPercentual: 85,
        amostrasAnalisadas: 1,
        clienteOrigem: params.cliente?.nome || params.spedData?.header?.nome || 'Cliente Auditado',
        status: 'pendente', // CLÁUSULA PÉTREA
        criadoEm: new Date().toISOString()
      };

      novasRegrasAprendidas.push(learnedRule);
      await saveLearnedRule(learnedRule, eid);
    }

    // 5. Avaliação final de necessidade de correção
    const cstMudou = cstSugerido !== cstDeclarado;
    const cfopMudou = cfopSugerido !== cfopDeclarado;
    const icmsMudou = Math.abs(vlBcIcmsSugerido - vlBcIcmsDeclarado) > 0.01 ||
                      Math.abs(vlIcmsSugerido - vlIcmsDeclarado) > 0.01 ||
                      Math.abs(aliqIcmsSugerida - aliqIcmsDeclarada) > 0.01;

    const precisaCorrecao = cstMudou || cfopMudou || icmsMudou || motivosInconsistencia.length > 0;

    if (cstMudou) totalCorrecoesCst++;
    if (cfopMudou) totalCorrecoesCfop++;
    if (icmsMudou) totalCorrecoesIcms++;

    if (!precisaCorrecao && motivosInconsistencia.length === 0) {
      motivosInconsistencia.push('Item em conformidade fiscal com Matriz e regras de auditoria.');
    }

    const itemCorrecao: CorrecaoItemC170 = {
      id: `plano_c170_${docId}_${numItem}_${codItem}`,
      docId,
      numDoc,
      numItem,
      codItem,
      descrItem,
      ncm,
      cstDeclarado,
      cfopDeclarado,
      aliqIcmsDeclarada,
      vlBcIcmsDeclarado,
      vlIcmsDeclarado,
      vlItem,
      cstSugerido,
      cfopSugerido,
      aliqIcmsSugerida,
      vlBcIcmsSugerido,
      vlIcmsSugerido,
      precisaCorrecao,
      motivosInconsistencia,
      fonteRegra,
      confiancaPercentual: 90,
      status: 'pendente' // Invariante: Todo plano de correção é gerado como 'pendente'
    };

    itensCorrecao.push(itemCorrecao);
  }

  const totalItensComCorrecao = itensCorrecao.filter(i => i.precisaCorrecao).length;

  await addRoboLog({
    timestamp: new Date().toISOString(),
    clienteNome: params.cliente?.nome || params.spedData?.header?.nome || 'Plano de Correção C170',
    tipoAcao: totalItensComCorrecao > 0 ? 'INCONSISTENCIA' : 'VALIDACAO_MATRIZ',
    mensagem: `Plano de Correção C170 gerado: ${itensCorrecao.length} itens analisados, ${totalItensComCorrecao} com necessidade de ajuste.`,
    detalhes: `CST: ${totalCorrecoesCst} ajustes | CFOP: ${totalCorrecoesCfop} ajustes | ICMS: ${totalCorrecoesIcms} ajustes | Aprendizados pendentes: ${novasRegrasAprendidas.length}`,
    inconsistenciasCount: totalItensComCorrecao,
    regrasAprendidasCount: novasRegrasAprendidas.length
  }, eid);

  const resultado = Object.assign(itensCorrecao, {
    novasRegrasAprendidas,
    resumo: {
      totalItensAnalisados: itensCorrecao.length,
      totalItensComCorrecao,
      totalCorrecoesCst,
      totalCorrecoesCfop,
      totalCorrecoesIcms
    }
  }) as CorrecaoItemC170[] & PlanoCorrecaoC170Result;

  Object.defineProperty(resultado, 'itensCorrecao', {
    get() {
      return Array.from(this);
    },
    enumerable: true,
    configurable: true
  });

  return resultado;
}
