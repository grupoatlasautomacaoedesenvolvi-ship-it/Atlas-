import React, { useState, useMemo } from 'react';
import { SpedData, SpedDocument } from '../types';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Search,
  Download,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
  FileCode,
  Calculator,
  ArrowRight,
  Maximize2,
  Copy,
  Check,
  FileSpreadsheet,
  Filter,
  BadgeAlert,
  Scale,
  RefreshCw,
  CopyX
} from 'lucide-react';

interface C100C190IntegrityCheckerProps {
  spedData: SpedData;
  onRecalculateStructure?: () => void;
}

export interface DocumentIntegrityResult {
  doc: SpedDocument;
  vlDoc: number;
  somaC170VlItem: number;
  somaC170VlBcIcms: number;
  somaC170VlIcms: number;
  somaC190VlOpr: number;
  somaC190VlBcIcms: number;
  somaC190VlIcms: number;
  diffC100_C170: number;
  diffC100_C190: number;
  diffC170_C190: number;
  diffBcIcms: number;
  diffIcms: number;
  hasC170: boolean;
  hasC190: boolean;
  hasDuplicateC190: boolean;
  duplicateC190Details: string[];
  isCancelado: boolean;
  status: 'INTEGRO' | 'ERRO_C100_C170' | 'ERRO_C100_C190' | 'ERRO_C170_C190' | 'ERRO_C190_AUSENTE' | 'ERRO_C190_DUPLICADO' | 'CANCELADO';
  c190Breakdown: { cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBcIcms: number; vlIcms: number }[];
  c170GroupedBreakdown: { cstIcms: string; cfop: string; aliqIcms: number; somaVlItem: number; somaVlBcIcms: number; somaVlIcms: number }[];
}

function formatMoney(val: number): string {
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function C100C190IntegrityChecker({ spedData, onRecalculateStructure }: C100C190IntegrityCheckerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'INCONSISTENT' | 'C100_C170' | 'C100_C190' | 'C170_C190' | 'C190_MISSING' | 'C190_DUPLICATE' | 'INTEGRO' | 'CANCELADO'>('ALL');
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Perform integrity calculations for all documents in SPED
  const integrityResults = useMemo<DocumentIntegrityResult[]>(() => {
    if (!spedData || !spedData.documents) return [];

    const c190RawList = spedData.c190Raw || [];

    return spedData.documents.map((doc) => {
      const vlDoc = doc.vlDoc || 0;
      const c170Items = doc.items || [];
      const isCancelado = ['02', '03', '04', '05'].includes(doc.codSit);

      // 1. Calculate C170 sums
      const somaC170VlItem = c170Items.reduce((acc, item) => acc + (item.vlItem || 0), 0);
      const somaC170VlBcIcms = c170Items.reduce((acc, item) => acc + (item.vlBcIcms || 0), 0);
      const somaC170VlIcms = c170Items.reduce((acc, item) => acc + (item.vlIcms || 0), 0);
      const hasC170 = c170Items.length > 0;

      // Group C170 by CST + CFOP + Alíquota
      const c170Map = new Map<string, { cstIcms: string; cfop: string; aliqIcms: number; somaVlItem: number; somaVlBcIcms: number; somaVlIcms: number }>();
      c170Items.forEach((item) => {
        const key = `${item.cstIcms}_${item.cfop}_${item.aliqIcms || 0}`;
        const existing = c170Map.get(key) || {
          cstIcms: item.cstIcms,
          cfop: item.cfop,
          aliqIcms: item.aliqIcms || 0,
          somaVlItem: 0,
          somaVlBcIcms: 0,
          somaVlIcms: 0
        };
        existing.somaVlItem += item.vlItem || 0;
        existing.somaVlBcIcms += item.vlBcIcms || 0;
        existing.somaVlIcms += item.vlIcms || 0;
        c170Map.set(key, existing);
      });
      const c170GroupedBreakdown = Array.from(c170Map.values());

      // 2. Calculate C190 sums
      const docC190s = c190RawList.filter((c) => c.docId === doc.id);
      const hasC190 = docC190s.length > 0;
      const somaC190VlOpr = docC190s.reduce((acc, c) => acc + (c.vlOpr || 0), 0);
      const somaC190VlBcIcms = docC190s.reduce((acc, c) => acc + (c.vlBcIcms || 0), 0);
      const somaC190VlIcms = docC190s.reduce((acc, c) => acc + (c.vlIcms || 0), 0);

      // Verificação de duplicidades no C190 (mesmo CST + CFOP + Alíquota no mesmo documento)
      const c190CountsMap = new Map<string, number>();
      docC190s.forEach((c) => {
        const cstKey = (c.cstIcms || '').toString().trim().padStart(3, '0');
        const cfopKey = (c.cfop || '').toString().trim().padStart(4, '0');
        const aliqKey = (c.aliqIcms || 0).toFixed(2);
        const k = `${cstKey}_${cfopKey}_${aliqKey}`;
        c190CountsMap.set(k, (c190CountsMap.get(k) || 0) + 1);
      });

      const duplicateC190Details: string[] = [];
      c190CountsMap.forEach((count, key) => {
        if (count > 1) {
          const [cst, cfop, aliq] = key.split('_');
          duplicateC190Details.push(`CST ${cst} / CFOP ${cfop} / Alíq. ${aliq}% (${count} linhas duplicadas)`);
        }
      });
      const hasDuplicateC190 = duplicateC190Details.length > 0;

      const c190Breakdown = docC190s.map((c) => ({
        cstIcms: c.cstIcms,
        cfop: c.cfop,
        aliqIcms: c.aliqIcms || 0,
        vlOpr: c.vlOpr || 0,
        vlBcIcms: c.vlBcIcms || 0,
        vlIcms: c.vlIcms || 0
      }));

      // 3. Round differences to avoid floating point issues
      const round2 = (num: number) => Math.round(num * 100) / 100;
      const diffC100_C170 = hasC170 ? round2(vlDoc - somaC170VlItem) : 0;
      const diffC100_C190 = round2(vlDoc - somaC190VlOpr);
      const diffC170_C190 = hasC170 ? round2(somaC170VlItem - somaC190VlOpr) : 0;
      const diffBcIcms = hasC170 ? round2(somaC170VlBcIcms - somaC190VlBcIcms) : round2((doc.vlBcIcms || 0) - somaC190VlBcIcms);
      const diffIcms = hasC170 ? round2(somaC170VlIcms - somaC190VlIcms) : round2((doc.vlIcms || 0) - somaC190VlIcms);

      // 4. Status determination for PVA Compliance
      let status: DocumentIntegrityResult['status'] = 'INTEGRO';

      if (isCancelado) {
        status = 'CANCELADO';
      } else if (hasDuplicateC190) {
        status = 'ERRO_C190_DUPLICADO';
      } else if (!hasC190 && vlDoc > 0) {
        status = 'ERRO_C190_AUSENTE';
      } else if (hasC170 && Math.abs(diffC100_C170) > 0.05) {
        status = 'ERRO_C100_C170';
      } else if (Math.abs(diffC100_C190) > 0.05) {
        status = 'ERRO_C100_C190';
      } else if (hasC170 && Math.abs(diffC170_C190) > 0.05) {
        status = 'ERRO_C170_C190';
      }

      return {
        doc,
        vlDoc,
        somaC170VlItem,
        somaC170VlBcIcms,
        somaC170VlIcms,
        somaC190VlOpr,
        somaC190VlBcIcms,
        somaC190VlIcms,
        diffC100_C170,
        diffC100_C190,
        diffC170_C190,
        diffBcIcms,
        diffIcms,
        hasC170,
        hasC190,
        hasDuplicateC190,
        duplicateC190Details,
        isCancelado,
        status,
        c190Breakdown,
        c170GroupedBreakdown
      };
    });
  }, [spedData]);

  // Overall EFD Stats
  const stats = useMemo(() => {
    const totalDocs = integrityResults.length;
    const canceladosCount = integrityResults.filter((r) => r.isCancelado).length;
    const integrosCount = integrityResults.filter((r) => r.status === 'INTEGRO' || r.status === 'CANCELADO').length;
    const divC100C170 = integrityResults.filter((r) => r.status === 'ERRO_C100_C170').length;
    const divC100C190 = integrityResults.filter((r) => r.status === 'ERRO_C100_C190').length;
    const divC170C190 = integrityResults.filter((r) => r.status === 'ERRO_C170_C190').length;
    const c190Missing = integrityResults.filter((r) => r.status === 'ERRO_C190_AUSENTE').length;
    const c190DuplicatesCount = integrityResults.filter((r) => r.hasDuplicateC190 && !r.isCancelado).length;

    const totalInconsistent = totalDocs - integrosCount;
    const pvaPassRate = totalDocs > 0 ? Math.round((integrosCount / totalDocs) * 100) : 100;

    return {
      totalDocs,
      canceladosCount,
      integrosCount,
      totalInconsistent,
      divC100C170,
      divC100C190,
      divC170C190,
      c190Missing,
      c190DuplicatesCount,
      pvaPassRate
    };
  }, [integrityResults]);

  // Filtered list based on search and selected tab
  const filteredResults = useMemo(() => {
    return integrityResults.filter((item) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        item.doc.numDoc.toLowerCase().includes(term) ||
        item.doc.serie.toLowerCase().includes(term) ||
        item.doc.chvNfe.toLowerCase().includes(term) ||
        item.doc.emitenteOrDest.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      switch (filterType) {
        case 'INCONSISTENT':
          return item.status !== 'INTEGRO' && item.status !== 'CANCELADO';
        case 'C100_C170':
          return item.status === 'ERRO_C100_C170';
        case 'C100_C190':
          return item.status === 'ERRO_C100_C190';
        case 'C170_C190':
          return item.status === 'ERRO_C170_C190';
        case 'C190_MISSING':
          return item.status === 'ERRO_C190_AUSENTE';
        case 'C190_DUPLICATE':
          return item.hasDuplicateC190 || item.status === 'ERRO_C190_DUPLICADO';
        case 'CANCELADO':
          return item.isCancelado || item.status === 'CANCELADO';
        case 'INTEGRO':
          return item.status === 'INTEGRO';
        default:
          return true;
      }
    });
  }, [integrityResults, searchTerm, filterType]);

  const handleCopyChave = (chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiedKey(chave);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const exportCSV = () => {
    if (!integrityResults.length) return;

    const csvRows = [
      [
        'Num Doc',
        'Serie',
        'Chave de Acesso',
        'Data Doc',
        'Status PVA',
        'VL_DOC (C100)',
        'Soma VL_ITEM (C170)',
        'Soma VL_OPR (C190)',
        'Dif C100xC170',
        'Dif C100xC190',
        'Dif C170xC190',
        'Qtd C170',
        'Qtd C190'
      ].join(';')
    ];

    integrityResults.forEach((r) => {
      csvRows.push(
        [
          r.doc.numDoc,
          r.doc.serie,
          r.doc.chvNfe || '',
          r.doc.dtDoc || '',
          r.status,
          r.vlDoc.toFixed(2).replace('.', ','),
          r.somaC170VlItem.toFixed(2).replace('.', ','),
          r.somaC190VlOpr.toFixed(2).replace('.', ','),
          r.diffC100_C170.toFixed(2).replace('.', ','),
          r.diffC100_C190.toFixed(2).replace('.', ','),
          r.diffC170_C190.toFixed(2).replace('.', ','),
          r.doc.items.length,
          r.c190Breakdown.length
        ].join(';')
      );
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Checagem_Integridade_C100_C190_${spedData.header.cnpj || 'SPED'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Banner */}
      <div className="bg-[var(--atlas-navy)] p-8 sm:p-10 rounded-2xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-8 relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none"></div>
        
        <div className="flex items-center space-x-6 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-emerald-400 shadow-inner group transition-all hover:scale-110">
            <ShieldCheck className="w-8 h-8 sm:w-10 sm:h-10 group-hover:animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-none" style={{ fontFamily: 'var(--font-display)' }}>
              Cruzamento C100 / C170 / C190
            </h2>
            <p className="text-sm sm:text-base text-white/70 max-w-2xl font-medium leading-relaxed">
              Consistência matemática entre o Valor Total (<code className="text-emerald-400 font-mono">C100</code>), Itens (<code className="text-emerald-400 font-mono">C170</code>) e Analítico (<code className="text-emerald-400 font-mono">C190</code>).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 self-start sm:self-center relative z-10">
          {onRecalculateStructure && (
            <button
              onClick={() => onRecalculateStructure()}
              className="atlas-btn atlas-btn-accent px-6 py-3 font-bold shadow-lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>Sincronizar Blocos</span>
            </button>
          )}

          <button
            onClick={exportCSV}
            className="atlas-btn atlas-btn-secondary px-6 py-3 bg-white/10 border-white/10 text-white hover:bg-white/20 font-bold"
          >
            <Download className="w-4 h-4 mr-2" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total & Conformidade */}
        <div className="atlas-card p-6 space-y-4 border-l-4 border-l-[var(--atlas-accent)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--atlas-text-secondary)]">Índice de Integridade</span>
            <div className={`p-2 rounded-lg ${stats.totalInconsistent === 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {stats.totalInconsistent === 0 ? <CheckCircle2 className="w-5 h-5" /> : <BadgeAlert className="w-5 h-5" />}
            </div>
          </div>
          <div>
            <div className="text-4xl font-black text-[var(--atlas-navy)] tracking-tight">{stats.pvaPassRate}%</div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] font-bold uppercase mt-1">{stats.integrosCount} de {stats.totalDocs} notas OK</div>
          </div>
          <div className="pt-2 border-t border-[var(--atlas-border)]">
            <p className="text-[11px] leading-relaxed font-medium">
              {stats.totalInconsistent === 0 ? (
                <span className="text-emerald-600">Documentação 100% validada.</span>
              ) : (
                <span className="text-amber-600">{stats.totalInconsistent} notas com divergência.</span>
              )}
            </p>
          </div>
        </div>

        {/* C100 vs C170 */}
        <div className="atlas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--atlas-text-secondary)]">C100 x C170</span>
            <div className="p-2 rounded-lg bg-[var(--atlas-navy)]/5 text-[var(--atlas-navy)]">
              <Calculator className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className={`text-4xl font-black tracking-tight ${stats.divC100C170 > 0 ? 'text-[var(--atlas-danger)]' : 'text-[var(--atlas-text)]'}`}>
              {stats.divC100C170}
            </div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] font-bold uppercase mt-1">Notas Afetadas</div>
          </div>
          <div className="pt-2 border-t border-[var(--atlas-border)]">
            <p className="text-[11px] text-[var(--atlas-text-muted)] font-medium leading-relaxed">
              Diferença entre <code className="font-mono bg-[var(--atlas-surface-hover)] px-1 rounded">VL_DOC</code> e soma dos itens.
            </p>
          </div>
        </div>

        {/* C100 vs C190 */}
        <div className="atlas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--atlas-text-secondary)]">C100 x C190</span>
            <div className="p-2 rounded-lg bg-[var(--atlas-navy)]/5 text-[var(--atlas-navy)]">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className={`text-4xl font-black tracking-tight ${stats.divC100C190 > 0 ? 'text-[var(--atlas-danger)]' : 'text-[var(--atlas-text)]'}`}>
              {stats.divC100C190}
            </div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] font-bold uppercase mt-1">Notas Afetadas</div>
          </div>
          <div className="pt-2 border-t border-[var(--atlas-border)]">
            <p className="text-[11px] text-[var(--atlas-text-muted)] font-medium leading-relaxed">
              Soma do analítico <code className="font-mono bg-[var(--atlas-surface-hover)] px-1 rounded">VL_OPR</code> não fecha com o total.
            </p>
          </div>
        </div>

        {/* C170 vs C190 */}
        <div className="atlas-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--atlas-text-secondary)]">Itens x Analítico</span>
            <div className="p-2 rounded-lg bg-[var(--atlas-navy)]/5 text-[var(--atlas-navy)]">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div>
            <div className={`text-4xl font-black tracking-tight ${(stats.divC170C190 + stats.c190Missing) > 0 ? 'text-amber-600' : 'text-[var(--atlas-text)]'}`}>
              {stats.divC170C190 + stats.c190Missing}
            </div>
            <div className="text-[11px] text-[var(--atlas-text-muted)] font-bold uppercase mt-1">
              {stats.c190Missing > 0 ? `${stats.c190Missing} C190 Ausentes` : 'Divergências'}
            </div>
          </div>
          <div className="pt-2 border-t border-[var(--atlas-border)]">
            <p className="text-[11px] text-[var(--atlas-text-muted)] font-medium leading-relaxed">
              Agrupamento CST/CFOP dos itens não bate com C190.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-2">
        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1 bg-[var(--atlas-surface-hover)] p-1.5 rounded-xl border border-[var(--atlas-border)] text-[10px] font-bold uppercase tracking-widest">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'ALL' ? 'bg-[var(--atlas-navy)] text-white shadow-lg scale-105' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            Todas ({stats.totalDocs})
          </button>
          <button
            onClick={() => setFilterType('INCONSISTENT')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'INCONSISTENT' ? 'bg-[var(--atlas-danger)] text-white shadow-lg scale-105' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            Inconsistências ({stats.totalInconsistent})
          </button>
          <button
            onClick={() => setFilterType('C100_C170')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'C100_C170' ? 'bg-[var(--atlas-navy)] text-white shadow-lg' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            C100 x C170 ({stats.divC100C170})
          </button>
          <button
            onClick={() => setFilterType('C100_C190')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'C100_C190' ? 'bg-[var(--atlas-navy)] text-white shadow-lg' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            C100 x C190 ({stats.divC100C190})
          </button>
          <button
            onClick={() => setFilterType('C170_C190')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'C170_C190' ? 'bg-[var(--atlas-navy)] text-white shadow-lg' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            C170 x C190 ({stats.divC170C190})
          </button>
          <button
            onClick={() => setFilterType('INTEGRO')}
            className={`px-4 py-2 rounded-lg transition-all ${filterType === 'INTEGRO' ? 'bg-emerald-600 text-white shadow-lg' : 'text-[var(--atlas-text-secondary)] hover:bg-[var(--atlas-surface)]'}`}
          >
            Íntegras ({stats.integrosCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Nº Doc, Chave, Serie..."
            className="atlas-input pl-10 pr-4 py-2.5 w-full font-bold text-xs"
          />
        </div>
      </div>

      {/* Main Integrity Check Table */}
      <div className="overflow-hidden border border-[var(--atlas-border)] rounded-2xl shadow-xl bg-[var(--atlas-surface)]">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--atlas-border)] text-xs">
            <thead className="bg-[var(--atlas-surface-hover)]">
              <tr>
                <th className="px-6 py-4 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Nº Doc / Série</th>
                <th className="px-6 py-4 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Identificação</th>
                <th className="px-6 py-4 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Status PVA</th>
                <th className="px-6 py-4 text-right font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">VL_DOC (C100)</th>
                <th className="px-6 py-4 text-right font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Soma Itens (C170)</th>
                <th className="px-6 py-4 text-right font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Analítico (C190)</th>
                <th className="px-6 py-4 text-right font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Diferença</th>
                <th className="px-6 py-4 text-center font-bold text-[var(--atlas-text-secondary)] uppercase tracking-widest text-[10px]">Ação</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-[var(--atlas-border)]">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-20 text-center">
                  <div className="flex flex-col items-center justify-center space-y-4 opacity-40">
                    <Search className="w-16 h-16 text-[var(--atlas-navy)]" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase tracking-widest text-[var(--atlas-navy)]">Nenhum resultado</p>
                      <p className="text-xs font-medium text-[var(--atlas-text-secondary)]">Ajuste os filtros para encontrar o que procura.</p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredResults.map((res) => {
                const isExpanded = expandedDocId === res.doc.id;
                const hasError = res.status !== 'INTEGRO' && res.status !== 'CANCELADO';

                return (
                  <React.Fragment key={res.doc.id}>
                    <tr className={`atlas-list-row group ${hasError ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-[var(--atlas-surface-hover)]'}`}>
                      {/* Num Doc & Serie */}
                      <td className="px-6 py-4 font-bold whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className="text-[var(--atlas-navy)] text-sm">#{res.doc.numDoc}</span>
                          <span className="atlas-pill py-0.5 px-2 bg-[var(--atlas-surface-hover)] border-[var(--atlas-border)] text-[var(--atlas-text-secondary)] font-mono text-[10px]">
                            S.{res.doc.serie || '1'}
                          </span>
                        </div>
                      </td>

                      {/* Identificação */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-[10px] text-[var(--atlas-text-secondary)] truncate max-w-[140px] font-bold">
                              {res.doc.chvNfe || 'SEM CHAVE'}
                            </span>
                            {res.doc.chvNfe && (
                              <button
                                onClick={() => handleCopyChave(res.doc.chvNfe)}
                                className="text-[var(--atlas-text-muted)] hover:text-[var(--atlas-navy)] transition p-1 rounded-md hover:bg-white"
                              >
                                {copiedKey === res.doc.chvNfe ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--atlas-text-muted)] font-bold uppercase tracking-wider">{res.doc.dtDoc}</span>
                        </div>
                      </td>

                      {/* Status PVA */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {res.status === 'INTEGRO' && <span className="atlas-pill atlas-pill-accent bg-emerald-500/10 text-emerald-700 border-emerald-500/20 px-3 py-1 font-bold">CONFORME</span>}
                        {res.status === 'CANCELADO' && <span className="atlas-pill bg-slate-100 text-slate-500 border-slate-200 px-3 py-1 font-bold">CANCELADO</span>}
                        {res.status.startsWith('ERRO') && (
                          <span className="atlas-pill atlas-pill-danger bg-red-500/10 text-red-700 border-red-500/20 px-3 py-1 font-bold flex items-center space-x-1.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>DIVERGENTE</span>
                          </span>
                        )}
                      </td>

                      {/* C100 */}
                      <td className="px-6 py-4 text-right font-mono font-bold text-[var(--atlas-navy)] text-sm whitespace-nowrap">
                        {formatMoney(res.vlDoc)}
                      </td>

                      {/* C170 */}
                      <td className="px-6 py-4 text-right font-mono font-bold text-[var(--atlas-text)] whitespace-nowrap text-[11px]">
                        {res.hasC170 ? formatMoney(res.somaC170VlItem) : '-'}
                      </td>

                      {/* C190 */}
                      <td className="px-6 py-4 text-right font-mono font-bold text-[var(--atlas-text)] whitespace-nowrap text-[11px]">
                        {res.hasC190 ? formatMoney(res.somaC190VlOpr) : '-'}
                      </td>

                      {/* Diferença */}
                      <td className={`px-6 py-4 text-right font-mono font-bold whitespace-nowrap text-[11px] ${Math.abs(res.diffC100_C190) > 0.05 ? 'text-[var(--atlas-danger)] bg-red-50/50 px-2 rounded-md' : 'text-emerald-600'}`}>
                        {formatMoney(res.diffC100_C190)}
                      </td>

                      {/* Ação */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setExpandedDocId(isExpanded ? null : res.doc.id)}
                          className="atlas-btn atlas-btn-secondary p-2 group"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" /> : <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />}
                        </button>
                      </td>
                    </tr>

                    {/* Detailed Accordion Breakdown View */}
                    {isExpanded && (
                      <tr className="bg-[var(--atlas-surface-hover)] border-y border-[var(--atlas-border)]">
                        <td colSpan={8} className="p-8 space-y-6">
                          <div className="bg-[var(--atlas-surface)] p-6 rounded-2xl border border-[var(--atlas-border)] shadow-xl space-y-6">
                            <div className="flex items-center justify-between border-b border-[var(--atlas-border)] pb-4">
                              <h4 className="font-bold text-[var(--atlas-navy)] text-sm flex items-center uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>
                                <FileCode className="w-5 h-5 text-[var(--atlas-navy)] mr-3" />
                                Raio-X de Auditoria — Nota #{res.doc.numDoc}
                              </h4>
                              <div className="flex items-center space-x-3">
                                <span className="atlas-pill atlas-pill-secondary font-mono text-[10px]">Linha #{res.doc.numeroLinhaOriginal || '—'}</span>
                                <span className="atlas-pill bg-[var(--atlas-navy)]/5 text-[var(--atlas-navy)] text-[10px] font-bold">SPED FISCAL</span>
                              </div>
                            </div>

                            {/* Triple Column Comparison Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* C100 Column */}
                              <div className="atlas-card p-5 bg-[var(--atlas-surface-hover)] space-y-4">
                                <div className="font-bold text-[var(--atlas-text-secondary)] text-[10px] uppercase tracking-widest border-b border-[var(--atlas-border)] pb-2 flex justify-between">
                                  <span>Bloco C100</span>
                                  <span className="text-[var(--atlas-navy)]">Cabeçalho</span>
                                </div>
                                <div className="space-y-3 font-mono text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">VL_DOC:</span>
                                    <span className="font-bold text-[var(--atlas-navy)] text-sm">R$ {formatMoney(res.vlDoc)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">VL_BC_ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.doc.vlBcIcms || 0)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">VL_ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.doc.vlIcms || 0)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* C170 Column */}
                              <div className="atlas-card p-5 bg-[var(--atlas-surface-hover)] space-y-4">
                                <div className="font-bold text-[var(--atlas-text-secondary)] text-[10px] uppercase tracking-widest border-b border-[var(--atlas-border)] pb-2 flex justify-between">
                                  <span>Bloco C170</span>
                                  <span className="text-[var(--atlas-navy)]">{res.doc.items.length} Itens</span>
                                </div>
                                <div className="space-y-3 font-mono text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma VL_ITEM:</span>
                                    <span className={`font-bold text-sm ${Math.abs(res.diffC100_C170) > 0.05 ? 'text-[var(--atlas-danger)]' : 'text-[var(--atlas-text)]'}`}>
                                      R$ {formatMoney(res.somaC170VlItem)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma BC ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.somaC170VlBcIcms)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.somaC170VlIcms)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* C190 Column */}
                              <div className="atlas-card p-5 bg-[var(--atlas-surface-hover)] space-y-4">
                                <div className="font-bold text-[var(--atlas-text-secondary)] text-[10px] uppercase tracking-widest border-b border-[var(--atlas-border)] pb-2 flex justify-between">
                                  <span>Bloco C190</span>
                                  <span className="text-[var(--atlas-navy)]">{res.c190Breakdown.length} Analíticos</span>
                                </div>
                                <div className="space-y-3 font-mono text-xs">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma VL_OPR:</span>
                                    <span className={`font-bold text-sm ${Math.abs(res.diffC100_C190) > 0.05 ? 'text-[var(--atlas-danger)]' : 'text-[var(--atlas-text)]'}`}>
                                      R$ {formatMoney(res.somaC190VlOpr)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma BC ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.somaC190VlBcIcms)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[var(--atlas-text-muted)]">Soma ICMS:</span>
                                    <span className="font-bold">R$ {formatMoney(res.somaC190VlIcms)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Breakdown Table */}
                            {res.c190Breakdown.length > 0 && (
                              <div className="space-y-3 pt-2">
                                <h5 className="font-bold text-[var(--atlas-text-secondary)] text-[10px] uppercase tracking-widest">Detalhamento Analítico C190</h5>
                                <div className="overflow-hidden border border-[var(--atlas-border)] rounded-xl">
                                  <table className="min-w-full divide-y divide-[var(--atlas-border)] text-[10px] font-mono">
                                    <thead className="bg-[var(--atlas-surface-hover)]">
                                      <tr>
                                        <th className="px-4 py-2 text-left font-bold text-[var(--atlas-text-secondary)]">CST/CFOP</th>
                                        <th className="px-4 py-2 text-right font-bold text-[var(--atlas-text-secondary)]">Alíq (%)</th>
                                        <th className="px-4 py-2 text-right font-bold text-[var(--atlas-text-secondary)]">Vl. Operação</th>
                                        <th className="px-4 py-2 text-right font-bold text-[var(--atlas-text-secondary)]">Base ICMS</th>
                                        <th className="px-4 py-2 text-right font-bold text-[var(--atlas-text-secondary)]">Vl. ICMS</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[var(--atlas-border)]">
                                      {res.c190Breakdown.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-[var(--atlas-surface-hover)]">
                                          <td className="px-4 py-2 font-bold text-[var(--atlas-navy)]">{c.cstIcms} / {c.cfop}</td>
                                          <td className="px-4 py-2 text-right">{c.aliqIcms}%</td>
                                          <td className="px-4 py-2 text-right font-bold">R$ {formatMoney(c.vlOpr)}</td>
                                          <td className="px-4 py-2 text-right">R$ {formatMoney(c.vlBcIcms)}</td>
                                          <td className="px-4 py-2 text-right">R$ {formatMoney(c.vlIcms)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Recommendation / Fix Instructions */}
                            {res.status !== 'INTEGRO' && res.status !== 'CANCELADO' && (
                              <div className="atlas-alert atlas-alert-warning p-4 rounded-xl flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <span className="font-bold block uppercase tracking-widest text-[10px]">Ação Corretiva Recomendada</span>
                                  <p className="text-xs leading-relaxed opacity-90">
                                    {res.status === 'ERRO_C100_C170' && `Divergência entre C100 e C170. Ajuste os itens ou o total da nota.`}
                                    {res.status === 'ERRO_C100_C190' && `Divergência entre C100 e C190. O analítico não fecha com o total.`}
                                    {res.status === 'ERRO_C170_C190' && `O somatório dos itens agrupados não coincide com as linhas do C190.`}
                                    {res.status === 'ERRO_C190_AUSENTE' && `Nota com valor comercial sem registro C190 associado.`}
                                    {res.status === 'ERRO_C190_DUPLICADO' && `Registros C190 duplicados (${res.duplicateC190Details.join(', ')}). Unifique as linhas.`}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
  );
}
