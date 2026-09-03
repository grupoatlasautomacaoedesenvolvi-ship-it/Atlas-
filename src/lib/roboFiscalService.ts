import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db, safeWrite } from './firebase';
import { RoboConfig, RoboExecutionLog, LearnedTaxRule, StateTaxRule, SpedData, XmlRecord, Cliente, ArquivoCliente } from '../types';
import { saveGlobalStateTaxMatrix } from './matrizService';
import { orchestrateTaxAudit, TaxItemInput } from './aiOrchestrator';

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
          // Executa validação pelo Orquestrador de Agentes IA (com cache de 0 tokens para itens já conhecidos)
          try {
            const taxInput: TaxItemInput = {
              descrItem: item.descrItem || `Mercadoria NCM ${item.ncm}`,
              ncm: item.ncm,
              cfop: item.cfop || '5102',
              cstIcms: item.cstIcms || '00',
              regimeEmpresa: cliente?.regimeTributario || 'Lucro Presumido'
            };
            const aiResult = await orchestrateTaxAudit(taxInput);
            if (aiResult.overallRisk === 'Alto') {
              inconsistencias.push({
                tipo: 'INCONSISTENCIA_ORQUESTRADOR_IA',
                numDoc: doc.numDoc,
                ncm: item.ncm,
                cstDeclarado: item.cstIcms,
                cstEsperado: aiResult.suggestedCst,
                cfopDeclarado: item.cfop,
                mensagem: `[Orquestrador Multi-Agente IA] ${aiResult.finalVerdict}`
              });
            }
          } catch (e) {
            console.warn('Erro na consulta rápida do orquestrador:', e);
          }

          const patternKey = `${ufCliente}_${ncmPrefix4}_${item.cstIcms}_${item.cfop}`;
          const current = padroesEncontrados.get(patternKey) || {
            uf: ufCliente,
            ncmPrefix: ncmPrefix4,
            cst: item.cstIcms,
            cfop: item.cfop,
            aliqIcms: item.aliqIcms,
            count: 0,
            descr: item.descrItem || `Mercadoria NCM ${ncmPrefix4}`
          };
          current.count++;
          padroesEncontrados.set(patternKey, current);
        }
      }
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
          const patternKey = `${ufCliente}_${ncmPrefix4}_${cstClean}_${item.cfop}`;
          const current = padroesEncontrados.get(patternKey) || {
            uf: ufCliente,
            ncmPrefix: ncmPrefix4,
            cst: cstClean,
            cfop: item.cfop,
            aliqIcms: item.pIcms,
            count: 0,
            descr: item.xProd || `Produto NCM ${ncmPrefix4}`
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
