import React, { useState, useEffect, useMemo } from 'react';
import { 
  BrainCircuit, 
  Check, 
  X, 
  ShieldCheck, 
  AlertTriangle, 
  Search, 
  Filter, 
  ArrowRight, 
  Sparkles, 
  Building2, 
  MapPin, 
  CheckCircle2, 
  Clock, 
  XCircle,
  RefreshCw,
  Layers,
  FileText
} from 'lucide-react';
import { LearnedTaxRule, StateTaxRule, SpedData, NotificationType } from '../types';
import { getLearnedRules, approveLearnedRule, rejectLearnedRule } from '../lib/roboFiscalService';
import { saveGlobalStateTaxMatrix } from '../lib/matrizService';

interface AprendizadoViewProps {
  escritorioId?: string;
  matrizRules: StateTaxRule[];
  onSaveMatrix?: (newMatrix: StateTaxRule[]) => void;
  addNotification?: (title: string, message: string, type: NotificationType, actionUrl?: string) => void;
  spedData?: SpedData | null;
  onUpdateSpedData?: (newSpedData: SpedData) => void;
}

export function AprendizadoView({
  escritorioId,
  matrizRules,
  onSaveMatrix,
  addNotification,
  spedData,
  onUpdateSpedData
}: AprendizadoViewProps) {
  const [learnedRules, setLearnedRules] = useState<LearnedTaxRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'pendente' | 'aprovado' | 'rejeitado' | 'todos'>('pendente');
  const [selectedUf, setSelectedUf] = useState<string>('TODAS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Load learned rules from Firebase / LocalStorage
  const cargarRegras = async () => {
    if (!escritorioId) return;
    setLoading(true);
    try {
      const rules = await getLearnedRules(escritorioId);
      setLearnedRules(rules);
    } catch (error) {
      console.error('Erro ao carregar regras aprendidas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarRegras();
  }, [escritorioId]);

  // Unique list of UFs present in the learned rules
  const availableUfs = useMemo(() => {
    const ufs = new Set<string>();
    learnedRules.forEach(r => {
      if (r.uf) ufs.add(r.uf.toUpperCase());
    });
    return Array.from(ufs).sort();
  }, [learnedRules]);

  // Filtered learned rules
  const filteredRules = useMemo(() => {
    return learnedRules.filter(rule => {
      // Status
      if (statusFilter !== 'todos' && rule.status !== statusFilter) {
        return false;
      }
      // UF
      if (selectedUf !== 'TODAS' && rule.uf.toUpperCase() !== selectedUf) {
        return false;
      }
      // Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesNcm = rule.ncmPrefix.toLowerCase().includes(term);
        const matchesCst = rule.learnedCst.toLowerCase().includes(term);
        const matchesCfop = (rule.learnedCfop || []).some(c => c.toLowerCase().includes(term));
        const matchesDesc = (rule.descricao || '').toLowerCase().includes(term);
        const matchesProd = (rule.descricaoProduto || '').toLowerCase().includes(term);
        const matchesCliente = (rule.clienteOrigem || '').toLowerCase().includes(term);
        return matchesNcm || matchesCst || matchesCfop || matchesDesc || matchesProd || matchesCliente;
      }
      return true;
    });
  }, [learnedRules, statusFilter, selectedUf, searchTerm]);

  // Counts for status tabs
  const counts = useMemo(() => {
    return {
      pendentes: learnedRules.filter(r => r.status === 'pendente').length,
      aprovados: learnedRules.filter(r => r.status === 'aprovado').length,
      rejeitados: learnedRules.filter(r => r.status === 'rejeitado').length,
      total: learnedRules.length
    };
  }, [learnedRules]);

  // Find existing matrix rule for comparison
  const getExistingMatrixRule = (ruleUf: string, ncmPrefix: string): StateTaxRule | undefined => {
    return matrizRules.find(m => 
      (m.uf.toUpperCase() === ruleUf.toUpperCase() || m.uf.toUpperCase() === 'ALL') &&
      m.ncmPrefix === ncmPrefix
    );
  };

  // Handle Approve Rule
  const handleApprove = async (rule: LearnedTaxRule) => {
    if (!escritorioId) return;
    setProcessingId(rule.id);
    try {
      // 1. Approve rule & add to office matrix
      const updatedMatrix = await approveLearnedRule(
        rule.id,
        matrizRules,
        escritorioId,
        onSaveMatrix
      );

      // 2. Mark matching items in active SPED data as analystConfirmed: true and update CST/CFOP
      if (spedData && onUpdateSpedData) {
        let itemsUpdatedCount = 0;
        const newDocuments = spedData.documents.map(doc => {
          const updatedItems = doc.items.map(item => {
            const itemNcmClean = (item.ncm || '').replace(/\D/g, '');
            const matchNcm = itemNcmClean.startsWith(rule.ncmPrefix) || rule.ncmPrefix === itemNcmClean;
            const matchUf = !rule.uf || rule.uf === 'ALL' || (spedData.header.uf && spedData.header.uf.toUpperCase() === rule.uf.toUpperCase());

            if (matchNcm && matchUf) {
              itemsUpdatedCount++;
              const primaryCfop = rule.learnedCfop && rule.learnedCfop.length > 0 ? rule.learnedCfop[0] : item.cfop;
              return {
                ...item,
                cstIcms: rule.learnedCst || item.cstIcms,
                cfop: primaryCfop || item.cfop,
                analystConfirmed: true,
                correctedByRobot: true,
                robotCorrectionReason: `Aprovado pelo Auditor via Aprendizado (NCM ${rule.ncmPrefix})`
              };
            }
            return item;
          });

          return {
            ...doc,
            items: updatedItems
          };
        });

        if (itemsUpdatedCount > 0) {
          onUpdateSpedData({
            ...spedData,
            documents: newDocuments
          });
        }
      }

      // 3. Trigger Notification
      if (addNotification) {
        addNotification(
          'Regra de Aprendizado Aprovada',
          `A regra tributária para NCM ${rule.ncmPrefix} (UF: ${rule.uf}) foi promovida à Matriz Tributária do escritório com sucesso.`,
          'rule',
          'aprendizado'
        );
      }

      // 4. Reload
      await cargarRegras();
    } catch (error) {
      console.error('Erro ao aprovar regra:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Reject Rule
  const handleReject = async (ruleId: string) => {
    if (!escritorioId) return;
    setProcessingId(ruleId);
    try {
      await rejectLearnedRule(ruleId, escritorioId);
      if (addNotification) {
        addNotification(
          'Aprendizado Rejeitado',
          `A sugestão de regra foi descartada e não afetará a Matriz Tributária.`,
          'system'
        );
      }
      await cargarRegras();
    } catch (error) {
      console.error('Erro ao rejeitar regra:', error);
    } finally {
      setProcessingId(null);
    }
  };

  // Bulk Approve High-Confidence Rules
  const handleBulkApproveHighConfidence = async () => {
    if (!escritorioId) return;
    const highConfidencePendings = filteredRules.filter(r => r.status === 'pendente' && (r.confiancaPercentual || 0) >= 90);
    if (highConfidencePendings.length === 0) return;

    if (!confirm(`Deseja aprovar automaticamente ${highConfidencePendings.length} regra(s) com confiança ≥ 90% para a UF selecionada?`)) {
      return;
    }

    setLoading(true);
    let approvedCount = 0;
    try {
      for (const rule of highConfidencePendings) {
        await approveLearnedRule(rule.id, matrizRules, escritorioId, onSaveMatrix);
        approvedCount++;
      }
      if (addNotification) {
        addNotification(
          'Aprovação em Massa Concluída',
          `${approvedCount} regra(s) de alta confiança foram integradas à Matriz Tributária com sucesso.`,
          'rule',
          'state_tax_matrix'
        );
      }
      await cargarRegras();
    } catch (e) {
      console.error('Erro na aprovação em massa:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="atlas-card p-6 md:p-8 bg-gradient-to-br from-[var(--atlas-navy)] to-[var(--atlas-navy-dark)] border-0 text-white shadow-lg overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <BrainCircuit className="w-48 h-48" />
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-white/10 text-emerald-400 rounded-xl backdrop-blur-md border border-white/10 shadow-inner">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight leading-none" style={{ fontFamily: 'var(--font-display)' }}>
                  Central de Aprendizado Fiscal
                </h1>
                <div className="mt-2 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase tracking-widest">
                    Machine Learning / Auditoria
                  </span>
                </div>
              </div>
            </div>
            <p className="text-sm text-blue-100/80 max-w-2xl leading-relaxed">
              O Robô Fiscal aprende os padrões de escrituração observados nos arquivos SPED e XMLs. 
              Revise a tributação proposta, compare com a regra atual da Matriz e aprove para aplicar retroativamente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={cargarRegras}
              disabled={loading}
              className="atlas-btn py-2.5 px-5 text-sm font-bold bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md shadow-xs cursor-pointer transition-all disabled:opacity-50"
              title="Atualizar lista de aprendizados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Sincronizar</span>
            </button>

            {counts.pendentes > 0 && (
              <button
                onClick={handleBulkApproveHighConfidence}
                disabled={loading}
                className="atlas-btn atlas-btn-accent py-2.5 px-5 text-sm font-bold shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Aprovar Todos (≥90%)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Control Bar: Status Tabs, UF Selector & Search */}
      <div className="atlas-card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1.5 bg-[var(--atlas-surface-hover)] p-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest overflow-x-auto border border-[var(--atlas-border)]/50">
            <button
              onClick={() => setStatusFilter('pendente')}
              className={`px-4 py-2.5 rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
                statusFilter === 'pendente'
                  ? 'bg-[var(--atlas-surface)] text-[var(--atlas-navy)] shadow-md border border-[var(--atlas-border)]'
                  : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Pendentes</span>
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-black">
                {counts.pendentes}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('aprovado')}
              className={`px-4 py-2.5 rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
                statusFilter === 'aprovado'
                  ? 'bg-[var(--atlas-surface)] text-[var(--atlas-accent)] shadow-md border border-[var(--atlas-border)]'
                  : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Aprovados</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white font-black">
                {counts.aprovados}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('rejeitado')}
              className={`px-4 py-2.5 rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
                statusFilter === 'rejeitado'
                  ? 'bg-[var(--atlas-surface)] text-rose-700 shadow-md border border-[var(--atlas-border)]'
                  : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-rose-500" />
              <span>Rejeitados</span>
              <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white font-black">
                {counts.rejeitados}
              </span>
            </button>

            <button
              onClick={() => setStatusFilter('todos')}
              className={`px-4 py-2.5 rounded-lg transition-all flex items-center space-x-2 whitespace-nowrap ${
                statusFilter === 'todos'
                  ? 'bg-[var(--atlas-surface)] text-[var(--atlas-text)] shadow-md border border-[var(--atlas-border)]'
                  : 'text-[var(--atlas-text-secondary)] hover:text-[var(--atlas-text)]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-[var(--atlas-text-secondary)]" />
              <span>Todos</span>
            </button>
          </div>

          {/* Filters: UF Selector & Search */}
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            {/* UF Filter */}
            <div className="flex items-center space-x-1.5 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg px-2.5 py-1.5 text-xs">
              <MapPin className="w-3.5 h-3.5 text-[var(--atlas-text-muted)] shrink-0" />
              <span className="text-[var(--atlas-text-secondary)] font-medium shrink-0">UF:</span>
              <select
                value={selectedUf}
                onChange={e => setSelectedUf(e.target.value)}
                className="bg-transparent font-bold text-[var(--atlas-text)] focus:outline-none cursor-pointer"
              >
                <option value="TODAS">Todas UFs</option>
                {availableUfs.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 lg:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--atlas-text-muted)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por NCM, CST, Produto, Cliente..."
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--atlas-surface-hover)] border border-[var(--atlas-border)] rounded-lg text-xs text-[var(--atlas-text)] placeholder-[var(--atlas-text-muted)] focus:outline-none focus:border-[var(--atlas-navy)]"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-2.5 top-2.5 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] text-xs"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* List / Cards of Learned Rules */}
      {loading ? (
        <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] p-12 text-center text-[var(--atlas-text-secondary)] space-y-3">
          <RefreshCw className="w-8 h-8 text-[var(--atlas-navy)] animate-spin mx-auto" />
          <p className="font-semibold text-[var(--atlas-text-secondary)] text-sm">Carregando sugestões de aprendizado tributário...</p>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="bg-[var(--atlas-surface)] rounded-xl border border-[var(--atlas-border)] p-12 text-center text-[var(--atlas-text-secondary)] space-y-3">
          <BrainCircuit className="w-10 h-10 text-[var(--atlas-text-muted)] mx-auto" />
          <h3 className="font-bold text-[var(--atlas-text)] text-base">Nenhum aprendizado encontrado com os filtros selecionados</h3>
          <p className="text-xs text-[var(--atlas-text-secondary)] max-w-md mx-auto">
            {statusFilter === 'pendente' 
              ? 'Todas as sugestões de aprendizado já foram analisadas! À medida que novos arquivos SPED forem processados pelo robô, novos padrões aparecerão aqui.'
              : 'Altere os filtros de UF, busca ou status para visualizar outros registros do sistema.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRules.map(rule => {
            const existingMatrixRule = getExistingMatrixRule(rule.uf, rule.ncmPrefix);
            const isProcessing = processingId === rule.id;

            return (
              <div 
                key={rule.id}
                className={`bg-[var(--atlas-surface)] rounded-xl border transition-all shadow-xs overflow-hidden ${
                  rule.status === 'aprovado'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : rule.status === 'rejeitado'
                    ? 'border-[var(--atlas-border)] opacity-60'
                    : 'border-[var(--atlas-border)] hover:border-[var(--atlas-navy)]/40'
                }`}
              >
                {/* Header Card Bar */}
                <div className="bg-[var(--atlas-surface-hover)]/80 px-4 py-3 border-b border-[var(--atlas-border)] flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* UF Badge */}
                    <span className="px-2.5 py-0.5 bg-[var(--atlas-navy)] text-white rounded font-bold text-xs flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>UF: {rule.uf}</span>
                    </span>

                    {/* NCM Code */}
                    <span className="px-2.5 py-0.5 bg-slate-200 text-[var(--atlas-text)] font-mono font-bold rounded border border-[var(--atlas-border)]">
                      NCM {rule.ncmPrefix}
                    </span>

                    {/* Confidence % */}
                    <span className={`px-2.5 py-0.5 rounded font-bold flex items-center space-x-1 text-xs ${
                      (rule.confiancaPercentual || 0) >= 90
                        ? 'bg-emerald-100 text-[var(--atlas-accent)] border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      <Sparkles className="w-3 h-3" />
                      <span>{rule.confiancaPercentual || 85}% Confiança</span>
                    </span>

                    {/* Sample Count */}
                    <span className="text-[var(--atlas-text-secondary)] font-medium text-xs">
                      • Observado em <strong className="text-[var(--atlas-text)]">{rule.amostrasAnalisadas}</strong> item(ns)
                    </span>
                  </div>

                  {/* Company Origin & Status Badge */}
                  <div className="flex items-center space-x-3">
                    {rule.clienteOrigem && (
                      <span className="text-[var(--atlas-text-secondary)] text-xs flex items-center space-x-1">
                        <Building2 className="w-3 h-3 text-[var(--atlas-text-muted)]" />
                        <span>Empresa: <strong className="text-[var(--atlas-text-secondary)]">{rule.clienteOrigem}</strong></span>
                      </span>
                    )}

                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border ${
                      rule.status === 'aprovado'
                        ? 'bg-emerald-100 text-[var(--atlas-accent)] border-emerald-200'
                        : rule.status === 'rejeitado'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-amber-100 text-amber-800 border-amber-200'
                    }`}>
                      {rule.status === 'aprovado' ? 'Integrado na Matriz' : rule.status === 'rejeitado' ? 'Rejeitado' : 'Pendente Auditor'}
                    </span>
                  </div>
                </div>

                {/* Product Description Banner */}
                <div className="px-4 py-2.5 bg-[var(--atlas-surface-hover)]/40 border-b border-[var(--atlas-border)] text-xs">
                  <div className="font-bold text-[var(--atlas-text)] text-sm">
                    {rule.descricaoProduto || `Produto / NCM ${rule.ncmPrefix}`}
                  </div>
                  <div className="text-[var(--atlas-text-secondary)] text-xs mt-0.5 flex items-center space-x-1">
                    <FileText className="w-3 h-3 text-[var(--atlas-text-muted)] shrink-0" />
                    <span>{rule.descricao}</span>
                  </div>
                </div>

                {/* Side-by-Side Comparison Grid */}
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Column 1: Current Rule in Matrix */}
                  <div className="bg-[var(--atlas-surface-hover)]/80 rounded-xl p-3.5 border border-[var(--atlas-border)] space-y-2">
                    <div className="text-[var(--atlas-text-secondary)] font-semibold text-xs flex items-center justify-between border-b border-[var(--atlas-border)] pb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--atlas-text-muted)]" />
                        <span>Regra Atual na Matriz Tributária ({rule.uf})</span>
                      </span>
                      {existingMatrixRule ? (
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-1.5 py-0.2 rounded">Cadastrada</span>
                      ) : (
                        <span className="text-[var(--atlas-text-muted)] font-medium text-xs bg-slate-200/60 px-1.5 py-0.2 rounded">Nenhuma Regra NCM</span>
                      )}
                    </div>

                    {existingMatrixRule ? (
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[var(--atlas-text-secondary)]">
                        <div>
                          <span className="text-[var(--atlas-text-muted)] text-xs block">CST Padrão</span>
                          <span className="font-bold text-[var(--atlas-text)]">CST {existingMatrixRule.expectedCst || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[var(--atlas-text-muted)] text-xs block">CFOP(s)</span>
                          <span className="font-mono font-semibold text-[var(--atlas-text)]">
                            {Array.isArray(existingMatrixRule.expectedCfop) ? existingMatrixRule.expectedCfop.join(', ') : (existingMatrixRule.expectedCfop || '5102')}
                          </span>
                        </div>
                        <div>
                          <span className="text-[var(--atlas-text-muted)] text-xs block">Alíq. ICMS</span>
                          <span className="font-semibold text-[var(--atlas-text)]">{existingMatrixRule.expectedAliqIcms || 0}%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-2 text-[var(--atlas-text-muted)] text-xs italic">
                        Não há regra específica pré-cadastrada para NCM {rule.ncmPrefix} nesta UF. A auditoria usa fallbacks genéricos de legislação.
                      </div>
                    )}
                  </div>

                  {/* Column 2: Proposed Learning Rule from IA Robot */}
                  <div className="bg-emerald-50/50 rounded-xl p-3.5 border border-emerald-200/80 space-y-2">
                    <div className="text-emerald-900 font-bold text-xs flex items-center justify-between border-b border-emerald-200/80 pb-1.5">
                      <span className="flex items-center space-x-1.5">
                        <BrainCircuit className="w-3.5 h-3.5 text-[var(--atlas-accent)]" />
                        <span>Proposta de Aprendizado da IA (Robô Fiscal)</span>
                      </span>
                      <span className="text-[var(--atlas-accent)] font-bold text-xs bg-emerald-100 px-1.5 py-0.2 rounded">
                        Sugerido pelo SPED
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <span className="text-[var(--atlas-text-secondary)] text-xs block">CST Proposto</span>
                        <span className="font-bold text-[var(--atlas-accent)] text-sm bg-emerald-100/80 px-1.5 py-0.5 rounded inline-block">
                          CST {rule.learnedCst}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--atlas-text-secondary)] text-xs block">CFOP Proposto</span>
                        <span className="font-mono font-bold text-[var(--atlas-navy)] text-sm bg-sky-100/80 px-1.5 py-0.5 rounded inline-block">
                          {rule.learnedCfop && rule.learnedCfop.length > 0 ? rule.learnedCfop.join(', ') : '5102'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--atlas-text-secondary)] text-xs block">Alíq. ICMS Prop.</span>
                        <span className="font-bold text-[var(--atlas-text)] text-sm">
                          {rule.learnedAliqIcms || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                {rule.status === 'pendente' && (
                  <div className="px-4 py-3 bg-[var(--atlas-surface-hover)]/80 border-t border-[var(--atlas-border)] flex items-center justify-between gap-3">
                    <div className="text-[var(--atlas-text-secondary)] text-xs flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Ao aprovar, a regra será aplicada à Matriz Tributária para a <strong>UF {rule.uf}</strong> e confirmará retroativamente os itens deste SPED.</span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleReject(rule.id)}
                        disabled={isProcessing}
                        className="px-3 py-1.5 bg-[var(--atlas-surface)] hover:bg-rose-50 text-[var(--atlas-text-secondary)] hover:text-rose-700 border border-[var(--atlas-border)] hover:border-rose-200 rounded-lg font-semibold text-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        Rejeitar
                      </button>

                      <button
                        onClick={() => handleApprove(rule)}
                        disabled={isProcessing}
                        className="px-4 py-1.5 bg-[var(--atlas-accent)] hover:bg-[var(--atlas-accent-dark)] text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 shadow-xs transition-all active:scale-95 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Aprovar &amp; Enviar para Matriz</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
