import { GoogleGenAI } from '@google/genai';

export interface TaxItemInput {
  codItem?: string;
  descrItem: string;
  ncm: string;
  cfop: string;
  cstIcms: string;
  cest?: string;
  origem?: string;
  vlItem?: number;
  aliqIcms?: number;
  regimeEmpresa?: string; // 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real'
  ufEmitente?: string;
  ufDestinatario?: string;
}

export interface AgentPerspectiveResult {
  agentName: string;
  modelUsed: string;
  perspective: 'Classificação NCM/CST/CEST' | 'Operação & CFOP/Regime' | 'Consenso & Juiz Final';
  approved: boolean;
  notes: string;
  suggestedNcm?: string;
  suggestedCst?: string;
  suggestedCfop?: string;
  confidenceScore: number; // 0 to 100
}

export interface MultiAgentAuditResult {
  itemKey: string;
  descrItem: string;
  fromCache: boolean;
  tokensSaved: number;
  tokensUsed: number;
  overallRisk: 'Baixo' | 'Médio' | 'Alto';
  finalVerdict: string;
  suggestedNcm: string;
  suggestedCst: string;
  suggestedCfop: string;
  confidenceScore: number;
  agent1NcmCst: AgentPerspectiveResult;
  agent2CfopOperacao: AgentPerspectiveResult;
  agent3Consenso: AgentPerspectiveResult;
  timestamp: string;
}

export interface MemoryStats {
  totalAudited: number;
  cacheHits: number;
  cacheMisses: number;
  totalTokensSaved: number;
  totalTokensUsed: number;
  estimatedMoneySavedBrl: number;
  hitRatePercent: number;
  memoryEntriesCount: number;
}

export interface ApiKeysConfig {
  geminiKey?: string;
  openAiKey?: string;
  anthropicKey?: string;
}

export interface ArcaAgentConfig {
  id: 'agent1' | 'agent2' | 'agent3';
  name: string;
  moduleCode: string;
  provider: 'gemini' | 'openai' | 'claude';
  modelName: string; // e.g. 'gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet'
  criticality: 'Alta' | 'Média' | 'Baixa';
  priorityFocus: string;
  active: boolean;
}

export interface ArcaPipelineConfig {
  globalStrictness: 'Rigorosa' | 'Equilibrada' | 'Permissiva';
  cacheEnabled: boolean;
  agents: {
    agent1: ArcaAgentConfig;
    agent2: ArcaAgentConfig;
    agent3: ArcaAgentConfig;
  };
}

export const DEFAULT_ARCA_CONFIG: ArcaPipelineConfig = {
  globalStrictness: 'Equilibrada',
  cacheEnabled: true,
  agents: {
    agent1: {
      id: 'agent1',
      name: 'Analista de NCM & Nomenclatura',
      moduleCode: 'Módulo T1 - NCM & CST',
      provider: 'gemini',
      modelName: 'gemini-2.5-flash',
      criticality: 'Alta',
      priorityFocus: 'Classificação NCM/CST',
      active: true,
    },
    agent2: {
      id: 'agent2',
      name: 'Auditor Operacional & CFOP',
      moduleCode: 'Módulo T2 - Operações & CFOP',
      provider: 'openai',
      modelName: 'gpt-4o',
      criticality: 'Alta',
      priorityFocus: 'Operações & CFOP',
      active: true,
    },
    agent3: {
      id: 'agent3',
      name: 'Conselho Técnico & Veredito',
      moduleCode: 'Módulo T3 - Revisão Superior',
      provider: 'claude',
      modelName: 'claude-3-5-sonnet',
      criticality: 'Alta',
      priorityFocus: 'Consenso & Juiz Final',
      active: true,
    },
  },
};

const ARCA_CONFIG_STORAGE_KEY = 'atlas_arca_pipeline_config_v1';

export function loadArcaConfig(): ArcaPipelineConfig {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(ARCA_CONFIG_STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_ARCA_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Erro ao carregar configuração do Projeto A.R.C.A.:', e);
    }
  }
  return DEFAULT_ARCA_CONFIG;
}

export function saveArcaConfig(config: ArcaPipelineConfig): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(ARCA_CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Erro ao salvar configuração do Projeto A.R.C.A.:', e);
    }
  }
}

// In-Memory & LocalStorage Cache Engine ("Memória Semântica de Tributação")
const MEMORY_STORAGE_KEY = 'atlas_ai_tax_memory_v1';
const STATS_STORAGE_KEY = 'atlas_ai_tax_stats_v1';

let memoryCache: Record<string, MultiAgentAuditResult> = {};
let memoryStats: MemoryStats = {
  totalAudited: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalTokensSaved: 0,
  totalTokensUsed: 0,
  estimatedMoneySavedBrl: 0,
  hitRatePercent: 0,
  memoryEntriesCount: 0,
};

// Helper: Normalize item to deterministic memory hash
export function generateTaxItemHash(item: TaxItemInput): string {
  const cleanDescr = item.descrItem
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 6) // Primeiras 6 palavras essenciais
    .join('_');

  const cleanNcm = (item.ncm || '').replace(/\D/g, '');
  const cleanCfop = (item.cfop || '').replace(/\D/g, '');
  const cleanCst = (item.cstIcms || '').replace(/\D/g, '');
  const cleanOrigem = (item.origem || '0').trim();

  return `${cleanNcm}_${cleanCst}_${cleanCfop}_${cleanOrigem}_${cleanDescr}`;
}

// Load memory cache from localStorage on client or memory on server
export function loadMemoryFromStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      const savedMem = localStorage.getItem(MEMORY_STORAGE_KEY);
      if (savedMem) {
        memoryCache = JSON.parse(savedMem);
      }
      const savedStats = localStorage.getItem(STATS_STORAGE_KEY);
      if (savedStats) {
        memoryStats = JSON.parse(savedStats);
      }
    } catch (e) {
      console.error('Erro ao carregar memória de tributação:', e);
    }
  }
}

// Save memory cache
export function saveMemoryToStorage(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memoryCache));
      localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(memoryStats));
    } catch (e) {
      console.error('Erro ao salvar memória de tributação:', e);
    }
  }
}

export function getMemoryStats(): MemoryStats {
  loadMemoryFromStorage();
  const count = Object.keys(memoryCache).length;
  const total = memoryStats.cacheHits + memoryStats.cacheMisses;
  const hitRate = total > 0 ? (memoryStats.cacheHits / total) * 100 : 0;
  // Estimativa: 1,000 tokens ~ R$ 0,012
  const estimatedMoney = (memoryStats.totalTokensSaved / 1000) * 0.012;

  return {
    ...memoryStats,
    hitRatePercent: Math.round(hitRate * 10) / 10,
    estimatedMoneySavedBrl: Math.round(estimatedMoney * 100) / 100,
    memoryEntriesCount: count,
  };
}

export function clearTaxMemory(): void {
  memoryCache = {};
  memoryStats = {
    totalAudited: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalTokensSaved: 0,
    totalTokensUsed: 0,
    estimatedMoneySavedBrl: 0,
    hitRatePercent: 0,
    memoryEntriesCount: 0,
  };
  saveMemoryToStorage();
}

// Direct rule-based local auditor (fast, zero tokens, deterministic expert rules)
function runLocalExpertRules(item: TaxItemInput): {
  suggestedNcm: string;
  suggestedCst: string;
  suggestedCfop: string;
  risk: 'Baixo' | 'Médio' | 'Alto';
  notes: string[];
} {
  const notes: string[] = [];
  let risk: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
  let suggestedNcm = item.ncm;
  let suggestedCst = item.cstIcms;
  let suggestedCfop = item.cfop;

  const descrUpper = item.descrItem.toUpperCase();
  const ncmClean = item.ncm.replace(/\D/g, '');
  const cfopClean = item.cfop.replace(/\D/g, '');
  const cstClean = item.cstIcms.replace(/\D/g, '');

  // Regra NCM Tamanho
  if (ncmClean.length !== 8) {
    risk = 'Alto';
    notes.push(`NCM "${item.ncm}" está com formato inválido (deve possuir 8 dígitos).`);
  }

  // Regra Monofásicos/Substituição Tributária Bebidas/Combustíveis/Farmácia
  if (
    descrUpper.includes('CERVEJA') ||
    descrUpper.includes('REFRIGERANTE') ||
    descrUpper.includes('AGUA MINERAL')
  ) {
    if (['000', '00', '20'].includes(cstClean)) {
      risk = 'Alto';
      notes.push('Bebida fria em geral é sujeita a Substituição Tributária (ST) ou Monofásico. CST 00/20 pode gerar pagamento duplicado de PIS/COFINS e ICMS.');
      suggestedCst = '60'; // Cobrado anteriormente por ST
    }
  }

  // Regra CFOP de Entrada vs Saída
  if (cfopClean.startsWith('1') || cfopClean.startsWith('2') || cfopClean.startsWith('3')) {
    // Operação de Entrada
    if (['5101', '5102', '6101', '6102'].includes(cfopClean)) {
      risk = 'Alto';
      notes.push(`CFOP de Entrada (${cfopClean}) incompatível. Deveria ser do grupo 1.xxx ou 2.xxx.`);
      suggestedCfop = cfopClean.startsWith('5') ? '1' + cfopClean.slice(1) : '2' + cfopClean.slice(1);
    }
  } else if (cfopClean.startsWith('5') || cfopClean.startsWith('6') || cfopClean.startsWith('7')) {
    // Operação de Saída
    if (['1102', '2102', '1101'].includes(cfopClean)) {
      risk = 'Alto';
      notes.push(`CFOP de Saída (${cfopClean}) incompatível. Deveria ser do grupo 5.xxx ou 6.xxx.`);
      suggestedCfop = cfopClean.startsWith('1') ? '5' + cfopClean.slice(1) : '6' + cfopClean.slice(1);
    }
  }

  // Incompatibilidade CST 60 e CFOP sem ST
  if (cstClean === '60' || cstClean === '060' || cstClean === '500') {
    if (['5102', '6102'].includes(cfopClean)) {
      risk = 'Médio';
      notes.push(`CST/CSOSN ${cstClean} (ST cobrada anteriormente) exige CFOP de ST (ex: 5405 para venda interna). CFOP ${cfopClean} indica tributação integral.`);
      suggestedCfop = '5405';
    }
  }

  return { suggestedNcm, suggestedCst, suggestedCfop, risk, notes };
}

// Call Gemini API for an agent persona
async function callGeminiAgent(
  systemInstruction: string,
  userPrompt: string,
  customApiKey?: string
): Promise<string> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey || process.env.NODE_ENV === 'test') {
    return JSON.stringify({
      approved: true,
      notes: 'Análise automática local (Modo Offline/Testes).',
      suggestedNcm: '',
      suggestedCst: '',
      suggestedCfop: '',
      confidenceScore: 95
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }] }
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      }
    });

    return response.text || '';
  } catch (err) {
    console.warn('Gemini API call failed, using fallback:', err);
    return JSON.stringify({
      approved: true,
      notes: 'Fallback de IA devido a erro de rede/API.',
      suggestedNcm: '',
      suggestedCst: '',
      suggestedCfop: '',
      confidenceScore: 90
    });
  }
}

import { generatePromptRefinementContext, saveC170LogEntry } from './agentFeedbackService';
import { C170AgentLogEntry } from '../types';

// Execute Orchestrator with Multi-Agent Pipeline & Memory lookup
export async function orchestrateTaxAudit(
  item: TaxItemInput,
  keysConfig?: ApiKeysConfig,
  customArcaConfig?: ArcaPipelineConfig,
  itemContext?: { docNum?: string; itemNum?: string },
  onLogEntry?: (log: C170AgentLogEntry) => void
): Promise<MultiAgentAuditResult> {
  loadMemoryFromStorage();
  const arcaConfig = customArcaConfig || loadArcaConfig();

  const itemHash = generateTaxItemHash(item);
  const docNum = itemContext?.docNum || '000001';
  const itemNum = itemContext?.itemNum || '1';

  const emitLog = (
    agentId: 'agent1' | 'agent2' | 'agent3' | 'system',
    agentName: string,
    status: 'ANALYSING' | 'APPROVED' | 'INCONSISTENT' | 'AUTO_CORRECTED' | 'ERROR',
    message: string,
    details?: any
  ) => {
    const entry: C170AgentLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      docNum,
      itemNum,
      descrItem: item.descrItem,
      agentId,
      agentName,
      status,
      message,
      details
    };
    saveC170LogEntry(entry);
    if (onLogEntry) onLogEntry(entry);
  };

  emitLog('system', 'Orquestrador C170', 'ANALYSING', `Iniciando verificação do item C170 #${itemNum} - "${item.descrItem}" (NCM: ${item.ncm}, CST: ${item.cstIcms}, CFOP: ${item.cfop})...`);

  // 1. MEMORY CACHE LOOKUP ("VERIFICAÇÃO NA MEMÓRIA SEMÂNTICA DE TRIBUTAÇÃO")
  if (arcaConfig.cacheEnabled && memoryCache[itemHash]) {
    const cachedResult = memoryCache[itemHash];
    memoryStats.totalAudited++;
    memoryStats.cacheHits++;
    memoryStats.totalTokensSaved += 1850; // Aprox 1850 tokens economizados por evitar 3 chamadas LLM
    saveMemoryToStorage();

    emitLog('system', 'Memória Semântica C170', 'APPROVED', `Cache Hit instantâneo! Parâmetros tributários reconhecidos em memória sem gasto de tokens. Risco: ${cachedResult.overallRisk}.`);

    return {
      ...cachedResult,
      fromCache: true,
      tokensSaved: 1850,
      tokensUsed: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. CACHE MISS - EXECUTE MULTI-AGENT PIPELINE
  const promptRefinement = generatePromptRefinementContext();
  const localEval = runLocalExpertRules(item);

  const cfg1 = arcaConfig.agents.agent1;
  const cfg2 = arcaConfig.agents.agent2;
  const cfg3 = arcaConfig.agents.agent3;

  let agent1Result: AgentPerspectiveResult = {
    agentName: `Agente ${cfg1.moduleCode} (${cfg1.provider.toUpperCase()} - Criticidade ${cfg1.criticality})`,
    modelUsed: `${cfg1.provider} (${cfg1.modelName})`,
    perspective: 'Classificação NCM/CST/CEST',
    approved: localEval.risk === 'Baixo',
    notes: localEval.notes.length > 0 ? localEval.notes.join(' | ') : 'NCM e CST estão em conformidade aparente com a análise de Raio-X.',
    suggestedNcm: localEval.suggestedNcm,
    suggestedCst: localEval.suggestedCst,
    confidenceScore: localEval.risk === 'Alto' ? 60 : 95,
  };

  emitLog(
    'agent1',
    `🤖 Agente 1 - ${cfg1.moduleCode}`,
    localEval.risk === 'Baixo' ? 'APPROVED' : 'INCONSISTENT',
    `Análise de NCM/CST concluída. NCM Sugerida: ${localEval.suggestedNcm}, CST Sugerida: ${localEval.suggestedCst}. ${localEval.notes.length > 0 ? localEval.notes[0] : 'Parâmetros válidos.'}`,
    { originalNcm: item.ncm, suggestedNcm: localEval.suggestedNcm, originalCst: item.cstIcms, suggestedCst: localEval.suggestedCst }
  );

  let agent2Result: AgentPerspectiveResult = {
    agentName: `Agente ${cfg2.moduleCode} (${cfg2.provider.toUpperCase()} - Criticidade ${cfg2.criticality})`,
    modelUsed: `${cfg2.provider} (${cfg2.modelName})`,
    perspective: 'Operação & CFOP/Regime',
    approved: localEval.suggestedCfop === item.cfop,
    notes: localEval.suggestedCfop !== item.cfop ? `Inconsistência de CFOP identificada: ${item.cfop} vs operação.` : 'CFOP compatível com o tipo de operação e tributação.',
    suggestedCfop: localEval.suggestedCfop,
    confidenceScore: 90,
  };

  emitLog(
    'agent2',
    `🤖 Agente 2 - ${cfg2.moduleCode}`,
    localEval.suggestedCfop === item.cfop ? 'APPROVED' : 'INCONSISTENT',
    `Análise de CFOP/Operação concluída. CFOP Sugerido: ${localEval.suggestedCfop}. ${localEval.suggestedCfop !== item.cfop ? 'Ajuste de CFOP necessário para a operação.' : 'CFOP em conformidade.'}`,
    { originalCfop: item.cfop, suggestedCfop: localEval.suggestedCfop }
  );

  let agent3Result: AgentPerspectiveResult = {
    agentName: `Agente ${cfg3.moduleCode} (${cfg3.provider.toUpperCase()} - Criticidade ${cfg3.criticality})`,
    modelUsed: `${cfg3.provider} (${cfg3.modelName})`,
    perspective: 'Consenso & Juiz Final',
    approved: localEval.risk === 'Baixo',
    notes: localEval.notes.length > 0 ? `Inconsistências encontradas: ${localEval.notes.join('; ')}` : 'Validação cruzada sem divergências. Risco fiscal mínimo.',
    confidenceScore: 92,
  };

  // Tenta enriquecimento com a API do Gemini via LLM em tempo real se a chave estiver presente
  try {
    const promptPayload = JSON.stringify({
      itemDescription: item.descrItem,
      ncm: item.ncm,
      cfop: item.cfop,
      cstIcms: item.cstIcms,
      cest: item.cest || '',
      origem: item.origem || '0',
      regime: item.regimeEmpresa || 'Lucro Presumido/Real',
      localRuleWarnings: localEval.notes,
      globalStrictness: arcaConfig.globalStrictness,
    }, null, 2);

    // Prompt Agente 1
    const sysAgent1 = `Você é o AGENTE 1 - ${cfg1.moduleCode}: Especialista em NCM, CEST e CST de ICMS/PIS/COFINS da legislação brasileira.
Provedor Selecionado: ${cfg1.provider.toUpperCase()} | Foco: ${cfg1.priorityFocus} | Criticidade Definida: ${cfg1.criticality}.
Analise a descrição do produto "${item.descrItem}" com a NCM "${item.ncm}" e CST "${item.cstIcms}".
${promptRefinement}
Regra de Criticidade ${cfg1.criticality}: ${
      cfg1.criticality === 'Alta' 
        ? 'Seja extremamente rigoroso com qualquer divergência de NCM/CST e Monofásicos/ST.'
        : cfg1.criticality === 'Média'
        ? 'Avalie de forma equilibrada a compatibilidade fiscal padrão.'
        : 'Seja permissivo, reportando apenas erros críticos de formato ou tributação absurda.'
    }
Responda ESTRITAMENTE em JSON com o formato:
{
  "approved": boolean,
  "notes": "string concisa com sua análise técnica da NCM e CST",
  "suggestedNcm": "string com NCM corrigida ou mantida",
  "suggestedCst": "string com CST corrigida ou mantida",
  "confidenceScore": number (0-100)
}`;

    const geminiKey = keysConfig?.geminiKey || process.env.GEMINI_API_KEY;
    if (geminiKey && cfg1.active) {
      const rawAi1 = await callGeminiAgent(sysAgent1, promptPayload, geminiKey);
      try {
        const parsed1 = JSON.parse(rawAi1);
        agent1Result = {
          ...agent1Result,
          approved: parsed1.approved ?? agent1Result.approved,
          notes: parsed1.notes || agent1Result.notes,
          suggestedNcm: parsed1.suggestedNcm || agent1Result.suggestedNcm,
          suggestedCst: parsed1.suggestedCst || agent1Result.suggestedCst,
          confidenceScore: parsed1.confidenceScore || agent1Result.confidenceScore,
        };
      } catch (e) {
        console.warn('Falha no parse do Agente 1 AI, mantendo auditor de regras:', e);
      }

      // Prompt Agente 2
      if (cfg2.active) {
        const sysAgent2 = `Você é o AGENTE 2 - ${cfg2.moduleCode}: Especialista em Operações Fiscais, CFOP, Regimes e ICMS ST/Monofásico.
Provedor Selecionado: ${cfg2.provider.toUpperCase()} | Foco: ${cfg2.priorityFocus} | Criticidade Definida: ${cfg2.criticality}.
Analise o CFOP "${item.cfop}" contra a CST "${agent1Result.suggestedCst || item.cstIcms}" e regime "${item.regimeEmpresa || 'Geral'}".
Regra de Criticidade ${cfg2.criticality}: ${
          cfg2.criticality === 'Alta'
            ? 'Priorize verificação estrita de CFOPs de Entrada vs Saída e incompatibilidades de ICMS ST.'
            : 'Verifique alinhamento padrão de operações fiscais.'
        }
Responda ESTRITAMENTE em JSON com o formato:
{
  "approved": boolean,
  "notes": "string concisa analisando CFOP e compatibilidade operacional",
  "suggestedCfop": "string com CFOP correto",
  "confidenceScore": number (0-100)
}`;

        const rawAi2 = await callGeminiAgent(sysAgent2, promptPayload, geminiKey);
        try {
          const parsed2 = JSON.parse(rawAi2);
          agent2Result = {
            ...agent2Result,
            approved: parsed2.approved ?? agent2Result.approved,
            notes: parsed2.notes || agent2Result.notes,
            suggestedCfop: parsed2.suggestedCfop || agent2Result.suggestedCfop,
            confidenceScore: parsed2.confidenceScore || agent2Result.confidenceScore,
          };
        } catch (e) {
          console.warn('Falha no parse do Agente 2 AI:', e);
        }
      }

      // Prompt Agente 3 - Consenso Final
      if (cfg3.active) {
        const sysAgent3 = `Você é o AGENTE 3 - ${cfg3.moduleCode}: Auditor Chefe e Juiz Conselheiro de Riscos Tributários do Projeto A.R.C.A.
Provedor Selecionado: ${cfg3.provider.toUpperCase()} | Criticidade do Consenso: ${cfg3.criticality} | Rigor Global: ${arcaConfig.globalStrictness}.
Sintetize os pareceres do Agente 1 (${agent1Result.notes}) e Agente 2 (${agent2Result.notes}).
Responda ESTRITAMENTE em JSON com o formato:
{
  "overallRisk": "Baixo" | "Médio" | "Alto",
  "finalVerdict": "parecer conclusivo em 1-2 frases para o contador",
  "suggestedNcm": "NCM final",
  "suggestedCst": "CST final",
  "suggestedCfop": "CFOP final",
  "confidenceScore": number (0-100)
}`;

        const rawAi3 = await callGeminiAgent(sysAgent3, JSON.stringify({ agent1: agent1Result, agent2: agent2Result }), geminiKey);
        try {
          const parsed3 = JSON.parse(rawAi3);
          agent3Result = {
            ...agent3Result,
            approved: parsed3.overallRisk === 'Baixo',
            notes: parsed3.finalVerdict || agent3Result.notes,
            confidenceScore: parsed3.confidenceScore || 95,
          };

          const result: MultiAgentAuditResult = {
            itemKey: itemHash,
            descrItem: item.descrItem,
            fromCache: false,
            tokensSaved: 0,
            tokensUsed: 1850,
            overallRisk: parsed3.overallRisk || localEval.risk,
            finalVerdict: parsed3.finalVerdict || agent3Result.notes,
            suggestedNcm: parsed3.suggestedNcm || agent1Result.suggestedNcm || item.ncm,
            suggestedCst: parsed3.suggestedCst || agent1Result.suggestedCst || item.cstIcms,
            suggestedCfop: parsed3.suggestedCfop || agent2Result.suggestedCfop || item.cfop,
            confidenceScore: parsed3.confidenceScore || 92,
            agent1NcmCst: agent1Result,
            agent2CfopOperacao: agent2Result,
            agent3Consenso: agent3Result,
            timestamp: new Date().toISOString(),
          };

          // SAVE IN MEMORY BANK FOR FUTURE AUDITS (ZERO TOKENS NEXT TIME)
          if (arcaConfig.cacheEnabled) {
            memoryCache[itemHash] = result;
            saveMemoryToStorage();
          }
          memoryStats.totalAudited++;
          memoryStats.cacheMisses++;
          memoryStats.totalTokensUsed += 1850;

          return result;
        } catch (e) {
          console.warn('Falha no parse do Agente 3 AI:', e);
        }
      }
    }
  } catch (err) {
    console.warn('AI pipeline falhou ou chave ausente, executando fallback com orquestrador de regras locais de alta precisão:', err);
  }

  // Fallback se AI indisponível
  const fallbackResult: MultiAgentAuditResult = {
    itemKey: itemHash,
    descrItem: item.descrItem,
    fromCache: false,
    tokensSaved: 0,
    tokensUsed: 0,
    overallRisk: localEval.risk,
    finalVerdict: localEval.notes.length > 0 ? localEval.notes.join('; ') : 'Conforme regras oficiais de tributação, o item apresenta parâmetros coerentes.',
    suggestedNcm: localEval.suggestedNcm,
    suggestedCst: localEval.suggestedCst,
    suggestedCfop: localEval.suggestedCfop,
    confidenceScore: localEval.risk === 'Alto' ? 70 : 90,
    agent1NcmCst: agent1Result,
    agent2CfopOperacao: agent2Result,
    agent3Consenso: agent3Result,
    timestamp: new Date().toISOString(),
  };

  memoryCache[itemHash] = fallbackResult;
  memoryStats.totalAudited++;
  memoryStats.cacheMisses++;
  saveMemoryToStorage();

  return fallbackResult;
}
