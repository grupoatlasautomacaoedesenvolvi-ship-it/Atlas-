import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SpedData, AuditConfig, Achado, XmlRecord, StatusRevisao, NotificationType } from '../types';
import { executarAuditoriaUnificada, salvarStatusRevisao } from '../lib/auditEngine';
import { fetchGlobalStateTaxMatrix } from '../lib/matrizService';
import { saveLearnedRule } from '../lib/roboFiscalService';
import { Database, ShieldAlert, Search, Filter, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Copy, Check, Download, ArrowRightLeft, Settings, PlayCircle, X, Calculator } from 'lucide-react';
import { AuditLogViewer } from './AuditLogViewer';
import { isAutoCrosscheckEnabled, setAutoCrosscheckEnabled, getAutomationLogs, logAutomationRun, AutomationLog } from '../lib/automationService';

interface AdvancedAuditViewProps {
  spedData: SpedData | null;
  auditConfig: AuditConfig | null;
  xmlTerceiros?: XmlRecord[];
  xmlProprio?: XmlRecord[];
  xmlNfce?: XmlRecord[];
  escritorioId?: string;
  addNotification?: (title: string, message: string, type: NotificationType, actionUrl?: string) => void;
  c190AuditLogs?: any[];
}

const AUDIT_FILTERS_STORAGE_KEY = 'atlas_advanced_audit_filters_v1';

function getAuditSavedString(key: string, defaultValue: string = ''): string {
  try {
    const raw = sessionStorage.getItem(AUDIT_FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[key] === 'string') {
        return parsed[key];
      }
    }
  } catch (e) {}
  return defaultValue;
}

export function AdvancedAuditView({
  spedData,
  auditConfig,
  xmlTerceiros = [],
  xmlProprio = [],
  xmlNfce = [],
  escritorioId,
  addNotification,
  c190AuditLogs = []
}: AdvancedAuditViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>(() => getAuditSavedString('selectedFilter', 'ALL'));
  const [statusFilter, setStatusFilter] = useState<string>(() => getAuditSavedString('statusFilter', 'ALL'));
  const [severityFilter, setSeverityFilter] = useState<string>(() => getAuditSavedString('severityFilter', 'ALL'));
  const [searchTerm, setSearchTerm] = useState<string>(() => getAuditSavedString('searchTerm', ''));
  const [dateFilter, setDateFilter] = useState<string>(() => getAuditSavedString('dateFilter', ''));
  const [ncmFilter, setNcmFilter] = useState<string>(() => getAuditSavedString('ncmFilter', ''));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showC190AuditModal, setShowC190AuditModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'achados' | 'interestadual' | 'automacao' | 'xml_faltantes'>(
    () => (getAuditSavedString('activeTab', 'achados') as any)
  );

  useEffect(() => {
    try {
      const filterObj = {
        selectedFilter,
        statusFilter,
        severityFilter,
        searchTerm,
        dateFilter,
        ncmFilter,
        activeTab
      };
      sessionStorage.setItem(AUDIT_FILTERS_STORAGE_KEY, JSON.stringify(filterObj));
    } catch (e) {}
  }, [selectedFilter, statusFilter, severityFilter, searchTerm, dateFilter, ncmFilter, activeTab]);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoLogs, setAutoLogs] = useState<AutomationLog[]>([]);
  const [isSavingAuto, setIsSavingAuto] = useState(false);
  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!escritorioId) return;
    isAutoCrosscheckEnabled(escritorioId).then(setAutoEnabled);
    getAutomationLogs(escritorioId).then(setAutoLogs);
  }, [escritorioId]);

  const handleToggleSelectFinding = (id: string) => {
    setSelectedFindingIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    if (selectedFindingIds.size === filteredFindings.length && filteredFindings.length > 0) {
      setSelectedFindingIds(new Set());
    } else {
      setSelectedFindingIds(new Set(filteredFindings.map(f => f.id)));
    }
  };

  const handleBatchStatusUpdate = (newStatus: StatusRevisao) => {
    if (selectedFindingIds.size === 0) return;
    selectedFindingIds.forEach(id => {
      salvarStatusRevisao(id, newStatus, escritorioId);
    });
    setRefreshTrigger(prev => prev + 1);
    setSelectedFindingIds(new Set());
  };

  const handleToggleAuto = async () => {
    if (!escritorioId) return;
    setIsSavingAuto(true);
    const newVal = !autoEnabled;
    await setAutoCrosscheckEnabled(newVal, escritorioId);
    setAutoEnabled(newVal);
    setIsSavingAuto(false);
  };


  const ibgeToUf: Record<string, string> = useMemo(() => ({
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
    '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
    '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
    '41': 'PR', '42': 'SC', '43': 'RS',
    '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
  }), []);

  const interstateItems = useMemo(() => {
    if (!spedData) return [];
    const companyUf = (spedData.header.uf || 'SP').trim().toUpperCase();
    const items = [];

    for (const doc of spedData.documents) {
      const isEntrada = doc.indOper === '0';
      const isSaida = doc.indOper === '1';

      for (const item of doc.items) {
        if (!item.cfop) continue;
        
        const cfopPrefix = item.cfop.charAt(0);
        // Interestadual: 2 (Entrada) ou 6 (Saída)
        if (cfopPrefix === '2' || cfopPrefix === '6') {
          let ufOrigem = companyUf;
          let ufDestino = companyUf;

          if (isEntrada) {
            ufDestino = companyUf;
            if (doc.chvNfe && doc.chvNfe.length === 44) {
               ufOrigem = ibgeToUf[doc.chvNfe.substring(0, 2)] || 'OUTRO';
            } else {
               ufOrigem = 'OUTRO (EXTERNO)';
            }
          } else if (isSaida) {
            ufOrigem = companyUf;
            ufDestino = 'OUTRO (EXTERNO)';
          }

          items.push({
            id: `${doc.id}-${item.codItem}-${Math.random()}`,
            numDoc: doc.numDoc,
            chvNfe: doc.chvNfe,
            ncm: item.ncm || 'N/A',
            cfop: item.cfop,
            cst: item.cstIcms || 'N/A',
            ufOrigem,
            ufDestino,
            vlOpr: item.vlItem || 0,
            vlIcms: item.vlIcms || 0,
            desc: item.descrItem || 'Item Desconhecido',
            indOper: doc.indOper
          });
        }
      }
    }
    return items;
  }, [spedData, ibgeToUf]);

  


  const rawFindings = useMemo(() => {
    return executarAuditoriaUnificada(spedData, auditConfig, xmlTerceiros, xmlProprio, xmlNfce);
  }, [spedData, auditConfig, xmlTerceiros, xmlProprio, xmlNfce, refreshTrigger]);

  const highSeverityCount = rawFindings.filter(f => f.severidade === 'alta').length;
  const mediumSeverityCount = rawFindings.filter(f => f.severidade === 'media').length;
  const lowSeverityCount = rawFindings.filter(f => f.severidade === 'baixa').length;

  const activeAuditFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedFilter !== 'ALL') count++;
    if (statusFilter !== 'ALL') count++;
    if (severityFilter !== 'ALL') count++;
    if (searchTerm.trim() !== '') count++;
    if (dateFilter) count++;
    if (ncmFilter.trim() !== '') count++;
    return count;
  }, [selectedFilter, statusFilter, severityFilter, searchTerm, dateFilter, ncmFilter]);

  const clearAllAuditFilters = () => {
    setSelectedFilter('ALL');
    setStatusFilter('ALL');
    setSeverityFilter('ALL');
    setSearchTerm('');
    setDateFilter('');
    setNcmFilter('');
    try {
      sessionStorage.removeItem(AUDIT_FILTERS_STORAGE_KEY);
    } catch (e) {}
  };

  const handleReview = (id: string, newStatus: StatusRevisao) => {
    salvarStatusRevisao(id, newStatus, escritorioId);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleCopyDraft = (draftText: string, id: string) => {
    navigator.clipboard.writeText(draftText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Metrics
  const totalFindings = rawFindings.length;
  const withCorrectionCount = rawFindings.filter(f => f.correcaoSugerida && f.correcaoSugerida.length > 0).length;
  const requiresInvestigationCount = totalFindings - withCorrectionCount;
  const pendingCount = rawFindings.filter(f => f.statusRevisao === 'pendente').length;
  const approvedCount = rawFindings.filter(f => f.statusRevisao === 'aprovado').length;
  const rejectedCount = rawFindings.filter(f => f.statusRevisao === 'rejeitado').length;

  const filteredFindings = useMemo(() => {
    return rawFindings.filter(f => {
      if (activeTab === 'xml_faltantes') {
        if (f.tipo !== 'NOTA_SPED_SEM_XML') return false;
      } else if (activeTab === 'interestadual') {
        if (f.tipo !== 'CST_INCOMPATIVEL_NCM' && f.tipo !== 'CFOP_REVENDA_INCORRETO_ST') return false;
      } else {
        if (selectedFilter !== 'ALL' && f.tipo !== selectedFilter) return false;
      }
      
      if (statusFilter !== 'ALL' && f.statusRevisao !== statusFilter) return false;
      if (severityFilter !== 'ALL' && f.severidade !== severityFilter) return false;
      
      if (dateFilter) {
        if (!f.dtDoc) return false;
        // dateFilter is YYYY-MM-DD. dtDoc usually is DDMMYYYY or YYYY-MM-DD
        // So let's check if dateFilter is included somehow, or do a safe string check
        const dStr = String(f.dtDoc);
        const [y, m, d] = dateFilter.split('-');
        if (!dStr.includes(`${d}${m}${y}`) && !dStr.includes(dateFilter)) {
          return false;
        }
      }

      if (ncmFilter) {
        const ncmStr = String(f.ncm || '').toLowerCase();
        if (!ncmStr.includes(ncmFilter.toLowerCase())) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          String(f.titulo || '').toLowerCase().includes(term) ||
          String(f.descricao || '').toLowerCase().includes(term) ||
          String(f.numDoc || '').toLowerCase().includes(term) ||
          String(f.codItem || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [rawFindings, selectedFilter, statusFilter, severityFilter, searchTerm, dateFilter, ncmFilter, activeTab]);

  const hasLoggedAutoRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (spedData && autoEnabled && escritorioId) {
      const spedIdent = spedData.header.uf + '-' + spedData.header.cnpj;
      if (hasLoggedAutoRunRef.current === spedIdent) return;

      const hasLog = autoLogs.some(log => log.spedId === spedIdent);
      if (!hasLog) {
         const crossCheckFindings = rawFindings.filter(f => f.tipo === 'CST_INCOMPATIVEL_NCM' || f.tipo === 'CFOP_REVENDA_INCORRETO_ST');
         if (crossCheckFindings.length > 0) {
            hasLoggedAutoRunRef.current = spedIdent;
            logAutomationRun(spedIdent, crossCheckFindings.length, crossCheckFindings.slice(0, 10), escritorioId).then(() => {
               getAutomationLogs(escritorioId).then(setAutoLogs);
            });
         }
      }
    }
  }, [spedData, autoEnabled, escritorioId]);


  const [isFinalizing, setIsFinalizing] = useState(false);

  const handleFinalizarConferencia = async () => {
    if (!spedData) return;
    if (!escritorioId) {
      alert('Nenhum escritório associado ao usuário atual. Operação bloqueada.');
      return;
    }
    setIsFinalizing(true);
    try {
      const matrix = await fetchGlobalStateTaxMatrix(escritorioId);
      let novasSugestoesCount = 0;

      const configMap = new Map<string, { cst: string, cfop: string, count: number, aliqIcms?: number, descr?: string }>();

      const spedUf = (spedData.header.uf || 'SP').trim().toUpperCase();
      const clienteOrigem = spedData.header.nome || 'Arquivo SPED';

      spedData.documents.forEach(doc => {
        doc.items.forEach(item => {
          if (!item.ncm) return;
          const ncmClean = item.ncm.replace(/\D/g, '');
          if (!ncmClean || ncmClean.length < 2) return;
          const ncmPrefix = ncmClean.substring(0, 4);

          const descrItem = (item as any).descrCompl || (item as any).descrItem || (item as any).codItem || '';
          const existing = configMap.get(ncmPrefix) || { cst: item.cstIcms || '', cfop: item.cfop || '', count: 0, aliqIcms: item.aliqIcms, descr: descrItem };
          existing.count++;
          if (!existing.descr && descrItem) existing.descr = descrItem;
          configMap.set(ncmPrefix, existing);
        });
      });

      for (const [ncmPrefix, val] of configMap) {
        const exists = matrix.some(rule => 
          (rule.ncmPrefix === ncmPrefix || ncmPrefix.startsWith(rule.ncmPrefix)) &&
          (rule.uf === 'ALL' || rule.uf.toUpperCase() === spedUf)
        );
        if (!exists) {
          novasSugestoesCount++;
          const confianca = Math.min(99, 75 + Math.min(24, val.count * 3));
          await saveLearnedRule({
            id: `learned_${Date.now()}_${ncmPrefix}_${Math.random().toString(36).substring(7)}`,
            uf: spedUf,
            ncmPrefix: ncmPrefix,
            learnedCst: val.cst,
            learnedCfop: [val.cfop],
            learnedAliqIcms: val.aliqIcms || 0,
            descricao: `Padrão observado no SPED de ${spedUf} (NCM ${ncmPrefix}) — requer revisão do auditor`,
            descricaoProduto: val.descr || `Produto NCM ${ncmPrefix}`,
            confiancaPercentual: confianca,
            amostrasAnalisadas: val.count,
            clienteOrigem: clienteOrigem,
            status: 'pendente',
            criadoEm: new Date().toISOString()
          }, escritorioId);
        }
      }

      if (novasSugestoesCount > 0) {
        if (addNotification) {
          addNotification(
            'Novo Aprendizado Fiscal Identificado',
            `A auditoria identificou ${novasSugestoesCount} novo(s) padrão(ões) de NCM no SPED (${spedUf}). Clique para revisar e aprovar na Matriz.`,
            'rule',
            'aprendizado'
          );
        }
        alert(`Conferência finalizada. ${novasSugestoesCount} padrão(ões) novo(s) foram registrados como sugestões pendentes de revisão — nenhuma regra foi aplicada automaticamente.\n\nAs notas omissas já estão sincronizadas.`);
      } else {
        alert('Conferência finalizada. Nenhuma nova regra de NCM precisou ser sugerida.\n\nAs notas omissas já estão sincronizadas.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao finalizar conferência.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['Tipo', 'Severidade', 'Status', 'Documento', 'Item / Código', 'Título', 'Descrição'];
    const rows = filteredFindings.map(f => [
      f.tipo,
      f.severidade,
      f.statusRevisao,
      f.docId || f.numDoc || '',
      f.codItem || '',
      f.titulo,
      f.descricao
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'achados_auditoria_avancada.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMissingKeys = () => {
    const missingKeys = filteredFindings
      .filter(f => f.tipo === 'NOTA_SPED_SEM_XML')
      .map(f => {
        // extract the 44-digit key from the description or doc
        const match = String(f.descricao || '').match(/Chave: (\d{44})/);
        return match ? match[1] : '';
      })
      .filter(k => k.length === 44);

    if (missingKeys.length === 0) {
      alert('Nenhuma chave faltante encontrada.');
      return;
    }

    // Join with newlines
    const content = missingKeys.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'chaves_faltantes.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 text-[var(--atlas-text)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--atlas-navy)] tracking-tight">Central de Auditoria</h1>
          <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">Revisão automatizada e orientada para redução de 70% do trabalho manual em SPED</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleFinalizarConferencia}
            disabled={isFinalizing}
            className="atlas-btn atlas-btn-accent text-xs py-2 px-3.5"
          >
            <Database className="w-4 h-4" />
            <span>{isFinalizing ? 'Finalizando...' : 'Finalizar Conferência'}</span>
          </button>
          <button
            onClick={() => setShowC190AuditModal(true)}
            className="atlas-btn atlas-btn-secondary text-xs py-2 px-3.5"
            title="Ver histórico de recálculo e deltas do Bloco C190"
          >
            <Calculator className="w-4 h-4 text-[var(--atlas-navy)]" />
            <span>Auditoria C190 {c190AuditLogs.length > 0 ? `(${c190AuditLogs.length})` : ''}</span>
          </button>
          {filteredFindings.some(f => f.tipo === 'NOTA_SPED_SEM_XML') && (
            <button
              onClick={handleExportMissingKeys}
              className="atlas-btn atlas-btn-secondary text-xs py-2 px-3.5"
              title="Baixar chaves que constam no SPED mas faltam no XML importado"
            >
              <FileText className="w-4 h-4" />
              <span>Chaves Faltantes</span>
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="atlas-btn atlas-btn-primary text-xs py-2 px-3.5"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
          <div className="atlas-pill atlas-pill-accent flex items-center space-x-1.5 py-1.5 px-3">
            <CheckCircle2 className="w-4 h-4 text-[var(--atlas-accent)]" />
            <span>
              {withCorrectionCount} Correção Pronta ({Math.round((withCorrectionCount / (totalFindings || 1)) * 100)}% automação)
            </span>
          </div>
          <div className="atlas-pill atlas-pill-warning flex items-center space-x-1.5 py-1.5 px-3">
            <AlertTriangle className="w-4 h-4 text-[var(--atlas-warning)]" />
            <span>
              {requiresInvestigationCount} Investigação
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[var(--atlas-border)] pb-2 text-xs">
        <button
          onClick={() => setActiveTab('achados')}
          className={`atlas-btn py-1.5 px-3 ${activeTab === 'achados' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Achados de Auditoria</span>
        </button>
        
        <button
          onClick={() => setActiveTab('interestadual')}
          className={`atlas-btn py-1.5 px-3 ${activeTab === 'interestadual' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <ArrowRightLeft className="w-3.5 h-3.5" />
          <span>ICMS Interestadual (NCM x CST)</span>
        </button>
        <button
          onClick={() => setActiveTab('automacao')}
          className={`atlas-btn py-1.5 px-3 ${activeTab === 'automacao' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Automação & Logs</span>
        </button>

        <button
          onClick={() => setActiveTab('xml_faltantes')}
          className={`atlas-btn py-1.5 px-3 ${activeTab === 'xml_faltantes' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>XMLs Faltantes</span>
        </button>
      </div>

      {activeTab === 'interestadual' ? (
        <div className="space-y-6">
          <div className="atlas-card p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-[var(--atlas-navy)]">Análise de Operações Interestaduais (ICMS-ST / DIFAL)</h2>
              <p className="text-xs text-[var(--atlas-text-secondary)]">
                Módulo para cruzamento de produtos (NCM) com a tributação aplicada (CST/CFOP) considerando os Estados de Origem e Destino.
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar NCM, CST, UF ou Nota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="atlas-input atlas-input-icon-left"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)] text-xs font-semibold text-[var(--atlas-text-secondary)] uppercase tracking-wider">
                    <th className="p-3">Documento</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3">NCM</th>
                    <th className="p-3">CFOP / CST</th>
                    <th className="p-3 text-center">Origem &rarr; Destino</th>
                    <th className="p-3 text-right">Valor Operação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--atlas-border)] text-xs">
                  {interstateItems
                    .filter(item => 
                      item.ncm.includes(searchTerm) || 
                      item.cst.includes(searchTerm) ||
                      item.ufOrigem.includes(searchTerm.toUpperCase()) ||
                      item.ufDestino.includes(searchTerm.toUpperCase()) ||
                      item.numDoc.includes(searchTerm)
                    )
                    .map(item => (
                    <tr key={item.id} className="hover:bg-[var(--atlas-surface-hover)] transition-colors">
                      <td className="p-3">
                        <div className="font-semibold text-[var(--atlas-text)]">NF {item.numDoc}</div>
                        <div className="text-[10px] text-[var(--atlas-text-muted)] font-mono truncate max-w-[120px]" title={item.chvNfe}>{item.chvNfe || 'Sem Chave'}</div>
                      </td>
                      <td className="p-3 text-[var(--atlas-text)]">
                        <div className="truncate max-w-xs">{item.desc}</div>
                      </td>
                      <td className="p-3 font-mono font-medium text-[var(--atlas-text)]">{item.ncm}</td>
                      <td className="p-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="atlas-pill atlas-pill-neutral">CFOP {item.cfop}</span>
                          <span className={`atlas-pill ${item.cst.endsWith('10') || item.cst.endsWith('70') || item.cst.endsWith('60') ? 'atlas-pill-warning' : 'atlas-pill-neutral'}`}>
                            CST {item.cst}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="font-bold text-[var(--atlas-text)]">{item.ufOrigem}</span>
                          <ArrowRightLeft className="w-3 h-3 text-[var(--atlas-text-muted)]" />
                          <span className="font-bold text-[var(--atlas-navy)]">{item.ufDestino}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium text-[var(--atlas-text)]">
                        R$ {item.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {interstateItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[var(--atlas-text-secondary)]">
                        Nenhuma operação interestadual encontrada (Entrada CFOP 2xxx ou Saída CFOP 6xxx).
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      
      ) : activeTab === 'automacao' ? (
        <div className="space-y-6">
          <div className="atlas-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-[var(--atlas-navy)]">Configuração de Automação</h2>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  Habilite a execução automática de cruzamentos fiscais (NCM + UF) ao importar novos arquivos SPED.
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={autoEnabled} onChange={handleToggleAuto} disabled={isSavingAuto} />
                    <div className={`block w-12 h-7 rounded-full transition-colors ${autoEnabled ? 'bg-[var(--atlas-accent)]' : 'bg-[var(--atlas-border)]'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${autoEnabled ? 'transform translate-x-5' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-xs font-medium text-[var(--atlas-text)]">
                    {autoEnabled ? 'Automação Ativada' : 'Automação Desativada'}
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-[var(--atlas-border)] pt-6">
              <h3 className="text-sm font-bold text-[var(--atlas-navy)] mb-4 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-[var(--atlas-text-secondary)]" />
                <span>Logs de Execução Automática</span>
              </h3>
              
              {autoLogs.length === 0 ? (
                <div className="text-center py-8 text-[var(--atlas-text-secondary)] bg-[var(--atlas-surface-hover)] rounded-lg border border-dashed border-[var(--atlas-border)] text-xs">
                  Nenhum log de automação encontrado.
                </div>
              ) : (
                <div className="space-y-3">
                  {autoLogs.map(log => (
                    <div key={log.id} className="atlas-list-row flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="atlas-pill atlas-pill-navy">Execução Automática</span>
                          <span className="text-xs text-[var(--atlas-text-secondary)]">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-xs font-medium text-[var(--atlas-text)]">SPED Importado: <span className="font-mono">{log.spedId}</span></p>
                      </div>
                      <div className="atlas-pill atlas-pill-warning flex items-center space-x-1.5 py-1.5 px-3">
                        <AlertTriangle className="w-4 h-4 text-[var(--atlas-warning)]" />
                        <span className="font-bold">{log.alteracoes} alterações</span>
                        <span>sugeridas</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'xml_faltantes' ? (
        <div className="space-y-6">
          <div className="atlas-card p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-[var(--atlas-navy)]">Relatório de XMLs Faltantes</h2>
              <p className="text-xs text-[var(--atlas-text-secondary)]">
                Notas de entrada (XMLs de fornecedores) que foram escrituradas no SPED, mas cujos arquivos XML não foram importados na ferramenta.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar Documento ou Chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="atlas-input atlas-input-icon-left"
                />
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="atlas-input w-auto"
                title="Filtrar por Data de Emissão"
              />
            </div>
            {filteredFindings.length === 0 ? (
              <div className="atlas-alert atlas-alert-accent text-center py-6 text-xs">
                <CheckCircle2 className="w-6 h-6 text-[var(--atlas-accent)] mx-auto mb-1.5" />
                Nenhuma nota faltante identificada. Todos os XMLs de entrada listados no SPED foram carregados.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end mb-2">
                  <button onClick={handleExportMissingKeys} className="atlas-btn atlas-btn-primary text-xs py-1.5 px-3">
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar Relatório (TXT)</span>
                  </button>
                </div>
                <div className="border border-[var(--atlas-border)] rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-[var(--atlas-border)] text-xs">
                    <thead className="bg-[var(--atlas-surface-hover)]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--atlas-text-secondary)] uppercase">Documento</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--atlas-text-secondary)] uppercase">Chave de Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--atlas-border)] bg-[var(--atlas-surface)]">
                      {filteredFindings.map(f => {
                        const chv = (f.descricao || '').match(/Chave: (\d{44})/);
                        const chvDisplay = chv ? chv[1] : 'N/A';
                        return (
                          <tr key={f.id} className="hover:bg-[var(--atlas-surface-hover)]">
                            <td className="px-4 py-3 font-medium text-[var(--atlas-text)]">
                              {f.numDoc} {f.serie ? `(Série ${f.serie})` : ''}
                            </td>
                            <td className="px-4 py-3 font-mono text-[var(--atlas-text-secondary)]">
                              {chvDisplay}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (

        <>
          {/* Painel de Diagnóstico Rápido por Gravidade */}
          <div className="atlas-card p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--atlas-border)]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--atlas-navy)] block">
                  Painel de Diagnóstico Rápido de Divergências
                </span>
                <h2 className="text-base font-bold text-[var(--atlas-navy)]">Triagem Automática por Nível de Risco Fiscal</h2>
              </div>

              <div className="flex items-center space-x-2 text-xs text-[var(--atlas-text-secondary)]">
                <span>Filtrar por gravidade:</span>
                <button
                  onClick={() => setSeverityFilter('ALL')}
                  className={`atlas-btn py-1 px-2.5 text-xs ${severityFilter === 'ALL' ? 'atlas-btn-primary' : 'atlas-btn-secondary'}`}
                >
                  Todos ({totalFindings})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Crítico / Alto Risco */}
              <button
                onClick={() => setSeverityFilter('alta')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  severityFilter === 'alta'
                    ? 'bg-[var(--atlas-danger-bg)] border-[var(--atlas-danger)] text-[var(--atlas-danger)]'
                    : 'bg-[var(--atlas-surface)] border-[var(--atlas-border)] hover:border-[var(--atlas-danger)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-[var(--atlas-danger)]">
                    <ShieldAlert className="w-4 h-4 mr-1" />
                    Crítico (Alto Risco)
                  </span>
                  <span className="text-xl font-bold font-mono text-[var(--atlas-danger)]">{highSeverityCount}</span>
                </div>
                <p className="text-[11px] text-[var(--atlas-text-secondary)]">
                  Divergências de ICMS, escrituração omissa, desalinhamento C100 x XML e apuração.
                </p>
              </button>

              {/* Aviso / Risco Médio */}
              <button
                onClick={() => setSeverityFilter('media')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  severityFilter === 'media'
                    ? 'bg-[var(--atlas-warning-bg)] border-[var(--atlas-warning)] text-[var(--atlas-warning)]'
                    : 'bg-[var(--atlas-surface)] border-[var(--atlas-border)] hover:border-[var(--atlas-warning)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-[var(--atlas-warning)]">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    Aviso (Risco Médio)
                  </span>
                  <span className="text-xl font-bold font-mono text-[var(--atlas-warning)]">{mediumSeverityCount}</span>
                </div>
                <p className="text-[11px] text-[var(--atlas-text-secondary)]">
                  Incompatibilidades de MVA/CFOP, CST e divergência parcial de aliquotas.
                </p>
              </button>

              {/* Informativo / Otimização */}
              <button
                onClick={() => setSeverityFilter('baixa')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  severityFilter === 'baixa'
                    ? 'bg-[var(--atlas-navy-tint)] border-[var(--atlas-navy)] text-[var(--atlas-navy)]'
                    : 'bg-[var(--atlas-surface)] border-[var(--atlas-border)] hover:border-[var(--atlas-navy)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider text-[var(--atlas-navy)]">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Informativo (Otimização)
                  </span>
                  <span className="text-xl font-bold font-mono text-[var(--atlas-navy)]">{lowSeverityCount}</span>
                </div>
                <p className="text-[11px] text-[var(--atlas-text-secondary)]">
                  Falta de cBenef exigido na UF, notas de ajuste sem chave vinculada.
                </p>
              </button>
            </div>
          </div>

          {/* Batch Operations Floating Bar if items selected */}
          {selectedFindingIds.size > 0 && (
            <div className="sticky top-4 z-30 bg-[var(--atlas-navy)] text-white rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="atlas-pill atlas-pill-accent">
                  {selectedFindingIds.size} selecionado(s)
                </span>
                <span className="text-xs text-white/90 font-semibold">
                  Ações em Lote para Apontamentos Selecionados:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBatchStatusUpdate('aprovado')}
                  className="atlas-btn atlas-btn-accent text-xs py-1.5 px-3"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aprovar Lote</span>
                </button>

                <button
                  onClick={() => handleBatchStatusUpdate('rejeitado')}
                  className="atlas-btn bg-[var(--atlas-danger)] text-white hover:opacity-90 text-xs py-1.5 px-3"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Rejeitar Lote</span>
                </button>

                <button
                  onClick={() => handleBatchStatusUpdate('pendente')}
                  className="atlas-btn atlas-btn-secondary text-xs py-1.5 px-3"
                >
                  <span>Marcar Pendente</span>
                </button>

                <button
                  onClick={() => setSelectedFindingIds(new Set())}
                  className="text-xs text-white/70 hover:text-white px-2 py-1 cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>
          )}

          {/* Metrics Bar */}
          <div className="atlas-stat-strip">
            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Total Achados</span>
              <span className="atlas-stat-value text-[var(--atlas-navy)]">{totalFindings}</span>
            </div>
            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Pendentes</span>
              <span className="atlas-stat-value text-[var(--atlas-warning)]">{pendingCount}</span>
            </div>
            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Aprovados</span>
              <span className="atlas-stat-value text-[var(--atlas-accent)]">{approvedCount}</span>
            </div>
            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Rejeitados</span>
              <span className="atlas-stat-value text-[var(--atlas-danger)]">{rejectedCount}</span>
            </div>
          </div>

          {/* Filters Bar: Reconstructed into a clean single container */}
          <div className="atlas-card p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="atlas-input w-auto text-xs py-1.5"
              >
                <option value="ALL">Todos os Tipos</option>
                <option value="BASE_ICMS_INCONSISTENTE">Base ICMS Inconsistente</option>
                <option value="CST_INCOMPATIVEL_NCM">CST Incompatível com NCM</option>
                <option value="CFOP_INCOMPATIVEL">CFOP Incompatível</option>
                <option value="CREDITO_USO_CONSUMO_VEDADO">Crédito Uso e Consumo Vedado</option>
                <option value="CREDITO_ATIVO_IMOBILIZADO_REQUER_HISTORICO">Crédito Ativo Imobilizado (CIAP)</option>
                <option value="CST_SEM_DIREITO_CREDITO">CST sem Direito a Crédito</option>
                <option value="VALOR_DIVERGENTE_XML_SPED">Valor Divergente XML x SPED</option>
                <option value="CNPJ_DIVERGENTE_XML_SPED">CNPJ Divergente XML x SPED</option>
                <option value="CHAVE_DUPLICADA">Chave Duplicada</option>
                <option value="NOTA_ENTRADA_NAO_ESCRITURADA">Nota de Entrada não Escriturada</option>
                <option value="NOTA_SPED_SEM_XML">Nota no SPED sem XML</option>
                <option value="NOTA_SAIDA_NAO_ESCRITURADA">Nota de Saída não Escriturada</option>
                <option value="APURACAO_MATEMATICA_INCONSISTENTE">Apuração: Matemática Inconsistente (E110)</option>
                <option value="APURACAO_DEBITO_DIVERGENTE_C190">Apuração: Débito Divergente C190</option>
                <option value="APURACAO_CREDITO_DIVERGENTE_C190">Apuração: Crédito Divergente C190</option>
                <option value="CST_CFOP_INCOMPATIVEL">CST 100/300 em Operação Normal (CFOP 1102)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="atlas-input w-auto text-xs py-1.5"
              >
                <option value="ALL">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="aprovado">Aprovado</option>
                <option value="rejeitado">Rejeitado</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="atlas-input w-auto text-xs py-1.5"
              >
                <option value="ALL">Todas Severidades</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>

              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="atlas-input w-auto text-xs py-1.5"
                title="Filtrar por Data de Emissão"
              />

              <input
                type="text"
                placeholder="NCM..."
                value={ncmFilter}
                onChange={(e) => setNcmFilter(e.target.value)}
                className="atlas-input w-24 text-xs py-1.5"
                title="Filtrar por NCM"
              />
            </div>

            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-[var(--atlas-text-muted)] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="atlas-input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {/* Active Audit Filters Badges Indicator Bar */}
          {activeAuditFiltersCount > 0 && (
            <div className="atlas-alert atlas-alert-info flex flex-wrap items-center gap-2 p-2.5 text-xs">
              <div className="flex items-center font-bold text-[11px] mr-1 text-[var(--atlas-info)]">
                <Filter className="w-3.5 h-3.5 mr-1" />
                <span>Filtros Ativos ({activeAuditFiltersCount}):</span>
              </div>

              {selectedFilter !== 'ALL' && (
                <span className="atlas-pill atlas-pill-neutral">
                  Tipo: {selectedFilter}
                  <button onClick={() => setSelectedFilter('ALL')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {statusFilter !== 'ALL' && (
                <span className="atlas-pill atlas-pill-neutral">
                  Status: {statusFilter}
                  <button onClick={() => setStatusFilter('ALL')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {severityFilter !== 'ALL' && (
                <span className="atlas-pill atlas-pill-neutral">
                  Severidade: {severityFilter}
                  <button onClick={() => setSeverityFilter('ALL')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchTerm.trim() !== '' && (
                <span className="atlas-pill atlas-pill-neutral">
                  Busca: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {dateFilter && (
                <span className="atlas-pill atlas-pill-neutral">
                  Data: {dateFilter}
                  <button onClick={() => setDateFilter('')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {ncmFilter.trim() !== '' && (
                <span className="atlas-pill atlas-pill-neutral">
                  NCM: "{ncmFilter}"
                  <button onClick={() => setNcmFilter('')} className="ml-1 hover:text-[var(--atlas-danger)]">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={clearAllAuditFilters}
                className="ml-auto text-xs text-[var(--atlas-danger)] hover:underline cursor-pointer font-medium"
                title="Limpar todos os filtros com 1 clique"
              >
                Limpar Todos
              </button>
            </div>
          )}

          {/* Apuração do Período (Bloco E110) Card if present */}
          {spedData?.apuracao && (
            <div className="atlas-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-[var(--atlas-navy)]">Apuração do Período (Registro E110)</h2>
                  <p className="text-xs text-[var(--atlas-text-secondary)]">Resumo oficial de débitos, créditos e saldos apurados no SPED Fiscal</p>
                </div>
                <span className="atlas-pill atlas-pill-navy">
                  Bloco E Ativo
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Total Débitos</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlTotDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Aj. Débitos</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlAjDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Estornos Crédito</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlEstornosCred.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Total Créditos</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlTotCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Aj. Créditos</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlAjCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-surface-hover)] p-3 rounded-lg border border-[var(--atlas-border)]">
                  <div className="text-[11px] text-[var(--atlas-text-secondary)] font-medium">Saldo Credor Ant.</div>
                  <div className="text-sm font-bold text-[var(--atlas-text)] mt-0.5">R$ {spedData.apuracao.vlSldCredorAnt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
                <div className="bg-[var(--atlas-navy-tint)] p-3 rounded-lg border border-[var(--atlas-navy)]/20">
                  <div className="text-[11px] text-[var(--atlas-navy)] font-semibold">ICMS a Recolher</div>
                  <div className="text-sm font-bold text-[var(--atlas-navy)] mt-0.5">R$ {spedData.apuracao.vlIcmsRecolher.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          )}

          {/* Findings List Header & Batch Select Toggle */}
          <div className="atlas-card p-3 flex items-center justify-between text-xs">
            <label htmlFor="checkbox-select-all-findings" className="flex items-center space-x-2 font-bold text-[var(--atlas-text)] cursor-pointer select-none">
              <input
                id="checkbox-select-all-findings"
                type="checkbox"
                checked={filteredFindings.length > 0 && selectedFindingIds.size === filteredFindings.length}
                onChange={handleSelectAllFiltered}
                className="w-4 h-4 text-[var(--atlas-navy)] rounded border-[var(--atlas-border)] focus:ring-[var(--atlas-navy)] cursor-pointer"
              />
              <span>Selecionar Todos ({filteredFindings.length} itens)</span>
            </label>

            <span className="text-[var(--atlas-text-secondary)]">
              {selectedFindingIds.size} de {filteredFindings.length} selecionado(s)
            </span>
          </div>

          {/* Findings List */}
          <div className="space-y-3">
            {filteredFindings.length === 0 ? (
              <div className="atlas-card p-8 text-center text-[var(--atlas-text-secondary)] text-xs">
                Nenhum achado encontrado com os filtros selecionados.
              </div>
            ) : (
              filteredFindings.map((finding) => {
                const hasCorrection = finding.correcaoSugerida && finding.correcaoSugerida.length > 0;
                const hasDraft = !!finding.rascunhoLancamento;
                const isSelected = selectedFindingIds.has(finding.id);

                return (
                  <div
                    key={finding.id}
                    className={`atlas-card p-5 transition-all relative ${
                      isSelected
                        ? 'border-[var(--atlas-navy)] ring-1 ring-[var(--atlas-navy)]'
                        : finding.statusRevisao === 'aprovado'
                        ? 'border-[var(--atlas-accent)]/40'
                        : finding.statusRevisao === 'rejeitado'
                        ? 'border-[var(--atlas-danger)]/40'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectFinding(finding.id)}
                          className="mt-1 w-4 h-4 text-[var(--atlas-navy)] rounded border-[var(--atlas-border)] cursor-pointer"
                        />

                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`atlas-pill ${
                              finding.severidade === 'alta'
                                ? 'atlas-pill-danger'
                                : finding.severidade === 'media'
                                ? 'atlas-pill-warning'
                                : 'atlas-pill-neutral'
                            }`}
                          >
                            {finding.severidade}
                          </span>
                          <span className="text-xs font-mono text-[var(--atlas-text-secondary)]">
                            Doc: {finding.numDoc} {finding.serie ? `(Série ${finding.serie})` : ''} {finding.numItem ? `| Item: ${finding.numItem} - ${finding.codItem || ''}` : ''}
                          </span>
                          <span
                            className={`atlas-pill ${
                              finding.statusRevisao === 'aprovado'
                                ? 'atlas-pill-accent'
                                : finding.statusRevisao === 'rejeitado'
                                ? 'atlas-pill-danger'
                                : 'atlas-pill-neutral'
                            }`}
                          >
                            {(finding.statusRevisao || 'pendente').toUpperCase()}
                          </span>
                        </div>

                        <h2 className="text-base font-bold text-[var(--atlas-navy)]">{finding.titulo}</h2>
                        <p className="text-xs text-[var(--atlas-text)] leading-relaxed">{finding.descricao}</p>
                        {finding.baseLegal && (
                          <p className="text-xs text-[var(--atlas-text-secondary)] font-medium">
                            <strong className="text-[var(--atlas-text)]">Base Legal / Observação:</strong> {finding.baseLegal}
                          </p>
                        )}

                        {/* Suggested Corrections section */}
                        {hasCorrection && (
                          <div className="mt-3 p-3 bg-[var(--atlas-surface-hover)] rounded-lg border border-[var(--atlas-border)] space-y-2">
                            <div className="text-xs font-semibold text-[var(--atlas-navy)] uppercase tracking-wide flex items-center space-x-1.5">
                              <CheckCircle2 className="w-4 h-4 text-[var(--atlas-accent)]" />
                              <span>Sugestão de Correção Determinística</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {finding.correcaoSugerida!.map((corr, idx) => (
                                <div key={idx} className="bg-[var(--atlas-surface)] p-2.5 rounded-lg border border-[var(--atlas-border)] text-xs space-y-1">
                                  <div className="text-[11px] text-[var(--atlas-text-secondary)]">Campo: <span className="font-mono text-[var(--atlas-text)]">{corr.campo}</span></div>
                                  <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-[var(--atlas-danger)]">Declarado: {String(corr.valorDeclarado)}</span>
                                    <span className="text-[var(--atlas-accent)] font-bold">Sugerido: {String(corr.valorSugerido)}</span>
                                  </div>
                                  <div className="text-[10px] text-[var(--atlas-text-muted)] italic mt-0.5">Origem: {corr.origemSugestao}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Draft Launch section */}
                        {hasDraft && finding.rascunhoLancamento && (
                          <div className="mt-3 p-3 bg-[var(--atlas-warning-bg)] rounded-lg border border-[var(--atlas-warning)]/30 space-y-2 text-xs">
                            <div className="font-semibold text-[var(--atlas-warning)] uppercase tracking-wide flex items-center space-x-1.5">
                              <FileText className="w-4 h-4 text-[var(--atlas-warning)]" />
                              <span>Rascunho de Lançamento (Dados Objetivos do XML)</span>
                            </div>
                            <div className="bg-[var(--atlas-surface)] p-2.5 rounded-lg border border-[var(--atlas-border)] font-mono space-y-1">
                              {Object.entries(finding.rascunhoLancamento.camposPreenchidos).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                  <span className="text-[var(--atlas-text-secondary)]">{k}:</span>
                                  <span className="text-[var(--atlas-text)] font-medium">{String(v)}</span>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-[var(--atlas-border)] font-sans font-medium text-[var(--atlas-warning)]">
                                Requer Ajuste Manual: {finding.rascunhoLancamento.camposRequerAjusteManual.join(', ')}
                              </div>
                              <div className="text-[var(--atlas-text-secondary)] font-sans italic pt-0.5">{finding.rascunhoLancamento.observacao}</div>
                            </div>
                            <button
                              onClick={() => handleCopyDraft(JSON.stringify(finding.rascunhoLancamento?.camposPreenchidos, null, 2), finding.id)}
                              className="atlas-btn atlas-btn-secondary text-xs py-1 px-3"
                            >
                              {copiedId === finding.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedId === finding.id ? 'Copiado' : 'Copiar Dados'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                      {/* Actions: Approve / Reject for corrections */}
                      <div className="flex md:flex-col items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-[var(--atlas-border)]">
                        {hasCorrection ? (
                          <>
                            <button
                              onClick={() => handleReview(finding.id, 'aprovado')}
                              className={`w-full atlas-btn py-1.5 px-3 text-xs ${
                                finding.statusRevisao === 'aprovado'
                                  ? 'atlas-btn-accent'
                                  : 'atlas-btn-secondary'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              onClick={() => handleReview(finding.id, 'rejeitado')}
                              className={`w-full atlas-btn py-1.5 px-3 text-xs ${
                                finding.statusRevisao === 'rejeitado'
                                  ? 'bg-[var(--atlas-danger)] text-white'
                                  : 'atlas-btn-secondary text-[var(--atlas-danger)]'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeitar</span>
                            </button>
                          </>
                        ) : (
                          <div className="text-[11px] text-[var(--atlas-text-muted)] italic text-center md:text-right px-2">
                            Requer investigação
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {showC190AuditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <AuditLogViewer
            c190AuditLogs={c190AuditLogs}
            onClose={() => setShowC190AuditModal(false)}
          />
        </div>
      )}
    </div>
  );

}
