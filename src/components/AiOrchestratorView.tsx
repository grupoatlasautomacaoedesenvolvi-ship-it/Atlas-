import React, { useState, useEffect } from 'react';
import {
  Bot,
  BrainCircuit,
  Sparkles,
  Zap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Database,
  Cpu,
  Layers,
  Search,
  Key,
  Trash2,
  RefreshCw,
  ArrowRight,
  FileCheck,
  TrendingDown,
  Info,
  Sliders,
  Settings,
  Check,
  RotateCcw,
  Terminal,
  BarChart3,
  Brain,
  MessageSquarePlus,
  Send
} from 'lucide-react';
import {
  orchestrateTaxAudit,
  getMemoryStats,
  clearTaxMemory,
  TaxItemInput,
  MultiAgentAuditResult,
  MemoryStats,
  ApiKeysConfig,
  ArcaPipelineConfig,
  loadArcaConfig,
  saveArcaConfig,
  DEFAULT_ARCA_CONFIG
} from '../lib/aiOrchestrator';
import { SpedData, XmlRecord, C170AgentLogEntry, AgentPerformanceMetrics } from '../types';
import { C170AgentConferenceLog } from './C170AgentConferenceLog';
import { AgentPerformanceDashboard } from './AgentPerformanceDashboard';
import { AgentErrorReportModal } from './AgentErrorReportModal';
import { AgentFeedbackCenter } from './AgentFeedbackCenter';
import { calculateAgentPerformanceMetrics, getStoredC170Logs } from '../lib/agentFeedbackService';

interface AiOrchestratorViewProps {
  spedData?: SpedData | null;
  xmlRecords?: XmlRecord[];
  onApplyCorrectionToSped?: (itemIndex: number, newNcm: string, newCst: string, newCfop: string) => void;
}

export function AiOrchestratorView({
  spedData,
  xmlRecords,
  onApplyCorrectionToSped
}: AiOrchestratorViewProps) {
  // Navigation Tabs State
  const [activeMainTab, setActiveMainTab] = useState<'dashboard' | 'terminal_c170' | 'auditoria' | 'feedback_center' | 'configuracao'>('dashboard');

  // Real-time Logs State
  const [liveLogs, setLiveLogs] = useState<C170AgentLogEntry[]>(() => getStoredC170Logs());

  // Error Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportItem, setSelectedReportItem] = useState<{
    descrItem: string;
    ncm?: string;
    cstIcms?: string;
    cfop?: string;
    suggestedNcm?: string;
    suggestedCst?: string;
    suggestedCfop?: string;
    docNum?: string;
    itemNum?: string;
  }>({ descrItem: '' });

  // ARCA Pipeline Config State
  const [arcaConfig, setArcaConfig] = useState<ArcaPipelineConfig>(() => loadArcaConfig());
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Stats State
  const [stats, setStats] = useState<MemoryStats>(getMemoryStats());

  // API Keys state
  const [showKeysModal, setShowKeysModal] = useState(false);
  const [openAiKey, setOpenAiKey] = useState<string>(() => localStorage.getItem('atlas_openai_key') || '');
  const [anthropicKey, setAnthropicKey] = useState<string>(() => localStorage.getItem('atlas_anthropic_key') || '');
  const [geminiKey, setGeminiKey] = useState<string>(() => localStorage.getItem('atlas_gemini_key') || '');

  // Simulator State
  const [simItem, setSimItem] = useState<TaxItemInput>({
    descrItem: 'CERVEJA PURO MALTE LATA 350ML',
    ncm: '22030000',
    cfop: '5102',
    cstIcms: '00',
    origem: '0',
    regimeEmpresa: 'Lucro Presumido'
  });

  const [loadingSim, setLoadingSim] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simResult, setSimResult] = useState<MultiAgentAuditResult | null>(null);

  // Batch State
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [batchResults, setBatchResults] = useState<MultiAgentAuditResult[]>([]);
  const [filterRisk, setFilterRisk] = useState<'Todos' | 'Alto' | 'Médio' | 'Baixo'>('Todos');

  // Load stats periodically
  useEffect(() => {
    refreshStats();
  }, []);

  const refreshStats = () => {
    setStats(getMemoryStats());
  };

  const handleLogEntry = (entry: C170AgentLogEntry) => {
    setLiveLogs(prev => [entry, ...prev]);
  };

  const handleOpenReport = (item: {
    descrItem: string;
    ncm?: string;
    cstIcms?: string;
    cfop?: string;
    suggestedNcm?: string;
    suggestedCst?: string;
    suggestedCfop?: string;
    docNum?: string;
    itemNum?: string;
  }) => {
    setSelectedReportItem(item);
    setReportModalOpen(true);
  };

  const handleSaveKeys = () => {
    localStorage.setItem('atlas_openai_key', openAiKey);
    localStorage.setItem('atlas_anthropic_key', anthropicKey);
    localStorage.setItem('atlas_gemini_key', geminiKey);
    setShowKeysModal(false);
  };

  const handleSaveArcaConfig = () => {
    saveArcaConfig(arcaConfig);
    setSaveMessage('Configurações do Agente salvas.');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const handleResetArcaConfig = () => {
    setArcaConfig(DEFAULT_ARCA_CONFIG);
    saveArcaConfig(DEFAULT_ARCA_CONFIG);
    setSaveMessage('Configurações restauradas para o padrão inicial.');
    setTimeout(() => setSaveMessage(null), 3500);
  };

  const updateAgentSetting = (
    agentKey: 'agent1' | 'agent2' | 'agent3',
    field: string,
    value: any
  ) => {
    setArcaConfig((prev) => ({
      ...prev,
      agents: {
        ...prev.agents,
        [agentKey]: {
          ...prev.agents[agentKey],
          [field]: value
        }
      }
    }));
  };

  const handleClearKeys = () => {
    setOpenAiKey('');
    setAnthropicKey('');
    setGeminiKey('');
    localStorage.removeItem('atlas_openai_key');
    localStorage.removeItem('atlas_anthropic_key');
    localStorage.removeItem('atlas_gemini_key');
  };

  const handleClearMemory = () => {
    if (confirm('Deseja realmente limpar a memória de cache semântico de tributação? Isso reiniciará os contadores de tokens economizados.')) {
      clearTaxMemory();
      setBatchResults([]);
      setSimResult(null);
      refreshStats();
    }
  };

  // Run Single Item Simulation
  const handleRunSimulation = async () => {
    setLoadingSim(true);
    setSimResult(null);
    setSimStep(1); // Step 1: Memory lookup

    await new Promise((r) => setTimeout(r, 400));
    setSimStep(2); // Step 2: Agent 1 & Agent 2

    await new Promise((r) => setTimeout(r, 500));
    setSimStep(3); // Step 3: Agent 3 Consensus

    const apiKeysConfig: ApiKeysConfig = {
      geminiKey: geminiKey || undefined,
      openAiKey: openAiKey || undefined,
      anthropicKey: anthropicKey || undefined
    };

    try {
      const res = await orchestrateTaxAudit(
        simItem,
        apiKeysConfig,
        arcaConfig,
        { docNum: 'SIM-001', itemNum: '1' },
        handleLogEntry
      );
      setSimResult(res);
      refreshStats();
    } catch (err) {
      console.error('Erro na auditoria:', err);
    } finally {
      setLoadingSim(false);
      setSimStep(0);
    }
  };

  // Run Batch Audit for active SPED items
  const handleRunBatchAudit = async () => {
    if (!spedData || !spedData.items0200 || spedData.items0200.length === 0) {
      alert('Nenhum item do Bloco 0200 ou C170 encontrado no SPED atual para auditar.');
      return;
    }

    setBatchLoading(true);
    const total = Math.min(spedData.items0200.length, 100); // Audit up to 100 items per batch
    setBatchProgress({ current: 0, total });

    const results: MultiAgentAuditResult[] = [];
    const apiKeysConfig: ApiKeysConfig = {
      geminiKey: geminiKey || undefined,
      openAiKey: openAiKey || undefined,
      anthropicKey: anthropicKey || undefined
    };

    // Try to pair with C170 documents if available
    const c170ItemsMap = new Map<string, { docNum: string; itemNum: string }>();
    if (spedData.documents) {
      spedData.documents.forEach(doc => {
        doc.items.forEach(it => {
          c170ItemsMap.set(it.codItem, { docNum: doc.numDoc, itemNum: it.numItem });
        });
      });
    }

    for (let i = 0; i < total; i++) {
      const it = spedData.items0200[i];
      const docContext = c170ItemsMap.get(it.codItem) || { docNum: `DOC-${String(i+1).padStart(3, '0')}`, itemNum: String(i+1) };

      const itemInput: TaxItemInput = {
        codItem: it.codItem,
        descrItem: it.descrItem,
        ncm: it.ncm,
        cfop: '5102', // Default se não informado no 0200
        cstIcms: it.cstIcmsPadrao || '00',
        cest: it.cest || '',
        origem: '0'
      };

      try {
        const auditRes = await orchestrateTaxAudit(
          itemInput,
          apiKeysConfig,
          arcaConfig,
          docContext,
          handleLogEntry
        );
        results.push(auditRes);
      } catch (e) {
        console.error('Erro ao auditar item:', e);
      }

      setBatchProgress({ current: i + 1, total });
    }

    setBatchResults(results);
    refreshStats();
    setBatchLoading(false);
  };

  // Filtered Batch items
  const filteredBatchResults = batchResults.filter((r) => {
    if (filterRisk === 'Todos') return true;
    return r.overallRisk === filterRisk;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Disclaimer Banner */}
      <div className="bg-[#faf1e0] border border-[#e0c88a] text-[#7a5b14] rounded-md px-4 py-2 text-sm font-medium">
        Recurso em validação. Os pareceres da IA são sugestões e devem sempre ser
        conferidos por um auditor antes de qualquer decisão fiscal.
      </div>

      {/* Header Panel */}
      <div className="bg-white text-[#2c2c2a] rounded-lg p-6 border border-[#e5e2d9] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#1e3a5f] rounded-lg shadow-2xs">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1e3a5f]">
                  Verificação por IA (em validação)
                </h1>
              </div>
              <p className="text-[#5f5e5a] text-xs font-semibold mt-0.5">
                Três agentes de IA analisam a classificação fiscal e sugerem revisões
              </p>
              <p className="text-[#5f5e5a] text-xs sm:text-sm mt-1">
                A análise passa por três etapas: classificação NCM/CST, verificação de CFOP e revisão consolidada. Os resultados são sugestões que exigem revisão do auditor.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowKeysModal(true)}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 shadow-2xs"
            >
              <Key className="w-4 h-4 text-[#1e3a5f]" />
              <span>Configurar Provedores de IA</span>
            </button>

            <button
              onClick={handleClearMemory}
              title="Limpar Memória de Cache IA"
              className="p-2 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-700 border border-slate-200 rounded-lg transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Architecture Badges */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[#e5e2d9]">
          <div className="bg-slate-50 border border-[#e5e2d9] rounded-lg p-3 flex items-start space-x-3">
            <div className="p-2 bg-[#f1efe8] text-[#1e3a5f] rounded-lg">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Etapa 1 — Classificação (NCM/CST)</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Análise técnica de itens, enquadramento de NCM, CEST e incidência de Substituição Tributária ou Monofásico.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-[#e5e2d9] rounded-lg p-3 flex items-start space-x-3">
            <div className="p-2 bg-emerald-50 text-[#0f6e56] rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Etapa 2 — Operações (CFOP)</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Verificação de coerência entre entradas e saídas, validação de CFOP e compatibilidade com o regime tributário.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-[#e5e2d9] rounded-lg p-3 flex items-start space-x-3">
            <div className="p-2 bg-[#f1efe8] text-[#1e3a5f] rounded-lg">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Etapa 3 — Revisão consolidada</p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Instância revisora que consolida os pareceres técnicos e emite a sugestão final de conformidade.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={() => setActiveMainTab('dashboard')}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeMainTab === 'dashboard'
                ? 'bg-white text-[#1e3a5f] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-[#1e3a5f]" />
            <span>Dashboard de Performance</span>
          </button>

          <button
            onClick={() => setActiveMainTab('terminal_c170')}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeMainTab === 'terminal_c170'
                ? 'bg-white text-[#1e3a5f] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Terminal className="w-4 h-4 text-[#0f6e56]" />
            <span>Agente de Conferência C170</span>
            {batchLoading && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            )}
          </button>

          <button
            onClick={() => setActiveMainTab('auditoria')}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeMainTab === 'auditoria'
                ? 'bg-white text-[#1e3a5f] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <BrainCircuit className="w-4 h-4 text-emerald-600" />
            <span>Auditoria & Simulação C170</span>
          </button>

          <button
            onClick={() => setActiveMainTab('feedback_center')}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeMainTab === 'feedback_center'
                ? 'bg-white text-[#1e3a5f] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Brain className="w-4 h-4 text-amber-600" />
            <span>Central de Feedback & Prompts</span>
          </button>

          <button
            onClick={() => setActiveMainTab('configuracao')}
            className={`px-3.5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 ${
              activeMainTab === 'configuracao'
                ? 'bg-white text-[#1e3a5f] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Sliders className="w-4 h-4 text-slate-600" />
            <span>Parâmetros de Agente</span>
          </button>
        </div>

        {saveMessage && (
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center space-x-1.5 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

      {/* VIEW: DASHBOARD DE PERFORMANCE */}
      {activeMainTab === 'dashboard' && (
        <AgentPerformanceDashboard
          metrics={calculateAgentPerformanceMetrics(batchResults)}
        />
      )}

      {/* VIEW: AGENTE DE CONFERÊNCIA C170 - LOGS EM TEMPO REAL */}
      {activeMainTab === 'terminal_c170' && (
        <C170AgentConferenceLog
          liveLogs={liveLogs}
          isProcessing={batchLoading || loadingSim}
          onClearLogs={() => setLiveLogs([])}
        />
      )}

      {/* VIEW: CENTRAL DE FEEDBACK DE PROMPTS */}
      {activeMainTab === 'feedback_center' && (
        <AgentFeedbackCenter />
      )}

      {/* VIEW 1: AUDITORIA & SIMULAÇÃO */}
      {activeMainTab === 'auditoria' && (
        <>
          {/* Memory Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-1 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Otimização de Tokens</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalTokensSaved.toLocaleString('pt-BR')} <span className="text-xs font-semibold text-slate-500">tokens</span>
              </div>
              <p className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1">
                <TrendingDown className="w-3 h-3" />
                <span>Economia Estimada: R$ {stats.estimatedMoneySavedBrl.toFixed(2)}</span>
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Aproveitamento de Cache</span>
                <Database className="w-4 h-4 text-[#1e3a5f]" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.hitRatePercent}%
              </div>
              <p className="text-[11px] text-slate-500">
                {stats.cacheHits} consultas otimizadas por cache
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Registros Indexados</span>
                <Sparkles className="w-4 h-4 text-[#0f6e56]" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.memoryEntriesCount}
              </div>
              <p className="text-[11px] text-slate-500">
                Itens com histórico de auditoria
              </p>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total de Auditorias Realizadas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">
                {stats.totalAudited}
              </div>
              <p className="text-[11px] text-slate-500">
                {stats.cacheMisses} execuções de pipeline analítico
              </p>
            </div>
          </div>
        </>
      )}

      {/* Simulator Section */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="text-base font-bold text-slate-900">
              Simulador de Auditoria Frugal por Item
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Teste qualquer produto individualmente
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Descrição do Produto
            </label>
            <input
              type="text"
              value={simItem.descrItem}
              onChange={(e) => setSimItem({ ...simItem, descrItem: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              placeholder="Ex: CERVEJA LATA 350ML, REFRIGERANTE, PARAFUSO SEST..."
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              NCM Atual
            </label>
            <input
              type="text"
              value={simItem.ncm}
              onChange={(e) => setSimItem({ ...simItem, ncm: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              placeholder="Ex: 22030000"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CFOP Atual
            </label>
            <input
              type="text"
              value={simItem.cfop}
              onChange={(e) => setSimItem({ ...simItem, cfop: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              placeholder="Ex: 5102"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              CST/CSOSN ICMS
            </label>
            <input
              type="text"
              value={simItem.cstIcms}
              onChange={(e) => setSimItem({ ...simItem, cstIcms: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
              placeholder="Ex: 000, 060, 500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Regime Tributário
            </label>
            <select
              value={simItem.regimeEmpresa}
              onChange={(e) => setSimItem({ ...simItem, regimeEmpresa: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            >
              <option value="Lucro Presumido">Lucro Presumido</option>
              <option value="Lucro Real">Lucro Real</option>
              <option value="Simples Nacional">Simples Nacional</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleRunSimulation}
            disabled={loadingSim || !simItem.descrItem || !simItem.ncm}
            className="px-5 py-2.5 bg-[#1e3a5f] hover:bg-[#142c47] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {loadingSim ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Orquestrando Agentes...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Executar Auditoria Multi-Agente</span>
              </>
            )}
          </button>
        </div>

        {/* Loading Step Animation */}
        {loadingSim && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center space-x-3 text-xs font-bold text-slate-700">
              <span className={`w-2 h-2 rounded-full ${simStep >= 1 ? 'bg-[#1e3a5f] animate-ping' : 'bg-slate-300'}`} />
              <span>1. Consultando Memória Semântica Frugal (0 tokens se houver cache)...</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-bold text-slate-700">
              <span className={`w-2 h-2 rounded-full ${simStep >= 2 ? 'bg-[#1e3a5f] animate-ping' : 'bg-slate-300'}`} />
              <span>2. Agente 1 (NCM/CST) & Agente 2 (CFOP/Operação) analisando em paralelo...</span>
            </div>
            <div className="flex items-center space-x-3 text-xs font-bold text-slate-700">
              <span className={`w-2 h-2 rounded-full ${simStep >= 3 ? 'bg-[#0f6e56] animate-ping' : 'bg-slate-300'}`} />
              <span>3. Agente 3 (Consenso & Auditor Chefe) unificando veredito...</span>
            </div>
          </div>
        )}

        {/* Simulation Output Card */}
        {simResult && !loadingSim && (
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-5 animate-fadeIn">
            {/* Verdict Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div className="flex items-center space-x-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                    simResult.overallRisk === 'Alto'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : simResult.overallRisk === 'Médio'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  }`}
                >
                  {simResult.overallRisk === 'Alto' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  ) : simResult.overallRisk === 'Médio' ? (
                    <Info className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>Risco Fiscal {simResult.overallRisk}</span>
                </span>

                <span className="text-xs font-bold text-slate-600">
                  Assertividade: <strong className="text-[#1e3a5f]">{simResult.confidenceScore}%</strong>
                </span>
              </div>

              <div>
                {simResult.fromCache ? (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center space-x-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>Resolvido via Memória (0 Tokens Consumidos)</span>
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9] flex items-center space-x-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#1e3a5f]" />
                    <span>Pipeline Executada ({simResult.tokensUsed} tokens)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Verdict Text */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 space-y-1">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider">
                Parecer Conclusivo do Auditor Chefe (Agente 3)
              </h4>
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {simResult.finalVerdict}
              </p>
            </div>

            {/* Suggestion Table Comparison */}
            <div className="overflow-x-auto bg-white rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Parâmetro Fiscal</th>
                    <th className="p-3">Informado Atualmente</th>
                    <th className="p-3">Sugerido pela IA Multi-Agente</th>
                    <th className="p-3">Status de Conformidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="p-3 font-bold text-slate-900">NCM (Classificação)</td>
                    <td className="p-3 font-mono">{simItem.ncm}</td>
                    <td className="p-3 font-mono font-bold text-[#1e3a5f]">{simResult.suggestedNcm}</td>
                    <td className="p-3">
                      {simItem.ncm === simResult.suggestedNcm ? (
                        <span className="text-[#0f6e56] font-bold">✓ Conforme</span>
                      ) : (
                        <span className="text-rose-700 font-bold">⚠️ Recomenda Alteração</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-slate-900">CST ICMS</td>
                    <td className="p-3 font-mono">{simItem.cstIcms}</td>
                    <td className="p-3 font-mono font-bold text-[#1e3a5f]">{simResult.suggestedCst}</td>
                    <td className="p-3">
                      {simItem.cstIcms === simResult.suggestedCst ? (
                        <span className="text-[#0f6e56] font-bold">✓ Conforme</span>
                      ) : (
                        <span className="text-rose-700 font-bold">⚠️ Recomenda Alteração</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td className="p-3 font-bold text-slate-900">CFOP Operacional</td>
                    <td className="p-3 font-mono">{simItem.cfop}</td>
                    <td className="p-3 font-mono font-bold text-[#1e3a5f]">{simResult.suggestedCfop}</td>
                    <td className="p-3">
                      {simItem.cfop === simResult.suggestedCfop ? (
                        <span className="text-[#0f6e56] font-bold">✓ Conforme</span>
                      ) : (
                        <span className="text-rose-700 font-bold">⚠️ Recomenda Alteração</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Individual Agent Reasoning Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Agente 1 (NCM/CST)</span>
                  <span className="text-[10px] text-slate-500">{simResult.agent1NcmCst.modelUsed}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {simResult.agent1NcmCst.notes}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Agente 2 (CFOP/Operação)</span>
                  <span className="text-[10px] text-slate-500">{simResult.agent2CfopOperacao.modelUsed}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {simResult.agent2CfopOperacao.notes}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-900">
                  <span>Agente 3 (Sintetizador)</span>
                  <span className="text-[10px] text-slate-500">{simResult.agent3Consenso.modelUsed}</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {simResult.agent3Consenso.notes}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Batch Audit for SPED Current Document */}
      {spedData && spedData.items0200 && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <FileCheck className="w-5 h-5 text-[#1e3a5f]" />
                <span>Auditoria em Lote do SPED Atual (Bloco 0200)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {spedData.items0200.length} produtos cadastrados no arquivo SPED Fiscal carregado.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleRunBatchAudit}
                disabled={batchLoading}
                className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {batchLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Auditando {batchProgress.current}/{batchProgress.total}...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Auditar Itens do SPED com Memória</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          {batchResults.length > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-600">Filtrar por Risco:</span>
                {(['Todos', 'Alto', 'Médio', 'Baixo'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setFilterRisk(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      filterRisk === r
                        ? 'bg-[#1e3a5f] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Mostrando {filteredBatchResults.length} de {batchResults.length} auditados
              </span>
            </div>
          )}

          {/* Results Table */}
          {batchResults.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Descrição do Produto</th>
                    <th className="p-3">NCM Atual vs Sugerido</th>
                    <th className="p-3">CST Atual vs Sugerido</th>
                    <th className="p-3">Risco</th>
                    <th className="p-3">Veredito do Orquestrador</th>
                    <th className="p-3 text-right">Ações de Refinamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredBatchResults.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3">
                        {item.fromCache ? (
                          <span
                            title="Auditado via Memória (0 Tokens)"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center space-x-1 w-fit"
                          >
                            <Zap className="w-3 h-3 text-amber-600" />
                            <span>0 Tokens</span>
                          </span>
                        ) : (
                          <span
                            title="Auditado via Pipeline Multi-IA"
                            className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#f1efe8] text-[#1e3a5f] border border-[#e5e2d9] flex items-center space-x-1 w-fit"
                          >
                            <Bot className="w-3 h-3 text-[#1e3a5f]" />
                            <span>Multi-IA</span>
                          </span>
                        )}
                      </td>

                      <td className="p-3 font-bold text-slate-900 max-w-xs truncate">
                        {item.descrItem}
                      </td>

                      <td className="p-3">
                        <span className="font-mono text-slate-600">{item.itemKey.split('_')[0]}</span>
                        {item.suggestedNcm !== item.itemKey.split('_')[0] && (
                          <span className="font-mono font-bold text-rose-600 ml-1.5">
                            → {item.suggestedNcm}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span className="font-mono text-slate-600">{item.itemKey.split('_')[1]}</span>
                        {item.suggestedCst !== item.itemKey.split('_')[1] && (
                          <span className="font-mono font-bold text-rose-600 ml-1.5">
                            → {item.suggestedCst}
                          </span>
                        )}
                      </td>

                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.overallRisk === 'Alto'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : item.overallRisk === 'Médio'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {item.overallRisk}
                        </span>
                      </td>

                      <td className="p-3 text-slate-600 max-w-sm truncate" title={item.finalVerdict}>
                        {item.finalVerdict}
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenReport({
                            descrItem: item.descrItem,
                            ncm: item.itemKey.split('_')[0],
                            cstIcms: item.itemKey.split('_')[1],
                            cfop: item.itemKey.split('_')[2],
                            suggestedNcm: item.suggestedNcm,
                            suggestedCst: item.suggestedCst,
                            suggestedCfop: item.suggestedCfop
                          })}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 ml-auto shadow-2xs cursor-pointer"
                          title="Enviar feedback para aprendizado do prompt"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Reportar Erro Agente</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: PAINEL DE CONFIGURAÇÃO */}
      {activeMainTab === 'configuracao' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Header Action Bar */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-[#1e3a5f]" />
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  Matriz de Configuração dos Agentes de IA
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Selecione quais modelos de IA atuam em cada etapa da auditoria, defina níveis de criticidade e os focos operacionais.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetArcaConfig}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões</span>
              </button>

              <button
                onClick={handleSaveArcaConfig}
                className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar configuração</span>
              </button>
            </div>
          </div>

          {/* Global Pipeline Strictness */}
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <Settings className="w-4 h-4 text-[#1e3a5f]" />
              <span>1. Diretriz Global de Rigor e Memória</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nível de Rigor da Pipeline Fiscal
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Rigorosa', 'Equilibrada', 'Permissiva'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setArcaConfig((prev) => ({ ...prev, globalStrictness: mode }))}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                        arcaConfig.globalStrictness === mode
                          ? mode === 'Rigorosa'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : mode === 'Equilibrada'
                            ? 'bg-[#f1efe8] text-[#1e3a5f] border-[#1e3a5f]'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {arcaConfig.globalStrictness === 'Rigorosa' && 'Rigor Máximo: qualquer desvio de NCM, CST ou CFOP gera notificação de Risco Alto.'}
                  {arcaConfig.globalStrictness === 'Equilibrada' && 'Equilibrado: validações segundo regras oficiais SEFAZ com margem de adequação.'}
                  {arcaConfig.globalStrictness === 'Permissiva' && 'Permissivo: aciona alertas apenas para incongruências graves de transmissão.'}
                </p>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <Database className="w-4 h-4 text-[#1e3a5f]" />
                    <span>Memória Semântica de Frugalidade (Cache de 0 Tokens)</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Evita consultas repetidas para os mesmos produtos reutilizando pareceres anteriores sem consumo de tokens.
                  </p>
                </div>

                <input
                  type="checkbox"
                  checked={arcaConfig.cacheEnabled}
                  onChange={(e) => setArcaConfig((prev) => ({ ...prev, cacheEnabled: e.target.checked }))}
                  className="w-5 h-5 text-[#1e3a5f] rounded-md focus:ring-[#1e3a5f] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Individual Agent Configuration Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-[#1e3a5f]" />
              <span>2. Configuração Individual dos Agentes de IA</span>
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* AGENTE 1: ANALISTA NCM/CST */}
              <div className={`bg-white rounded-lg border transition-all p-5 space-y-4 ${
                arcaConfig.agents.agent1.active ? 'border-[#e5e2d9] shadow-sm' : 'border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#f1efe8] text-[#1e3a5f] rounded-lg">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center space-x-1">
                        <span>{arcaConfig.agents.agent1.moduleCode}</span>
                        <span className="text-[10px] bg-[#f1efe8] text-[#1e3a5f] px-2 py-0.5 rounded-md font-bold">NCM/CST</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Mapeamento & Classificação Fiscal</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={arcaConfig.agents.agent1.active}
                    onChange={(e) => updateAgentSetting('agent1', 'active', e.target.checked)}
                    className="w-4 h-4 text-[#1e3a5f] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Provedor de Inteligência Artificial
                    </label>
                    <select
                      value={arcaConfig.agents.agent1.provider}
                      onChange={(e) => {
                        const prov = e.target.value as 'gemini' | 'openai' | 'claude';
                        const model = prov === 'gemini' ? 'gemini-2.5-flash' : prov === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet';
                        updateAgentSetting('agent1', 'provider', prov);
                        updateAgentSetting('agent1', 'modelName', model);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1e3a5f]"
                    >
                      <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro)</option>
                      <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                      <option value="claude">Anthropic Claude (Claude 3.5 Sonnet)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nível de Criticidade
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Alta', 'Média', 'Baixa'] as const).map((crit) => (
                        <button
                          key={crit}
                          onClick={() => updateAgentSetting('agent1', 'criticality', crit)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                            arcaConfig.agents.agent1.criticality === crit
                              ? 'bg-[#1e3a5f] text-white border-[#142c47]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {crit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Foco Prioritário
                    </label>
                    <select
                      value={arcaConfig.agents.agent1.priorityFocus}
                      onChange={(e) => updateAgentSetting('agent1', 'priorityFocus', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1e3a5f]"
                    >
                      <option value="Classificação NCM/CST">Classificação NCM/CST/CEST (Padrão)</option>
                      <option value="Análise de Isenções e Monofásicos">Destaque de Monofásicos & Isenções PIS/COFINS</option>
                      <option value="Validação de CST ICMS">Validação Avançada de CST ICMS e ST</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AGENTE 2: AUDITOR OPERACIONAL */}
              <div className={`bg-white rounded-lg border transition-all p-5 space-y-4 ${
                arcaConfig.agents.agent2.active ? 'border-emerald-200 shadow-sm' : 'border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-100 text-[#0f6e56] rounded-lg">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center space-x-1">
                        <span>{arcaConfig.agents.agent2.moduleCode}</span>
                        <span className="text-[10px] bg-emerald-100 text-[#0f6e56] px-2 py-0.5 rounded-md font-bold">CFOP/Operação</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Fluxos Operacionais & CFOP</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={arcaConfig.agents.agent2.active}
                    onChange={(e) => updateAgentSetting('agent2', 'active', e.target.checked)}
                    className="w-4 h-4 text-[#0f6e56] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Provedor de Inteligência Artificial
                    </label>
                    <select
                      value={arcaConfig.agents.agent2.provider}
                      onChange={(e) => {
                        const prov = e.target.value as 'gemini' | 'openai' | 'claude';
                        const model = prov === 'gemini' ? 'gemini-2.5-flash' : prov === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet';
                        updateAgentSetting('agent2', 'provider', prov);
                        updateAgentSetting('agent2', 'modelName', model);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#0f6e56]"
                    >
                      <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                      <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro)</option>
                      <option value="claude">Anthropic Claude (Claude 3.5 Sonnet)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nível de Criticidade
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Alta', 'Média', 'Baixa'] as const).map((crit) => (
                        <button
                          key={crit}
                          onClick={() => updateAgentSetting('agent2', 'criticality', crit)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                            arcaConfig.agents.agent2.criticality === crit
                              ? 'bg-[#0f6e56] text-white border-[#0b5341]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {crit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Foco Prioritário
                    </label>
                    <select
                      value={arcaConfig.agents.agent2.priorityFocus}
                      onChange={(e) => updateAgentSetting('agent2', 'priorityFocus', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#0f6e56]"
                    >
                      <option value="Operações & CFOP">Incompatibilidade Entrada vs Saída (Padrão)</option>
                      <option value="Cruze de Regimes Tributários">Cruze de Regime (Simples vs Lucro Real/Presumido)</option>
                      <option value="Validação de Operações Interestaduais">Operações Interestaduais e Alíquotas do CFOP</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* AGENTE 3: CONSELHO FISCAL */}
              <div className={`bg-white rounded-lg border transition-all p-5 space-y-4 ${
                arcaConfig.agents.agent3.active ? 'border-[#e5e2d9] shadow-sm' : 'border-slate-200 opacity-60'
              }`}>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-[#f1efe8] text-[#1e3a5f] rounded-lg">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center space-x-1">
                        <span>{arcaConfig.agents.agent3.moduleCode}</span>
                        <span className="text-[10px] bg-[#f1efe8] text-[#1e3a5f] px-2 py-0.5 rounded-md font-bold">Consenso</span>
                      </h4>
                      <p className="text-[11px] text-slate-500">Auditor Chefe & Parecerista Final</p>
                    </div>
                  </div>

                  <input
                    type="checkbox"
                    checked={arcaConfig.agents.agent3.active}
                    onChange={(e) => updateAgentSetting('agent3', 'active', e.target.checked)}
                    className="w-4 h-4 text-[#1e3a5f] rounded cursor-pointer"
                  />
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Provedor de Inteligência Artificial
                    </label>
                    <select
                      value={arcaConfig.agents.agent3.provider}
                      onChange={(e) => {
                        const prov = e.target.value as 'gemini' | 'openai' | 'claude';
                        const model = prov === 'gemini' ? 'gemini-2.5-flash' : prov === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet';
                        updateAgentSetting('agent3', 'provider', prov);
                        updateAgentSetting('agent3', 'modelName', model);
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1e3a5f]"
                    >
                      <option value="claude">Anthropic Claude (Claude 3.5 Sonnet)</option>
                      <option value="gemini">Google Gemini (Gemini 2.5 Flash / Pro)</option>
                      <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nível de Criticidade
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['Alta', 'Média', 'Baixa'] as const).map((crit) => (
                        <button
                          key={crit}
                          onClick={() => updateAgentSetting('agent3', 'criticality', crit)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all ${
                            arcaConfig.agents.agent3.criticality === crit
                              ? 'bg-[#1e3a5f] text-white border-[#142c47]'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {crit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Foco Prioritário
                    </label>
                    <select
                      value={arcaConfig.agents.agent3.priorityFocus}
                      onChange={(e) => updateAgentSetting('agent3', 'priorityFocus', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-[#1e3a5f]"
                    >
                      <option value="Consenso & Juiz Final">Síntese de Consenso & Veredito Final (Padrão)</option>
                      <option value="Blindagem Antiautuação Fiscal">Blindagem Preventiva para Malha Fina</option>
                      <option value="Relatório Orientativo para o Contador">Relatório Orientativo Detalhado para Contabilidade</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Pipeline Preview Card */}
          <div className="bg-white text-[#2c2c2a] rounded-lg p-5 border border-[#e5e2d9] shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-[#e5e2d9] pb-2">
              <h4 className="text-xs font-bold text-[#1e3a5f] uppercase tracking-wider flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-[#1e3a5f]" />
                <span>Resumo da Configuração de IA</span>
              </h4>
              <span className="text-[11px] font-mono text-slate-500">Rigor: {arcaConfig.globalStrictness}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-[#e5e2d9]">
                <p className="font-bold text-[#1e3a5f]">{arcaConfig.agents.agent1.moduleCode}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Provedor: <strong className="text-slate-900">{arcaConfig.agents.agent1.provider.toUpperCase()}</strong> | Criticidade: <strong className="text-slate-900">{arcaConfig.agents.agent1.criticality}</strong>
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-[#e5e2d9]">
                <p className="font-bold text-[#0f6e56]">{arcaConfig.agents.agent2.moduleCode}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Provedor: <strong className="text-slate-900">{arcaConfig.agents.agent2.provider.toUpperCase()}</strong> | Criticidade: <strong className="text-slate-900">{arcaConfig.agents.agent2.criticality}</strong>
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-[#e5e2d9]">
                <p className="font-bold text-[#1e3a5f]">{arcaConfig.agents.agent3.moduleCode}</p>
                <p className="text-slate-600 text-[11px] mt-0.5">
                  Provedor: <strong className="text-slate-900">{arcaConfig.agents.agent3.provider.toUpperCase()}</strong> | Criticidade: <strong className="text-slate-900">{arcaConfig.agents.agent3.criticality}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for API Keys Configuration */}
      {showKeysModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-sm space-y-5 border border-slate-200 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Key className="w-5 h-5 text-[#1e3a5f]" />
                <h3 className="text-base font-bold text-slate-900">
                  Configuração de Chaves de IA
                </h3>
              </div>
              <button
                onClick={() => setShowKeysModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O orquestrador pode integrar chamadas diretas às APIs do OpenAI (GPT-4o), Anthropic (Claude 3.5 Sonnet) e Gemini. Caso não informe chaves personalizadas, o sistema executará com o modelo Gemini nativo configurado no servidor.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  OpenAI API Key (Opcional - GPT-4o)
                </label>
                <input
                  type="password"
                  value={openAiKey}
                  onChange={(e) => setOpenAiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Anthropic API Key (Opcional - Claude 3.5)
                </label>
                <input
                  type="password"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Gemini API Key (Opcional)
                </label>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                onClick={handleClearKeys}
                className="px-3 py-1.5 text-xs text-rose-600 font-bold hover:underline cursor-pointer"
              >
                Remover Chaves
              </button>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowKeysModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveKeys}
                  className="px-4 py-2 bg-[#1e3a5f] text-white font-bold text-xs rounded-lg hover:bg-[#142c47] shadow-sm cursor-pointer"
                >
                  Salvar Preferências
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Report Modal */}
      <AgentErrorReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        itemData={selectedReportItem}
        onReportSaved={() => refreshStats()}
      />
    </div>
  );
}
