import React, { useState, useMemo, useEffect, useRef } from 'react';
import { SpedData, AuditConfig, Achado, XmlRecord, StatusRevisao, NotificationType } from '../types';
import { executarAuditoriaUnificada, salvarStatusRevisao } from '../lib/auditEngine';
import { fetchGlobalStateTaxMatrix } from '../lib/matrizService';
import { saveLearnedRule } from '../lib/roboFiscalService';
import { Database, ShieldAlert, Search, Filter, CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Copy, Check, Download, ArrowRightLeft, Settings, PlayCircle, X } from 'lucide-react';
import { isAutoCrosscheckEnabled, setAutoCrosscheckEnabled, getAutomationLogs, logAutomationRun, AutomationLog } from '../lib/automationService';

interface AdvancedAuditViewProps {
  spedData: SpedData | null;
  auditConfig: AuditConfig | null;
  xmlTerceiros?: XmlRecord[];
  xmlProprio?: XmlRecord[];
  xmlNfce?: XmlRecord[];
  escritorioId?: string;
  addNotification?: (title: string, message: string, type: NotificationType, actionUrl?: string) => void;
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
  addNotification
}: AdvancedAuditViewProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>(() => getAuditSavedString('selectedFilter', 'ALL'));
  const [statusFilter, setStatusFilter] = useState<string>(() => getAuditSavedString('statusFilter', 'ALL'));
  const [severityFilter, setSeverityFilter] = useState<string>(() => getAuditSavedString('severityFilter', 'ALL'));
  const [searchTerm, setSearchTerm] = useState<string>(() => getAuditSavedString('searchTerm', ''));
  const [dateFilter, setDateFilter] = useState<string>(() => getAuditSavedString('dateFilter', ''));
  const [ncmFilter, setNcmFilter] = useState<string>(() => getAuditSavedString('ncmFilter', ''));
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
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
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Central de Auditoria</h1>
          <p className="text-sm text-slate-500 mt-1">Revisão automatizada e orientada para redução de 70% do trabalho manual em SPED</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          <button
            onClick={handleFinalizarConferencia}
            disabled={isFinalizing}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Database className="w-4 h-4" />
            <span>{isFinalizing ? 'Finalizando...' : 'Finalizar Conferência'}</span>
          </button>
          {filteredFindings.some(f => f.tipo === 'NOTA_SPED_SEM_XML') && (
            <button
              onClick={handleExportMissingKeys}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
              title="Baixar chaves que constam no SPED mas faltam no XML importado"
            >
              <FileText className="w-4 h-4" />
              <span>Chaves Faltantes</span>
            </button>
          )}
          <button
            onClick={handleExportCsv}
            className="bg-[#1e3a5f] hover:bg-[#142c47] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
          <div className="bg-[#f1efe8] border border-[#e5e2d9] rounded-lg px-4 py-2 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-[#0f6e56]" />
            <span className="text-xs font-semibold text-[#1e3a5f]">
              {withCorrectionCount} com Correção Pronta ({Math.round((withCorrectionCount / (totalFindings || 1)) * 100)}% automação)
            </span>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-xs font-semibold text-amber-950">
              {requiresInvestigationCount} Exigem Investigação
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 mb-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('achados')}
          className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'achados' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4" />
            <span>Achados de Auditoria</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('interestadual')}
          className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'interestadual' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <ArrowRightLeft className="w-4 h-4" />
            <span>ICMS Interestadual (NCM x CST)</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('automacao')}
          className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'automacao' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Automação & Logs</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('xml_faltantes')}
          className={`pb-3 px-1 border-b-2 text-sm font-medium transition-colors cursor-pointer ${activeTab === 'xml_faltantes' ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4" />
            <span>XMLs Faltantes</span>
          </div>
        </button>

      </div>

      {activeTab === 'interestadual' ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Análise de Operações Interestaduais (ICMS-ST / DIFAL)</h2>
              <p className="text-sm text-slate-500">
                Módulo para cruzamento de produtos (NCM) com a tributação aplicada (CST/CFOP) considerando os Estados de Origem e Destino. 
                Utilizado para destacar inconsistências no imposto DIFAL ou de Substituição Tributária.
              </p>
            </div>
            
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar NCM, CST, UF ou Nota..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <th className="p-4">Documento</th>
                    <th className="p-4">Produto</th>
                    <th className="p-4">NCM</th>
                    <th className="p-4">CFOP / CST</th>
                    <th className="p-4 text-center">Origem &rarr; Destino</th>
                    <th className="p-4 text-right">Valor Operação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {interstateItems
                    .filter(item => 
                      item.ncm.includes(searchTerm) || 
                      item.cst.includes(searchTerm) ||
                      item.ufOrigem.includes(searchTerm.toUpperCase()) ||
                      item.ufDestino.includes(searchTerm.toUpperCase()) ||
                      item.numDoc.includes(searchTerm)
                    )
                    .map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">NF {item.numDoc}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]" title={item.chvNfe}>{item.chvNfe || 'Sem Chave'}</div>
                      </td>
                      <td className="p-4 text-slate-700">
                        <div className="truncate max-w-xs">{item.desc}</div>
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-800">{item.ncm}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">CFOP {item.cfop}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.cst.endsWith('10') || item.cst.endsWith('70') || item.cst.endsWith('60') ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                            CST {item.cst}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <span className="font-bold text-slate-700">{item.ufOrigem}</span>
                          <ArrowRightLeft className="w-3 h-3 text-slate-400" />
                          <span className="font-bold text-[#1e3a5f]">{item.ufDestino}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-medium text-slate-900">
                        R$ {item.vlOpr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  {interstateItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-500">
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
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Configuração de Automação</h2>
                <p className="text-sm text-slate-500">
                  Habilite a execução automática de cruzamentos fiscais (NCM + UF) ao importar novos arquivos SPED.
                </p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <div className="relative">
                    <input type="checkbox" className="sr-only" checked={autoEnabled} onChange={handleToggleAuto} disabled={isSavingAuto} />
                    <div className={`block w-14 h-8 rounded-full transition-colors ${autoEnabled ? 'bg-[#0f6e56]' : 'bg-slate-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${autoEnabled ? 'transform translate-x-6' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-sm font-medium text-slate-700">
                    {autoEnabled ? 'Automação Ativada' : 'Automação Desativada'}
                  </div>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-md font-bold text-slate-800 mb-4 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-slate-500" />
                <span>Logs de Execução Automática</span>
              </h3>
              
              {autoLogs.length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                  Nenhum log de automação encontrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {autoLogs.map(log => (
                    <div key={log.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-semibold bg-[#f1efe8] text-[#1e3a5f] px-2 py-0.5 rounded uppercase tracking-wide">Execução Automática</span>
                          <span className="text-sm text-slate-500">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                        </div>
                        <p className="text-sm font-medium text-slate-800">SPED Importado: <span className="font-mono">{log.spedId}</span></p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5" />
                        <span className="font-bold">{log.alteracoes} alterações</span>
                        <span className="text-sm font-medium">sugeridas identificadas</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      ) : activeTab === 'xml_faltantes' ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">Relatório de XMLs Faltantes</h2>
              <p className="text-sm text-slate-500">
                Notas de entrada (XMLs de fornecedores) que foram escrituradas no SPED, mas cujos arquivos XML não foram importados na ferramenta.
              </p>
            </div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Buscar Documento ou Chave..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
                />
              </div>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
                title="Filtrar por Data de Emissão"
              />
            </div>
            {filteredFindings.length === 0 ? (
              <div className="text-center py-8 text-slate-500 bg-emerald-50 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                Nenhuma nota faltante identificada. Todos os XMLs de entrada listados no SPED foram carregados.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <button onClick={handleExportMissingKeys} className="bg-[#1e3a5f] hover:bg-[#142c47] text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 shadow-sm transition-all cursor-pointer">
                    <Download className="w-4 h-4" />
                    <span>Baixar Relatório (TXT)</span>
                  </button>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Documento</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Chave de Acesso</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {filteredFindings.map(f => {
                        const chv = (f.descricao || '').match(/Chave: (\d{44})/);
                        const chvDisplay = chv ? chv[1] : 'N/A';
                        return (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                              {f.numDoc} {f.serie ? `(Série ${f.serie})` : ''}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-500">
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

        </div>
      ) : (

        <>
          {/* Painel de Diagnóstico Rápido por Gravidade */}
          <div className="bg-white rounded-lg p-5 mb-6 text-slate-900 border border-slate-200 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1e3a5f] block mb-1">
                  Painel de Diagnóstico Rápido de Divergências
                </span>
                <h2 className="text-lg font-bold text-slate-900">Triagem Automática por Nível de Risco Fiscal</h2>
              </div>

              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>Filtrar por gravidade:</span>
                <button
                  onClick={() => setSeverityFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition font-bold cursor-pointer ${
                    severityFilter === 'ALL' ? 'bg-[#1e3a5f] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  Todos ({totalFindings})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Crítico / Alto Risco */}
              <button
                onClick={() => setSeverityFilter('alta')}
                className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                  severityFilter === 'alta'
                    ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-300'
                    : 'bg-slate-50 border-slate-200 hover:border-rose-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center text-xs font-bold uppercase text-rose-700 tracking-wider">
                    <ShieldAlert className="w-4 h-4 mr-1 text-rose-600" />
                    Crítico (Alto Risco)
                  </span>
                  <span className="text-xl font-bold text-rose-700 font-mono">{highSeverityCount}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Divergências de ICMS, escrituração omissa, desalinhamento C100 x XML e apuração.
                </p>
              </button>

              {/* Aviso / Risco Médio */}
              <button
                onClick={() => setSeverityFilter('media')}
                className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                  severityFilter === 'media'
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-300'
                    : 'bg-slate-50 border-slate-200 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center text-xs font-bold uppercase text-amber-800 tracking-wider">
                    <AlertTriangle className="w-4 h-4 mr-1 text-amber-600" />
                    Aviso (Risco Médio)
                  </span>
                  <span className="text-xl font-bold text-amber-800 font-mono">{mediumSeverityCount}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Incompatibilidades de MVA/CFOP, CST e divergência parcial de aliquotas.
                </p>
              </button>

              {/* Informativo / Otimização */}
              <button
                onClick={() => setSeverityFilter('baixa')}
                className={`p-4 rounded-lg border text-left transition-all cursor-pointer ${
                  severityFilter === 'baixa'
                    ? 'bg-[#f1efe8] border-[#1e3a5f] ring-2 ring-[#1e3a5f]/30'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-flex items-center text-xs font-bold uppercase text-[#1e3a5f] tracking-wider">
                    <CheckCircle2 className="w-4 h-4 mr-1 text-[#1e3a5f]" />
                    Informativo (Otimização)
                  </span>
                  <span className="text-xl font-bold text-[#1e3a5f] font-mono">{lowSeverityCount}</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Falta de cBenef exigido na UF, notas de ajuste sem chave vinculada.
                </p>
              </button>
            </div>
          </div>

          {/* Batch Operations Floating Bar if items selected */}
          {selectedFindingIds.size > 0 && (
            <div className="sticky top-4 z-30 bg-[#1e3a5f] text-white rounded-lg p-4 border border-[#142c47] shadow-md flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center space-x-3">
                <span className="bg-[#0f6e56] text-white font-black text-xs px-2.5 py-1 rounded-lg font-mono">
                  {selectedFindingIds.size} selecionado(s)
                </span>
                <span className="text-xs text-slate-200 font-semibold">
                  Ações em Lote para Apontamentos Selecionados:
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => handleBatchStatusUpdate('aprovado')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  <span>Aprovar Lote Selecionado</span>
                </button>

                <button
                  onClick={() => handleBatchStatusUpdate('rejeitado')}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1 shadow-sm transition cursor-pointer"
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  <span>Rejeitar Lote Selecionado</span>
                </button>

                <button
                  onClick={() => handleBatchStatusUpdate('pendente')}
                  className="bg-[#142c47] hover:bg-[#1e3a5f] text-slate-200 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition cursor-pointer"
                >
                  <span>Marcar como Pendente</span>
                </button>

                <button
                  onClick={() => setSelectedFindingIds(new Set())}
                  className="text-xs text-slate-300 hover:text-white px-2 py-1 ml-2 cursor-pointer"
                >
                  Limpar Seleção
                </button>
              </div>
            </div>
          )}

          {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-all">
          <div className="text-xs text-slate-500 font-semibold tracking-wide uppercase">Total de Achados</div>
          <div className="text-3xl font-bold text-slate-800 mt-2">{totalFindings}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-amber-300 transition-all">
          <div className="text-xs text-amber-600 font-semibold tracking-wide uppercase">Pendentes de Revisão</div>
          <div className="text-3xl font-bold text-amber-600 mt-2">{pendingCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-emerald-300 transition-all">
          <div className="text-xs text-emerald-600 font-semibold tracking-wide uppercase">Aprovados</div>
          <div className="text-3xl font-bold text-emerald-600 mt-2">{approvedCount}</div>
        </div>
        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm hover:border-rose-300 transition-all">
          <div className="text-xs text-rose-600 font-semibold tracking-wide uppercase">Rejeitados</div>
          <div className="text-3xl font-bold text-rose-600 mt-2">{rejectedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="ALL">Todos os Tipos de Achado</option>
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
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="ALL">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="aprovado">Aprovado</option>
            <option value="rejeitado">Rejeitado</option>
          </select>


          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            title="Filtrar por Data de Emissão"
          />
          <input
            type="text"
            placeholder="NCM..."
            value={ncmFilter}
            onChange={(e) => setNcmFilter(e.target.value)}
            className="w-24 px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
            title="Filtrar por NCM"
          />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]"
          >
            <option value="ALL">Todas as Severidades</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Pesquisar por doc, item ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white"
          />
        </div>
      </div>

      {/* Active Audit Filters Badges Indicator Bar */}
      {activeAuditFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-3 mb-6 bg-indigo-50/80 border border-indigo-100 rounded-lg text-xs">
          <div className="flex items-center text-indigo-900 font-bold text-[11px] mr-1">
            <Filter className="w-3.5 h-3.5 mr-1 text-indigo-600" />
            <span>Filtros Ativos ({activeAuditFiltersCount}):</span>
          </div>

          {selectedFilter !== 'ALL' && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              Tipo: {selectedFilter}
              <button onClick={() => setSelectedFilter('ALL')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {statusFilter !== 'ALL' && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              Status: {statusFilter}
              <button onClick={() => setStatusFilter('ALL')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {severityFilter !== 'ALL' && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              Severidade: {severityFilter}
              <button onClick={() => setSeverityFilter('ALL')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {searchTerm.trim() !== '' && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              Busca: "{searchTerm}"
              <button onClick={() => setSearchTerm('')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {dateFilter && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              Data: {dateFilter}
              <button onClick={() => setDateFilter('')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {ncmFilter.trim() !== '' && (
            <span className="inline-flex items-center px-2 py-1 rounded bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
              NCM: "{ncmFilter}"
              <button onClick={() => setNcmFilter('')} className="ml-1 text-slate-400 hover:text-rose-600">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          <button
            onClick={clearAllAuditFilters}
            className="ml-auto px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-[11px] flex items-center space-x-1 shadow-2xs transition-colors"
            title="Limpar todos os filtros com 1 clique"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar Todos os Filtros</span>
          </button>
        </div>
      )}

      {/* Apuração do Período (Bloco E110) Card if present */}
      {spedData?.apuracao && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Apuração do Período (Registro E110)</h2>
              <p className="text-xs text-slate-500">Resumo oficial de débitos, créditos e saldos apurados no SPED Fiscal</p>
            </div>
            <span className="px-3 py-1 bg-[#f1efe8] text-[#1e3a5f] rounded-lg text-xs font-semibold">
              Bloco E Ativo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Total Débitos</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlTotDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Aj. Débitos</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlAjDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Estornos Crédito</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlEstornosCred.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Total Créditos</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlTotCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Aj. Créditos</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlAjCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">Saldo Credor Ant.</div>
              <div className="text-sm font-bold text-slate-800 mt-0.5">R$ {spedData.apuracao.vlSldCredorAnt.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
            <div className="bg-[#f1efe8] p-3 rounded-lg border border-[#e5e2d9]">
              <div className="text-[11px] text-[#1e3a5f] font-semibold">ICMS a Recolher</div>
              <div className="text-sm font-bold text-[#142c47] mt-0.5">R$ {spedData.apuracao.vlIcmsRecolher.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      )}

      {/* Findings List Header & Batch Select Toggle */}
      <div className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200 shadow-sm mb-4 text-xs">
        <label htmlFor="checkbox-select-all-findings" className="flex items-center space-x-2 font-bold text-slate-700 cursor-pointer select-none">
          <input
            id="checkbox-select-all-findings"
            type="checkbox"
            checked={filteredFindings.length > 0 && selectedFindingIds.size === filteredFindings.length}
            onChange={handleSelectAllFiltered}
            className="w-4 h-4 text-[#1e3a5f] rounded border-slate-300 focus:ring-[#1e3a5f] cursor-pointer"
          />
          <span>Selecionar Todos da Lista ({filteredFindings.length} itens)</span>
        </label>

        <span className="text-slate-400">
          {selectedFindingIds.size} de {filteredFindings.length} selecionado(s)
        </span>
      </div>

      {/* Findings List */}
      <div className="space-y-4">
        {filteredFindings.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
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
                className={`bg-white rounded-lg border shadow-sm p-6 transition-all relative ${
                  isSelected
                    ? 'ring-2 ring-[#1e3a5f] border-[#1e3a5f] bg-[#f1efe8]/30'
                    : finding.statusRevisao === 'aprovado'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : finding.statusRevisao === 'rejeitado'
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectFinding(finding.id)}
                      className="mt-1 w-4 h-4 text-[#1e3a5f] rounded border-slate-300 focus:ring-[#1e3a5f] cursor-pointer"
                    />

                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          finding.severidade === 'alta'
                            ? 'bg-rose-100 text-rose-700'
                            : finding.severidade === 'media'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {finding.severidade}
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        Doc: {finding.numDoc} {finding.serie ? `(Série ${finding.serie})` : ''} {finding.numItem ? `| Item: ${finding.numItem} - ${finding.codItem || ''}` : ''}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          finding.statusRevisao === 'aprovado'
                            ? 'bg-emerald-100 text-emerald-800'
                            : finding.statusRevisao === 'rejeitado'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {(finding.statusRevisao || 'pendente').toUpperCase()}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900">{finding.titulo}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed">{finding.descricao}</p>
                    {finding.baseLegal && (
                      <p className="text-xs text-slate-500 font-medium">
                        <strong className="text-slate-700">Base Legal / Observação:</strong> {finding.baseLegal}
                      </p>
                    )}

                    {/* Suggested Corrections section */}
                    {hasCorrection && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide flex items-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4 text-[#1e3a5f]" />
                          <span>Sugestão de Correção Determinística</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {finding.correcaoSugerida!.map((corr, idx) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs space-y-1">
                              <div className="text-xs text-slate-400 font-medium">Campo: <span className="font-mono text-slate-700">{corr.campo}</span></div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-rose-600 font-semibold">Declarado: {String(corr.valorDeclarado)}</span>
                                <span className="text-emerald-600 font-bold">Sugerido: {String(corr.valorSugerido)}</span>
                              </div>
                              <div className="text-xs text-slate-500 italic mt-1">Origem: {corr.origemSugestao}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Draft Launch section */}
                    {hasDraft && finding.rascunhoLancamento && (
                      <div className="mt-4 p-4 bg-amber-50/60 rounded-lg border border-amber-200 space-y-3">
                        <div className="text-xs font-semibold text-amber-900 uppercase tracking-wide flex items-center space-x-1.5">
                          <FileText className="w-4 h-4 text-amber-700" />
                          <span>Rascunho de Lançamento (Dados Objetivos do XML)</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-amber-200 text-xs font-mono space-y-1">
                          {Object.entries(finding.rascunhoLancamento.camposPreenchidos).map(([k, v]) => (
                            <div key={k} className="flex justify-between">
                              <span className="text-slate-500">{k}:</span>
                              <span className="text-slate-800 font-medium">{String(v)}</span>
                            </div>
                          ))}
                          <div className="pt-2 border-t border-slate-100 text-amber-800 font-sans font-medium">
                            Requer Ajuste Manual: {finding.rascunhoLancamento.camposRequerAjusteManual.join(', ')}
                          </div>
                          <div className="text-slate-500 font-sans italic pt-1">{finding.rascunhoLancamento.observacao}</div>
                        </div>
                        <button
                          onClick={() => handleCopyDraft(JSON.stringify(finding.rascunhoLancamento?.camposPreenchidos, null, 2), finding.id)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
                        >
                          {copiedId === finding.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === finding.id ? 'Copiado' : 'Copiar Dados do Rascunho'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                  {/* Actions: Approve / Reject for corrections */}
                  <div className="flex md:flex-col items-center gap-2 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
                    {hasCorrection ? (
                      <>
                        <button
                          onClick={() => handleReview(finding.id, 'aprovado')}
                          className={`w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            finding.statusRevisao === 'aprovado'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprovar Correção</span>
                        </button>
                        <button
                          onClick={() => handleReview(finding.id, 'rejeitado')}
                          className={`w-full flex items-center justify-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            finding.statusRevisao === 'rejeitado'
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Rejeitar</span>
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-slate-400 italic text-center md:text-right px-2">
                        Requer investigação manual (sem correção determinística automática)
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
    </div>
  );
}
