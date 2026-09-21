import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bot, 
  Play, 
  Pause, 
  RefreshCw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Sparkles, 
  Database, 
  FileText, 
  Upload, 
  FolderTree, 
  Activity, 
  ShieldCheck, 
  Sliders, 
  ArrowRight, 
  Clock, 
  BrainCircuit, 
  Trash2, 
  Check, 
  X, 
  FileSpreadsheet,
  Building2,
  HardDrive
} from 'lucide-react';
import { 
  RoboConfig, 
  RoboExecutionLog, 
  LearnedTaxRule, 
  StateTaxRule, 
  Cliente, 
  SpedData, 
  XmlRecord 
} from '../types';
import { 
  getRoboConfig, 
  saveRoboConfig, 
  getRoboLogs, 
  getLearnedRules, 
  approveLearnedRule, 
  rejectLearnedRule, 
  processarArquivosComRobo,
  addRoboLog,
  verificarEProcessarArquivosSalvos
} from '../lib/roboFiscalService';
import { parseSpedContent, parseXmlFiles } from '../lib/clientParser';
import { useRoboData } from '../lib/useRoboData';
import { FolderWatcherPanel } from './FolderWatcherPanel';

interface RoboFiscalViewProps {
  clientes: Cliente[];
  matrizRules: StateTaxRule[];
  onSaveMatrix: (rules: StateTaxRule[]) => void;
  activeClienteId: string | null;
  addNotification: (title: string, message: string, type: 'system' | 'import' | 'audit' | 'export' | 'rule') => void;
  escritorioId?: string;
  initialTab?: 'overview' | 'processador' | 'aprendizado' | 'logs' | 'pastas' | 'config';
}

export function RoboFiscalView({
  clientes,
  matrizRules,
  onSaveMatrix,
  activeClienteId,
  addNotification,
  escritorioId,
  initialTab = 'overview'
}: RoboFiscalViewProps) {
  // Navigation Tabs inside Robo Fiscal
  const [activeTab, setActiveTab] = useState<'overview' | 'processador' | 'aprendizado' | 'logs' | 'pastas' | 'config'>(initialTab);

  // Filters for Logs
  const [logSearchTerm, setLogSearchTerm] = useState('');
  const [logTypeFilter, setLogTypeFilter] = useState<string>('todos');

  // On-demand Processing State
  const [selectedClienteForRun, setSelectedClienteForRun] = useState<string>(activeClienteId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [lastProcessResult, setLastProcessResult] = useState<{
    inconsistencias: any[];
    novasRegrasAprendidas: LearnedTaxRule[];
    resumo: {
      totalDocumentos: number;
      totalItensAnalisados: number;
      inconsistenciasCount: number;
      regrasNovasCount: number;
    };
  } | null>(null);

  const effectiveEscritorioId = escritorioId;

  const { config, setConfig, logs, setLogs, learnedRules, setLearnedRules, loading, recarregar, alternarAtivo } =
    useRoboData(effectiveEscritorioId, /* comRegrasAprendidas */ true);

  // Toggle Robot Active / Pause
  const handleToggleActive = async () => {
    const updated = await alternarAtivo();
    if (updated) {
      addNotification(
        'Robô Fiscal', 
        updated.ativo ? 'O Robô Fiscal foi ativado para monitorar importações.' : 'O Robô Fiscal foi pausado.',
        'system'
      );
    }
  };

  // Handle Save Config Form
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveEscritorioId) return;
    await saveRoboConfig(config, effectiveEscritorioId);
    addNotification('Configurações Salvas', 'As preferências do Robô Fiscal foram atualizadas com sucesso.', 'system');
  };

  // Approve Learned Rule
  const handleApproveRule = async (ruleId: string) => {
    if (!effectiveEscritorioId) return;
    try {
      await approveLearnedRule(ruleId, matrizRules, effectiveEscritorioId, onSaveMatrix);
      await recarregar();

      addNotification(
        'Regra Integrada', 
        'A nova regra fiscal foi aprovada e adicionada diretamente à Matriz Tributária.', 
        'rule'
      );
    } catch (e) {
      console.error('Erro ao aprovar regra:', e);
      alert('Erro ao integrar regra na Matriz Tributária.');
    }
  };

  // Reject Learned Rule
  const handleRejectRule = async (ruleId: string) => {
    if (!effectiveEscritorioId) return;
    await rejectLearnedRule(ruleId, effectiveEscritorioId);
    await recarregar();
  };

  // Handle Manual Execution / Batch File Drop
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedFiles(Array.from(e.target.files));
    }
  };

  // Núcleo compartilhado entre execução real e simulação — antes duplicado
  // quase por inteiro nas duas funções. A única diferença de verdade entre
  // elas é de onde vem o SPED: arquivo enviado pelo usuário, ou o texto de
  // exemplo fixo usado só para demonstração.
  const executarEAtualizar = async (
    spedData: SpedData | null,
    xmlsParaProcessar: XmlRecord[],
    opts: { isSimulacao: boolean; nomeSucesso: string; nomeErro: string }
  ) => {
    if (!effectiveEscritorioId) return;
    setIsProcessing(true);
    setProcessProgress(opts.isSimulacao ? 20 : 15);

    try {
      const clienteObj = opts.isSimulacao
        ? null // simulação nunca usa o cliente selecionado — dado é fictício
        : (clientes.find(c => c.id === selectedClienteForRun) || clientes[0] || null);

      setProcessProgress(80);

      const result = await processarArquivosComRobo({
        spedData,
        xmls: xmlsParaProcessar,
        cliente: clienteObj,
        matrizRules,
        escritorioId: effectiveEscritorioId,
        isSimulacao: opts.isSimulacao
      });

      setProcessProgress(100);
      setLastProcessResult(result);
      await recarregar();

      addNotification(
        opts.nomeSucesso,
        opts.isSimulacao
          ? `Simulação executada: ${result.resumo.inconsistenciasCount} divergência(s) encontrada(s) em dado de exemplo, não representa cliente real.`
          : `Robô analisou os arquivos: ${result.resumo.inconsistenciasCount} inconsistência(s) e ${result.resumo.regrasNovasCount} regra(s) nova(s).`,
        'audit'
      );
    } catch (err) {
      console.error(opts.nomeErro, err);
      alert(opts.isSimulacao ? 'Erro ao executar simulação de teste.' : 'Erro ao processar os arquivos com o Robô Fiscal.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteRobo = async () => {
    if (uploadedFiles.length === 0) {
      alert('Por favor, selecione ao menos um arquivo SPED ou XML para o Robô analisar.');
      return;
    }
    if (!effectiveEscritorioId) return;

    let parsedSped: SpedData | null = null;
    let parsedXmls: XmlRecord[] = [];
    const xmlFilesToParse: File[] = [];

    for (const file of uploadedFiles) {
      if (file.name.toLowerCase().endsWith('.txt')) {
        const text = await file.text();
        parsedSped = await parseSpedContent(text);
      } else if (file.name.toLowerCase().endsWith('.xml') || file.name.toLowerCase().endsWith('.zip')) {
        xmlFilesToParse.push(file);
      }
    }

    if (xmlFilesToParse.length > 0) {
      parsedXmls = await parseXmlFiles(xmlFilesToParse);
    }

    await executarEAtualizar(parsedSped, parsedXmls, {
      isSimulacao: false,
      nomeSucesso: 'Execução Concluída',
      nomeErro: 'Erro no processamento do robô:'
    });
  };

  // Dado de exemplo só para demonstração — nunca é um cliente real, e o
  // resultado nunca é atribuído a um cliente real (ver executarEAtualizar).
  const SPED_EXEMPLO_SIMULACAO = `|0000|016|0|01012025|31012025|EMPRESA EXEMPLO COMERCIO LTDA|12345678000199||SP|123456789|123456|3550308||3|1|
|0200|ITEM001|OLEO DIESEL S10|||L|01|27101921||27|18.00|
|0200|ITEM002|REFRIGERANTE LATA 350ML|||UN|01|22021000||27|18.00|
|C100|0|1|FOR001|55|001|1|101|35250112345678000199550010000001011234567890|01012025|01012025|2500.00|0.00|2500.00|2500.00|450.00|0.00|0.00|0.00|0.00|
|C170|1|ITEM001|OLEO DIESEL S10|1000.00|L|1500.00|0.00|0|000|5102|VENDA DIESEL|1500.00|18.00|270.00|0.00|0.00|0.00|
|C170|2|ITEM002|REFRIGERANTE LATA 350ML|500.00|UN|1000.00|0.00|0|000|5102|VENDA BEBIDA|1000.00|18.00|180.00|0.00|0.00|0.00|
|C190|000|5102|18.00|2500.00|2500.00|450.00|0.00|0.00|0.00|0.00|`;

  const handleSimulateRobo = async () => {
    const parsedSped = await parseSpedContent(SPED_EXEMPLO_SIMULACAO);
    await executarEAtualizar(parsedSped, [], {
      isSimulacao: true,
      nomeSucesso: 'Simulação Concluída',
      nomeErro: 'Erro na simulação:'
    });
  };

  const handleScanSavedFiles = async () => {
    if (!effectiveEscritorioId) return;
    setIsProcessing(true);
    try {
      const res = await verificarEProcessarArquivosSalvos({
        matrizRules,
        clientes,
        onNotification: addNotification,
        escritorioId: effectiveEscritorioId
      });

      await recarregar();

      if (res.novosProcessados > 0) {
        addNotification(
          'Identificação Concluída',
          `Robô identificou e importou ${res.novosProcessados} novo(s) arquivo(s) salvo(s) nas pastas dos clientes.`,
          'import'
        );
      } else {
        addNotification(
          'Varredura de Pastas',
          `Varredura concluída. ${res.arquivosEncontrados} arquivo(s) salvo(s) analisado(s), nenhum arquivo novo pendente.`,
          'system'
        );
      }
    } catch (err) {
      console.error('Erro na varredura de arquivos:', err);
      alert('Erro ao varrer arquivos salvos.');
    } finally {
      setIsProcessing(false);
    }
  };



  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const q = logSearchTerm.trim().toLowerCase();
    return logs.filter(l => {
      const matchesSearch = !q || 
        (l.mensagem && l.mensagem.toLowerCase().includes(q)) ||
        (l.clienteNome && l.clienteNome.toLowerCase().includes(q)) ||
        (l.detalhes && l.detalhes.toLowerCase().includes(q));

      const matchesType = logTypeFilter === 'todos' || l.tipoAcao === logTypeFilter;
      return matchesSearch && matchesType;
    });
  }, [logs, logSearchTerm, logTypeFilter]);

  // Learned Rules count pending
  const pendingLearnedCount = useMemo(() => {
    return learnedRules.filter(r => r.status === 'pendente').length;
  }, [learnedRules]);

  return (
    <div className="space-y-5 pb-12">
      {/* Top Professional Header Bar */}
      <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] rounded-xl shadow-xs shrink-0">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-[var(--atlas-navy)] tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                    Robô Fiscal & Automação IA
                  </h1>
                  <span className={`atlas-pill ${
                    config.ativo ? 'atlas-pill-accent' : 'atlas-pill-navy'
                  } !font-bold uppercase tracking-widest text-[10px]`}>
                    {config.ativo ? 'Robô Ativo' : 'Robô Pausado'}
                  </span>
                </div>
                <p className="text-sm text-[var(--atlas-text-secondary)] mt-2 max-w-2xl leading-relaxed">
                  Monitoramento automatizado de diretórios, validação em tempo real contra a Matriz Tributária e Aprendizado Contínuo de padrões fiscais.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                onClick={handleToggleActive}
                className={`atlas-btn py-2.5 px-5 text-sm font-bold shadow-sm cursor-pointer transition-all ${
                  config.ativo 
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-700' 
                    : 'atlas-btn-accent'
                }`}
              >
                {config.ativo ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Pausar Monitoramento</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Ativar Robô Fiscal</span>
                  </>
                )}
              </button>

              <button
                onClick={recarregar}
                className="atlas-btn atlas-btn-secondary p-2.5 cursor-pointer shadow-xs"
                title="Sincronizar dados"
              >
                <RefreshCw className="w-5 h-5 text-[var(--atlas-navy)]" />
              </button>
            </div>
          </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--atlas-border)] text-xs">
          <div className="atlas-stat-strip border-[var(--atlas-border)]/60 bg-[var(--atlas-surface-hover)] p-4 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-muted)] font-bold text-[10px] uppercase tracking-widest block">Status do Robô</span>
              <span className={`text-sm font-bold mt-1 block ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`}>
                {config.ativo ? '✓ Ativo & Monitorando' : '○ Em Espera (Pausado)'}
              </span>
            </div>
            <Activity className={`w-5 h-5 ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`} />
          </div>

          <div className="atlas-stat-strip border-[var(--atlas-border)]/60 bg-[var(--atlas-surface-hover)] p-4 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-muted)] font-bold text-[10px] uppercase tracking-widest block">Execuções Realizadas</span>
              <span className="text-base font-bold text-[var(--atlas-text)] mt-0.5 block">{logs.length} Lotes</span>
            </div>
            <FileText className="w-5 h-5 text-[var(--atlas-text-muted)]" />
          </div>

          <div className="atlas-stat-strip border-[var(--atlas-border)]/60 bg-[var(--atlas-surface-hover)] p-4 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-muted)] font-bold text-[10px] uppercase tracking-widest block">Padrões Aprendidos</span>
              <span className="text-base font-bold text-[var(--atlas-navy)] mt-0.5 block">
                {pendingLearnedCount} Pendente(s)
              </span>
            </div>
            <BrainCircuit className="w-5 h-5 text-[var(--atlas-navy)]" />
          </div>

          <div className="atlas-stat-strip border-[var(--atlas-border)]/60 bg-[var(--atlas-surface-hover)] p-4 flex items-center justify-between">
            <div>
              <span className="text-[var(--atlas-text-muted)] font-bold text-[10px] uppercase tracking-widest block">Matriz Tributária</span>
              <span className="text-base font-bold text-[var(--atlas-text)] mt-0.5 block">{matrizRules.length} Regra(s)</span>
            </div>
            <Database className="w-5 h-5 text-[var(--atlas-text-muted)]" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-[var(--atlas-border)] flex flex-wrap items-center gap-1 text-xs font-semibold bg-[var(--atlas-surface)] px-2 pt-2 rounded-t-xl border border-[var(--atlas-border)] shadow-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'overview'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <Activity className="w-4 h-4 text-[var(--atlas-navy)]" />
          <span>Dashboard Executivo</span>
        </button>

        <button
          onClick={() => setActiveTab('processador')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'processador'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Processador em Lote</span>
        </button>

        <button
          onClick={() => setActiveTab('aprendizado')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 relative ${
            activeTab === 'aprendizado'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <BrainCircuit className="w-4 h-4 text-[var(--atlas-navy)]" />
          <span>Aprendizado da Matriz</span>
          {pendingLearnedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-xs font-bold">
              {pendingLearnedCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'logs'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Trilha de Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('pastas')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'pastas'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>Monitor de Pastas</span>
        </button>

        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-2 ${
            activeTab === 'config'
              ? 'border-[var(--atlas-navy)] text-[var(--atlas-navy)] bg-[var(--atlas-surface-hover)] font-bold'
              : 'border-transparent text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)] hover:bg-[var(--atlas-surface-hover)]/50'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parâmetros</span>
        </button>
      </div>

      {/* TAB 0: DASHBOARD EXECUTIVO */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Executive Overview Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
            <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--atlas-text-secondary)] font-medium">Status da Automação</span>
                <Activity className={`w-4 h-4 ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-muted)]'}`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className={`text-base font-bold ${config.ativo ? 'text-[var(--atlas-accent)]' : 'text-[var(--atlas-text-secondary)]'}`}>
                  {config.ativo ? 'Ativo & Varredura On' : 'Pausado'}
                </span>
                <span className="text-xs text-[var(--atlas-text-muted)] font-mono">100% On-line</span>
              </div>
            </div>

            <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--atlas-text-secondary)] font-medium">Lotes Processados</span>
                <FileText className="w-4 h-4 text-[var(--atlas-text-muted)]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-[var(--atlas-text)]">{logs.length}</span>
                <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Processados</span>
              </div>
            </div>

            <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--atlas-text-secondary)] font-medium">Alertas de Divergência</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-rose-700">
                  {logs.reduce((acc, l) => acc + (l.inconsistenciasCount || 0), 0)}
                </span>
                <span className="text-xs text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded">Inconsistências</span>
              </div>
            </div>

            <div className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[var(--atlas-text-secondary)] font-medium">Matriz de Aprendizado</span>
                <BrainCircuit className="w-4 h-4 text-[var(--atlas-navy)]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-bold text-[var(--atlas-navy)]">{pendingLearnedCount} Pendente(s)</span>
                <span className="text-xs text-[var(--atlas-navy)] font-bold bg-indigo-50 px-1.5 py-0.5 rounded">{matrizRules.length} Regras Ativas</span>
              </div>
            </div>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setActiveTab('processador')}
              className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] hover:border-[var(--atlas-navy)] rounded-xl p-4 shadow-xs cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-[var(--atlas-surface-hover)] group-hover:bg-[var(--atlas-navy)]/10 text-[var(--atlas-text-secondary)] group-hover:text-[var(--atlas-navy)] rounded-lg transition-colors">
                  <Upload className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--atlas-text-muted)] group-hover:text-[var(--atlas-navy)] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[var(--atlas-text)] text-sm mt-3">Processador em Lote</h3>
              <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Execute cruzamentos pontuais entre SPED e XMLs sob demanda com relatórios de saída instantâneos.</p>
            </div>

            <div 
              onClick={() => setActiveTab('aprendizado')}
              className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] hover:border-[var(--atlas-navy)] rounded-xl p-4 shadow-xs cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-[var(--atlas-surface-hover)] group-hover:bg-[var(--atlas-navy)]/10 text-[var(--atlas-text-secondary)] group-hover:text-[var(--atlas-navy)] rounded-lg transition-colors">
                  <BrainCircuit className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--atlas-text-muted)] group-hover:text-[var(--atlas-navy)] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[var(--atlas-text)] text-sm mt-3">Aprendizado da Matriz ({pendingLearnedCount})</h3>
              <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Revise e aprove padrões de CST/NCM/CFOP sugeridos automaticamente pela IA do robô.</p>
            </div>

            <div 
              onClick={() => setActiveTab('pastas')}
              className="bg-[var(--atlas-surface)] border border-[var(--atlas-border)] hover:border-[var(--atlas-navy)] rounded-xl p-4 shadow-xs cursor-pointer transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 bg-[var(--atlas-surface-hover)] group-hover:bg-[var(--atlas-navy)]/10 text-[var(--atlas-text-secondary)] group-hover:text-[var(--atlas-navy)] rounded-lg transition-colors">
                  <FolderTree className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--atlas-text-muted)] group-hover:text-[var(--atlas-navy)] group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="font-bold text-[var(--atlas-text)] text-sm mt-3">Monitor de Pastas Locais</h3>
              <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Configure o monitoramento automático de diretórios no seu computador para ingestão contínua.</p>
            </div>
          </div>

          {/* Inconsistency Breakdown Analysis */}
          <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] p-4 shadow-xs space-y-3">
            <h3 className="font-bold text-[var(--atlas-text)] text-xs flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[var(--atlas-accent)]" />
              <span>Categorização e Tipologia de Inconsistências Fiscais</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[var(--atlas-surface-hover)] rounded-lg border border-[var(--atlas-border)]">
                <span className="text-xs font-semibold text-[var(--atlas-text-secondary)] block">Divergência de Valores</span>
                <span className="text-sm font-bold text-[var(--atlas-text)] mt-1 block">SPED vs XML</span>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Diferenças no valor total do item, base de cálculo ou ICMS retido.</p>
              </div>

              <div className="p-3 bg-[var(--atlas-surface-hover)] rounded-lg border border-[var(--atlas-border)]">
                <span className="text-xs font-semibold text-[var(--atlas-text-secondary)] block">Notas Fiscais Omissas</span>
                <span className="text-sm font-bold text-[var(--atlas-text)] mt-1 block">SPED sem XML</span>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Documentos escriturados sem a respectiva chave cadastrada nos XMLs.</p>
              </div>

              <div className="p-3 bg-[var(--atlas-surface-hover)] rounded-lg border border-[var(--atlas-border)]">
                <span className="text-xs font-semibold text-[var(--atlas-text-secondary)] block">Incompatibilidade CST/CFOP</span>
                <span className="text-sm font-bold text-[var(--atlas-text)] mt-1 block">Matriz Tributária</span>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Combinação incorreta de código de situação tributária para a operação.</p>
              </div>

              <div className="p-3 bg-[var(--atlas-surface-hover)] rounded-lg border border-[var(--atlas-border)]">
                <span className="text-xs font-semibold text-[var(--atlas-text-secondary)] block">Documentos Cancelados</span>
                <span className="text-sm font-bold text-[var(--atlas-text)] mt-1 block">Status na SEFAZ</span>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-1">Notas canceladas escrituradas indevidamente como documento regular.</p>
              </div>
            </div>
          </div>

          {/* Recent Logs & Execution Preview */}
          <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-xs overflow-hidden">
            <div className="bg-[var(--atlas-surface-hover)] px-4 py-3 border-b border-[var(--atlas-border)] font-bold text-[var(--atlas-text)] flex items-center justify-between text-xs">
              <span>Últimas Execuções Registradas</span>
              <button 
                onClick={() => setActiveTab('logs')}
                className="text-[var(--atlas-navy)] hover:underline text-xs font-semibold flex items-center space-x-1"
              >
                <span>Ver Todos os Logs ({logs.length})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="p-8 text-center text-[var(--atlas-text-secondary)] text-xs">
                Nenhum log gravado ainda. As execuções do robô aparecerão aqui.
              </div>
            ) : (
              <div className="divide-y divide-[var(--atlas-border)] text-xs">
                {logs.slice(0, 5).map(l => (
                  <div key={l.id} className="p-3 hover:bg-[var(--atlas-surface-hover)]/80 transition-colors flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[var(--atlas-text)] truncate">{l.clienteNome || 'Geral'}</span>
                        <span className="text-[var(--atlas-text-muted)]">•</span>
                        <span className="text-[var(--atlas-text-secondary)] text-xs font-mono">
                          {new Date(l.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-[var(--atlas-text-secondary)] font-medium text-xs mt-0.5 truncate">{l.mensagem}</p>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                      l.tipoAcao === 'INCONSISTENCIA' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                      l.tipoAcao === 'APRENDIZADO' ? 'bg-emerald-100 text-[var(--atlas-accent)] border border-emerald-200' :
                      'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)]'
                    }`}>
                      {l.tipoAcao}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: MONITOR DE PASTAS DEDICADO */}
      {activeTab === 'pastas' && (
        <FolderWatcherPanel
          clientes={clientes}
          activeClienteId={activeClienteId}
          addNotification={addNotification}
          escritorioId={escritorioId}
        />
      )}

      {/* TAB 1: PAINEL DE MONITORAMENTO E LOGS DA AUTOMAÇÃO */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-[var(--atlas-surface)] p-3.5 rounded-xl border border-[var(--atlas-border)] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="relative flex-1 max-w-lg">
              <Search className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filtrar logs por empresa, mensagem ou detalhes..."
                value={logSearchTerm}
                onChange={e => setLogSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 border border-[var(--atlas-border)] rounded-lg text-xs text-[var(--atlas-text)] placeholder-[var(--atlas-text-muted)] focus:outline-hidden focus:border-[var(--atlas-navy)]"
              />
              {logSearchTerm && (
                <button onClick={() => setLogSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--atlas-text-muted)] p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-3.5 h-3.5 text-[var(--atlas-text-muted)]" />
              <select
                value={logTypeFilter}
                onChange={e => setLogTypeFilter(e.target.value)}
                className="border border-[var(--atlas-border)] rounded-lg px-2.5 py-2 bg-[var(--atlas-surface)] text-[var(--atlas-text-secondary)] font-medium focus:outline-hidden focus:border-[var(--atlas-navy)]"
              >
                <option value="todos">Todos os Tipos de Registros</option>
                <option value="PROCESSAMENTO">Processamentos</option>
                <option value="INCONSISTENCIA">Inconsistências Encontradas</option>
                <option value="APRENDIZADO">Aprendizados da Matriz</option>
                <option value="ERRO">Erros de Leitura</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-xs overflow-hidden text-xs">
            <div className="bg-[var(--atlas-surface-hover)]/80 px-4 py-2.5 border-b border-[var(--atlas-border)] font-bold text-[var(--atlas-text-secondary)] flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[var(--atlas-navy)]" />
                <span>Log de Execuções e Auditoria Contínua do Robô Fiscal</span>
              </div>
              <span className="text-[var(--atlas-text-secondary)] font-normal">{filteredLogs.length} registro(s) exibido(s)</span>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-12 text-center space-y-2 text-[var(--atlas-text-secondary)]">
                <Clock className="w-8 h-8 text-[var(--atlas-text-muted)] mx-auto" />
                <p className="font-semibold text-[var(--atlas-text-secondary)]">Nenhum log encontrado</p>
                <p className="text-xs">Os registros de execuções e validações do Robô Fiscal serão exibidos aqui.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-semibold uppercase text-xs tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">Data / Hora</th>
                    <th className="py-2.5 px-4">Empresa / Origem</th>
                    <th className="py-2.5 px-4">Tipo de Ação</th>
                    <th className="py-2.5 px-4">Mensagem de Execução</th>
                    <th className="py-2.5 px-4">Detalhes Técnicos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--atlas-border)]">
                  {filteredLogs.map(log => {
                    let badgeClass = 'bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-secondary)] border-[var(--atlas-border)]';
                    if (log.tipoAcao === 'INCONSISTENCIA') badgeClass = 'bg-rose-100 text-rose-800 border-rose-200 font-bold';
                    if (log.tipoAcao === 'APRENDIZADO') badgeClass = 'bg-emerald-100 text-[var(--atlas-accent)] border-emerald-200 font-bold';
                    if (log.tipoAcao === 'PROCESSAMENTO') badgeClass = 'bg-sky-100 text-sky-800 border-sky-200';
                    if (log.tipoAcao === 'ERRO') badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';

                    return (
                      <tr key={log.id} className="hover:bg-[var(--atlas-surface-hover)]/80 transition-colors">
                        <td className="py-3 px-4 text-[var(--atlas-text-secondary)] font-mono text-xs whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--atlas-text)]">
                          {log.clienteNome || 'Geral / Sistema'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs border ${badgeClass}`}>
                            {log.tipoAcao}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[var(--atlas-text)]">
                          {log.mensagem}
                        </td>
                        <td className="py-3 px-4 text-[var(--atlas-text-secondary)] text-xs font-mono">
                          {log.detalhes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROCESSADOR EM LOTE E TESTADOR DE REGRAS */}
      {activeTab === 'processador' && (
        <div className="space-y-4">
          <div className="bg-[var(--atlas-surface)] p-5 rounded-xl border border-[var(--atlas-border)] shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--atlas-text)] flex items-center space-x-2">
                <Upload className="w-4 h-4 text-[var(--atlas-navy)]" />
                <span>Processamento de Arquivos no Robô Fiscal</span>
              </h2>
              <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                Submeta arquivos SPED (.txt) ou pacotes XML (.zip, .xml) para validação imediata contra as regras da Matriz Tributária e extração de novos padrões.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Select Client Target */}
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text-secondary)] mb-1">
                  Empresa Cliente para Validação Matriz
                </label>
                <select
                  value={selectedClienteForRun}
                  onChange={e => setSelectedClienteForRun(e.target.value)}
                  className="w-full border border-[var(--atlas-border)] rounded-lg p-2 text-xs text-[var(--atlas-text)] bg-[var(--atlas-surface)] focus:outline-hidden focus:border-[var(--atlas-navy)]"
                >
                  <option value="">-- Detectar automaticamente do cabeçalho --</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.cnpj}) - UF: {c.uf}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Dropzone */}
              <div>
                <label className="block text-xs font-semibold text-[var(--atlas-text-secondary)] mb-1">
                  Arquivos SPED (.txt) / XMLs (.zip, .xml)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".txt,.xml,.zip"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-[var(--atlas-text-secondary)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--atlas-surface-hover)] file:text-[var(--atlas-navy)] hover:file:bg-slate-200"
                />
              </div>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)] text-xs">
                <div className="font-semibold text-[var(--atlas-text-secondary)] mb-1">Arquivos Selecionados:</div>
                <ul className="list-disc list-inside space-y-0.5 text-[var(--atlas-text-secondary)] font-mono text-xs">
                  {uploadedFiles.map((f, idx) => (
                    <li key={idx}>{f.name} ({(f.size / 1024).toFixed(1)} KB)</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
              <button
                onClick={handleSimulateRobo}
                disabled={isProcessing}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                title="Executa um teste imediato com arquivo fiscal demonstrativo para verificar o funcionamento"
              >
                <Sparkles className="w-4 h-4 text-amber-100" />
                <span>Simular Teste com Arquivo Exemplo</span>
              </button>

              <button
                onClick={handleExecuteRobo}
                disabled={isProcessing || uploadedFiles.length === 0}
                className="px-4 py-2 bg-[var(--atlas-navy)] hover:bg-[var(--atlas-navy-dark)] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analisando e Validando... ({processProgress}%)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Executar Análise com Robô Fiscal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Display */}
          {lastProcessResult && (
            <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] p-5 shadow-xs space-y-4 text-xs">
              <div className="border-b border-[var(--atlas-border)] pb-3 flex items-center justify-between">
                <h3 className="font-bold text-[var(--atlas-text)] text-sm flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--atlas-accent)]" />
                  <span>Resultado da Auditoria da Matriz pelo Robô</span>
                </h3>
                <span className="text-[var(--atlas-text-secondary)]">
                  {lastProcessResult.resumo.totalDocumentos} Documentos | {lastProcessResult.resumo.totalItensAnalisados} Itens
                </span>
              </div>

              {/* Inconsistencies List */}
              <div className="space-y-2">
                <h4 className="font-semibold text-[var(--atlas-text)] text-xs flex items-center space-x-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Divergências com a Matriz Tributária ({lastProcessResult.inconsistencias.length})</span>
                </h4>

                {lastProcessResult.inconsistencias.length === 0 ? (
                  <div className="p-4 bg-emerald-50 text-[var(--atlas-accent)] rounded-lg border border-emerald-200 font-semibold text-xs">
                    Nenhuma divergência encontrada. Todos os itens validados estão em conformidade com as regras da Matriz Tributária.
                  </div>
                ) : (
                  <div className="border border-[var(--atlas-border)] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] font-semibold text-[var(--atlas-text-secondary)]">
                        <tr>
                          <th className="p-2.5">Doc</th>
                          <th className="p-2.5">NCM</th>
                          <th className="p-2.5">CST Declarado</th>
                          <th className="p-2.5">CST Matriz Esperado</th>
                          <th className="p-2.5">CFOP</th>
                          <th className="p-2.5">Inconsistência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--atlas-border)]">
                        {lastProcessResult.inconsistencias.map((inc, i) => (
                          <tr key={i} className="hover:bg-[var(--atlas-surface-hover)]">
                            <td className="p-2.5 font-bold text-[var(--atlas-text)]">{inc.numDoc}</td>
                            <td className="p-2.5 font-mono text-[var(--atlas-text-secondary)]">{inc.ncm}</td>
                            <td className="p-2.5 text-rose-700 font-bold">{inc.cstDeclarado}</td>
                            <td className="p-2.5 text-[var(--atlas-accent)] font-bold">{inc.cstEsperado}</td>
                            <td className="p-2.5 font-mono text-[var(--atlas-text-secondary)]">{inc.cfopDeclarado}</td>
                            <td className="p-2.5 text-[var(--atlas-text-secondary)]">{inc.mensagem}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: APRENDIZADO CONTÍNUO DA MATRIZ TRIBUTÁRIA */}
      {activeTab === 'aprendizado' && (
        <div className="space-y-4 text-xs">
          <div className="bg-[var(--atlas-surface)] p-4 rounded-xl border border-[var(--atlas-border)] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--atlas-text)] flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-[var(--atlas-navy)]" />
                <span>Módulo de Aprendizado Contínuo da Matriz</span>
              </h2>
              <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                O Robô Fiscal identifica padrões recorrentes de tributação nas notas importadas. Aprove as sugestões para enriquecer a Matriz Tributária.
              </p>
            </div>

            <div className="px-3 py-1.5 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg text-[var(--atlas-text-secondary)] font-semibold text-xs shrink-0">
              {pendingLearnedCount} Padrão(ões) Pendente(s)
            </div>
          </div>

          <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] shadow-xs overflow-hidden">
            <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 text-amber-900 font-medium text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Padrão observado no arquivo auditado, não é fonte fiscal oficial. Confirme contra a legislação antes de aprovar.</span>
            </div>

            <div className="bg-[var(--atlas-surface-hover)]/80 px-4 py-2.5 border-b border-[var(--atlas-border)] font-bold text-[var(--atlas-text-secondary)] flex items-center justify-between">
              <span className="flex items-center space-x-2">
                <BrainCircuit className="w-4 h-4 text-[var(--atlas-navy)]" />
                <span>Solicitações de Aprendizado Fiscal Pendentes de Aprovação pelo Auditor</span>
              </span>
              <span className="text-[var(--atlas-text-secondary)] font-normal text-xs">{learnedRules.length} regra(s) capturada(s)</span>
            </div>

            {learnedRules.length === 0 ? (
              <div className="p-12 text-center text-[var(--atlas-text-secondary)] space-y-2">
                <BrainCircuit className="w-8 h-8 text-[var(--atlas-text-muted)] mx-auto" />
                <p className="font-semibold text-[var(--atlas-text-secondary)]">Nenhum aprendizado pendente de conferência</p>
                <p className="text-xs">
                  À medida que o Robô processa notas e SPEDs, novos padrões com NCM, CST, CFOP e descrição do produto serão sugeridos aqui para aprovação do auditor.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-[var(--atlas-surface-hover)] border-b border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-semibold uppercase text-xs tracking-wider">
                  <tr>
                    <th className="py-2.5 px-4">UF</th>
                    <th className="py-2.5 px-4">Código NCM</th>
                    <th className="py-2.5 px-4">CST Sugerido</th>
                    <th className="py-2.5 px-4">CFOP Sugerido</th>
                    <th className="py-2.5 px-4">Descrição do Produto / Detalhes</th>
                    <th className="py-2.5 px-4">Amostras / Confiança</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Decisão do Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--atlas-border)]">
                  {learnedRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-[var(--atlas-surface-hover)]/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-[var(--atlas-text)]">{rule.uf}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-[var(--atlas-surface-hover)] text-[var(--atlas-navy)] rounded border border-[var(--atlas-border)] font-mono font-bold">
                          {rule.ncmPrefix}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-emerald-50 text-[var(--atlas-accent)] rounded border border-emerald-200 font-bold">
                          CST {rule.learnedCst}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-[var(--atlas-text-secondary)]">
                        {rule.learnedCfop && rule.learnedCfop.length > 0 ? rule.learnedCfop.join(', ') : '5102'}
                      </td>
                      <td className="py-3 px-4 text-[var(--atlas-text)] max-w-sm">
                        <div className="font-bold text-[var(--atlas-text)] text-xs">
                          {rule.descricaoProduto || `Produto / NCM ${rule.ncmPrefix}`}
                        </div>
                        <div className="text-xs text-[var(--atlas-text-secondary)] mt-0.5 line-clamp-1">
                          {rule.descricao}
                        </div>
                        <div className="text-xs text-[var(--atlas-text-muted)] font-medium mt-0.5">
                          Empresa Origem: {rule.clienteOrigem || 'Auditado em SPED/XML'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[var(--atlas-text-secondary)] font-medium text-xs">
                        <div>{rule.amostrasAnalisadas} item(ns) analisado(s)</div>
                        <div className="text-emerald-700 font-bold text-xs">{rule.confiancaPercentual || 85}% de Confiança</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                          rule.status === 'aprovado'
                            ? 'bg-emerald-100 text-[var(--atlas-accent)] border-emerald-200'
                            : rule.status === 'rejeitado'
                            ? 'bg-rose-100 text-rose-800 border-rose-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}>
                          {rule.status === 'aprovado' ? 'Na Matriz Tributária' : rule.status === 'rejeitado' ? 'Rejeitado' : 'Pendente Auditor'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {rule.status === 'pendente' ? (
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleApproveRule(rule.id)}
                              className="px-3 py-1.5 bg-[var(--atlas-accent)] hover:bg-[var(--atlas-accent-dark)] text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95"
                              title="Aprovar e Enviar para a Matriz Tributária"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Aprovar &amp; Ir para Matriz</span>
                            </button>
                            <button
                              onClick={() => handleRejectRule(rule.id)}
                              className="px-2 py-1.5 text-[var(--atlas-text-muted)] hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                              title="Rejeitar Aprendizado"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[var(--atlas-text-muted)] font-semibold text-xs italic">
                            {rule.status === 'aprovado' ? 'Integrado na Matriz' : 'Descartado'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PARÂMETROS DO ROBÔ */}
      {activeTab === 'config' && (
        <form onSubmit={handleSaveConfig} className="bg-[var(--atlas-surface)] p-5 rounded-xl border border-[var(--atlas-border)] shadow-xs space-y-5 text-xs max-w-3xl">
          <div>
            <h2 className="text-sm font-bold text-[var(--atlas-text)] flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-[var(--atlas-navy)]" />
              <span>Parâmetros de Operação do Robô Fiscal</span>
            </h2>
            <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
              Configure as regras de execução automática e aprendizado contínuo.
            </p>
          </div>

          <div className="space-y-4 pt-2 divide-y divide-[var(--atlas-border)]">
            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="font-bold text-[var(--atlas-text)]">Automação do Robô Fiscal</div>
                <div className="text-[var(--atlas-text-secondary)] text-xs">Ativar monitoramento contínuo das pastas de importação</div>
              </div>
              <input
                type="checkbox"
                checked={config.ativo}
                onChange={e => setConfig({ ...config, ativo: e.target.checked })}
                className="w-4 h-4 rounded text-[var(--atlas-navy)] focus:ring-[var(--atlas-navy)]"
              />
            </div>


          </div>

          <div className="pt-3 border-t border-[var(--atlas-border)] flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--atlas-navy)] hover:bg-[var(--atlas-navy-dark)] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Salvar Parâmetros
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
