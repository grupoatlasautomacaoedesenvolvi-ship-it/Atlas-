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
    <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden space-y-6 p-6">
      
      {/* Header & PVA Rule Explanatory Banner */}
      <div className="bg-slate-900 p-6 rounded-lg text-white space-y-3 relative overflow-hidden border border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1 rounded-md text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Validação de Conformidade EFD ICMS/IPI — Guia Prático PVA</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Checagem de Integridade dos Blocos C100, C170 e C190
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Cruzamento matemático automatizado entre o Valor Total da Nota (<code className="text-slate-200 font-mono">C100.VL_DOC</code>), a Somatória dos Itens (<code className="text-slate-200 font-mono">C170.VL_ITEM</code>) e o Registro Analítico de Operação (<code className="text-slate-200 font-mono">C190.VL_OPR</code>). Identifica previamente erros de cálculo e inconsistências que travam a validação no PVA da Receita Federal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
            {onRecalculateStructure && (
              <button
                onClick={() => {
                  onRecalculateStructure();
                }}
                className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer"
                title="Recalcula totais C100, reconstrói C190 e remove todas as duplicidades de CST/CFOP/Alíquota"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recalcular C100 e C190</span>
              </button>
            )}

            <button
              onClick={exportCSV}
              className="flex items-center space-x-2 bg-[#0f6e56] hover:bg-[#0b5240] text-white px-4 py-2.5 rounded-lg text-xs font-bold transition shadow-xs whitespace-nowrap cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Relatório PVA (CSV)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total & Conformidade */}
        <div className={`p-5 rounded-lg border ${stats.totalInconsistent === 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'} space-y-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Conformidade PVA</span>
            {stats.totalInconsistent === 0 ? (
              <CheckCircle2 className="w-5 h-5 text-[#0f6e56]" />
            ) : (
              <BadgeAlert className="w-5 h-5 text-amber-600" />
            )}
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{stats.pvaPassRate}%</span>
            <span className="text-xs text-slate-500 font-medium">{stats.integrosCount} de {stats.totalDocs} notas íntegras</span>
          </div>
          <p className="text-xs text-slate-600">
            {stats.totalInconsistent === 0 ? (
              <span className="text-[#0f6e56] font-semibold">100% dos documentos validados no cruzamento PVA.</span>
            ) : (
              <span className="text-amber-700 font-semibold">{stats.totalInconsistent} nota(s) exigem ajuste de cálculo nos itens ou analítico.</span>
            )}
          </p>
        </div>

        {/* C100 vs C170 */}
        <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Divergência C100 x C170</span>
            <Calculator className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${stats.divC100C170 > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stats.divC100C170}
            </span>
            <span className="text-xs text-slate-500">Notas afetadas</span>
          </div>
          <p className="text-xs text-slate-500 leading-tight">
            Valor do C100 (<code className="font-mono">VL_DOC</code>) difere da soma dos itens C170 (<code className="font-mono">VL_ITEM</code>).
          </p>
        </div>

        {/* C100 vs C190 */}
        <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Divergência C100 x C190</span>
            <Layers className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${stats.divC100C190 > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {stats.divC100C190}
            </span>
            <span className="text-xs text-slate-500">Notas afetadas</span>
          </div>
          <p className="text-xs text-slate-500 leading-tight">
            Soma dos registros C190 (<code className="font-mono">VL_OPR</code>) não fecha com o total do C100.
          </p>
        </div>

        {/* C170 vs C190 / C190 Ausente */}
        <div className="p-5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Itens x Analítico (C190)</span>
            <Scale className="w-5 h-5 text-[#1e3a5f]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-black ${(stats.divC170C190 + stats.c190Missing) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {stats.divC170C190 + stats.c190Missing}
            </span>
            <span className="text-xs text-slate-500">
              {stats.c190Missing > 0 ? `${stats.c190Missing} C190 ausente` : 'Divergências'}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-tight">
            Divergência entre o agrupamento dos itens por CST/CFOP e o registro C190.
          </p>
        </div>

      </div>

      {/* Filter Tabs & Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        
        {/* Quick Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'ALL' ? 'bg-white text-[#1e3a5f] shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Todas as Notas ({stats.totalDocs})
          </button>
          <button
            onClick={() => setFilterType('INCONSISTENT')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'INCONSISTENT' ? 'bg-white text-red-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Inconsistências ({stats.totalInconsistent})
          </button>
          <button
            onClick={() => setFilterType('C100_C170')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'C100_C170' ? 'bg-white text-[#1e3a5f] shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            C100 x C170 ({stats.divC100C170})
          </button>
          <button
            onClick={() => setFilterType('C100_C190')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'C100_C190' ? 'bg-white text-[#1e3a5f] shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            C100 x C190 ({stats.divC100C190})
          </button>
          <button
            onClick={() => setFilterType('C170_C190')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'C170_C190' ? 'bg-white text-[#1e3a5f] shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            C170 x C190 ({stats.divC170C190})
          </button>
          {stats.c190Missing > 0 && (
            <button
              onClick={() => setFilterType('C190_MISSING')}
              className={`px-3 py-1.5 rounded-lg transition ${filterType === 'C190_MISSING' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              C190 Ausente ({stats.c190Missing})
            </button>
          )}
          {stats.c190DuplicatesCount > 0 && (
            <button
              onClick={() => setFilterType('C190_DUPLICATE')}
              className={`px-3 py-1.5 rounded-lg transition ${filterType === 'C190_DUPLICATE' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
            >
              C190 Duplicado ({stats.c190DuplicatesCount})
            </button>
          )}
          <button
            onClick={() => setFilterType('CANCELADO')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'CANCELADO' ? 'bg-white text-rose-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Canceladas ({stats.canceladosCount})
          </button>
          <button
            onClick={() => setFilterType('INTEGRO')}
            className={`px-3 py-1.5 rounded-lg transition ${filterType === 'INTEGRO' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Íntegras ({stats.integrosCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por Nº Doc, Chave, Serie..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f]"
          />
        </div>
      </div>

      {/* Main Integrity Check Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3.5 text-left font-bold text-slate-700 uppercase tracking-wider w-28">Nº Doc / Série</th>
              <th className="px-4 py-3.5 text-left font-bold text-slate-700 uppercase tracking-wider">Chave de Acesso / Data</th>
              <th className="px-4 py-3.5 text-left font-bold text-slate-700 uppercase tracking-wider">Status PVA</th>
              <th className="px-4 py-3.5 text-right font-bold text-slate-700 uppercase tracking-wider">C100 (VL_DOC)</th>
              <th className="px-4 py-3.5 text-right font-bold text-slate-700 uppercase tracking-wider">C170 (Soma Itens)</th>
              <th className="px-4 py-3.5 text-right font-bold text-slate-700 uppercase tracking-wider">C190 (Soma Analítico)</th>
              <th className="px-4 py-3.5 text-right font-bold text-slate-700 uppercase tracking-wider">Diferença C100xC170</th>
              <th className="px-4 py-3.5 text-right font-bold text-slate-700 uppercase tracking-wider">Diferença C100xC190</th>
              <th className="px-4 py-3.5 text-center font-bold text-slate-700 uppercase tracking-wider">Ação</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredResults.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  <p className="font-semibold text-slate-600">Nenhum documento encontrado com os filtros aplicados.</p>
                  <p className="text-xs text-slate-400 mt-1">Tente alternar as abas de filtro ou limpar a busca.</p>
                </td>
              </tr>
            ) : (
              filteredResults.map((res) => {
                const isExpanded = expandedDocId === res.doc.id;
                const hasError = res.status !== 'INTEGRO' && res.status !== 'CANCELADO';

                return (
                  <React.Fragment key={res.doc.id}>
                    <tr className={`transition-colors ${hasError ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50/80'}`}>
                      
                      {/* Num Doc & Serie */}
                      <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[#1e3a5f] font-bold">Nº {res.doc.numDoc}</span>
                          <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                            S. {res.doc.serie || '1'}
                          </span>
                        </div>
                      </td>

                      {/* Chave de Acesso */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="space-y-0.5">
                          {res.doc.chvNfe ? (
                            <div className="flex items-center space-x-1">
                              <span className="font-mono text-[11px] text-slate-600 truncate max-w-[180px]">
                                {res.doc.chvNfe}
                              </span>
                              <button
                                onClick={() => handleCopyChave(res.doc.chvNfe)}
                                title="Copiar chave NFe"
                                className="text-slate-400 hover:text-[#1e3a5f] transition p-0.5"
                              >
                                {copiedKey === res.doc.chvNfe ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Sem Chave NFe</span>
                          )}
                          <span className="text-[10px] text-slate-400 block">{res.doc.dtDoc}</span>
                        </div>
                      </td>

                      {/* Status PVA Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {res.status === 'INTEGRO' && (
                          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Conforme PVA</span>
                          </span>
                        )}
                        {res.status === 'CANCELADO' && (
                          <span className="inline-flex items-center space-x-1 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <span>Documento Cancelado</span>
                          </span>
                        )}
                        {res.status === 'ERRO_C100_C170' && (
                          <span className="inline-flex items-center space-x-1 bg-red-100 text-red-800 border border-red-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>Erro C100 x C170</span>
                          </span>
                        )}
                        {res.status === 'ERRO_C100_C190' && (
                          <span className="inline-flex items-center space-x-1 bg-red-100 text-red-800 border border-red-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            <span>Erro C100 x C190</span>
                          </span>
                        )}
                        {res.status === 'ERRO_C170_C190' && (
                          <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Erro C170 x C190</span>
                          </span>
                        )}
                        {res.status === 'ERRO_C190_AUSENTE' && (
                          <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>C190 Ausente</span>
                          </span>
                        )}
                        {res.status === 'ERRO_C190_DUPLICADO' && (
                          <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-full text-[11px] font-bold" title="Existem múltiplos registros C190 para a mesma combinação de CST, CFOP e Alíquota">
                            <CopyX className="w-3.5 h-3.5 text-amber-600" />
                            <span>C190 Duplicado</span>
                          </span>
                        )}
                      </td>

                      {/* C100 VL_DOC */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        R$ {formatMoney(res.vlDoc)}
                      </td>

                      {/* C170 Soma Itens */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {res.hasC170 ? (
                          `R$ ${formatMoney(res.somaC170VlItem)}`
                        ) : (
                          <span className="text-slate-400 italic font-sans text-[11px]">Sem C170</span>
                        )}
                      </td>

                      {/* C190 Soma Analítico */}
                      <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        {res.hasC190 ? (
                          `R$ ${formatMoney(res.somaC190VlOpr)}`
                        ) : (
                          <span className="text-amber-600 font-bold font-sans text-[11px]">C190 Ausente</span>
                        )}
                      </td>

                      {/* Dif C100xC170 */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        {Math.abs(res.diffC100_C170) > 0.05 ? (
                          <span className="text-red-600 bg-red-100/80 px-2 py-0.5 rounded">
                            {res.diffC100_C170 > 0 ? '+' : ''}R$ {formatMoney(res.diffC100_C170)}
                          </span>
                        ) : (
                          <span className="text-emerald-600">R$ 0,00</span>
                        )}
                      </td>

                      {/* Dif C100xC190 */}
                      <td className="px-4 py-3 text-right font-mono font-bold whitespace-nowrap">
                        {Math.abs(res.diffC100_C190) > 0.05 ? (
                          <span className="text-red-600 bg-red-100/80 px-2 py-0.5 rounded">
                            {res.diffC100_C190 > 0 ? '+' : ''}R$ {formatMoney(res.diffC100_C190)}
                          </span>
                        ) : (
                          <span className="text-emerald-600">R$ 0,00</span>
                        )}
                      </td>

                      {/* Action Expand Button */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => setExpandedDocId(isExpanded ? null : res.doc.id)}
                          className="inline-flex items-center space-x-1 text-xs text-[#1e3a5f] hover:text-[#142c47] font-semibold bg-[#f1efe8] hover:bg-[#e5e2d9] px-2.5 py-1 rounded-lg transition"
                        >
                          <span>{isExpanded ? 'Ocultar' : 'Detalhar'}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>

                    {/* Detailed Accordion Breakdown View */}
                    {isExpanded && (
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <td colSpan={9} className="p-5 space-y-4">
                          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                              <h4 className="font-bold text-slate-900 text-sm flex items-center">
                                <FileCode className="w-4 h-4 text-[#1e3a5f] mr-2" />
                                Raio-X de Auditoria e Reconciliação — Nota Nº {res.doc.numDoc} (Série {res.doc.serie})
                              </h4>
                              <span className="text-xs text-slate-500 font-mono">
                                Linha Original SPED: #{res.doc.numeroLinhaOriginal || '—'}
                              </span>
                            </div>

                            {/* Triple Column Comparison Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              
                              {/* C100 Column */}
                              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                                <div className="font-bold text-slate-800 flex justify-between">
                                  <span>Bloco C100 (Cabeçalho)</span>
                                  <span className="text-[#1e3a5f] font-mono">1 Registro</span>
                                </div>
                                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Valor Doc (VL_DOC):</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.vlDoc)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Base ICMS (VL_BC_ICMS):</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.doc.vlBcIcms || 0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Valor ICMS (VL_ICMS):</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.doc.vlIcms || 0)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* C170 Column */}
                              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                                <div className="font-bold text-slate-800 flex justify-between">
                                  <span>Bloco C170 (Soma dos Itens)</span>
                                  <span className="text-[#1e3a5f] font-mono">{res.doc.items.length} Itens</span>
                                </div>
                                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Soma Itens (VL_ITEM):</span>
                                    <span className={`font-bold ${Math.abs(res.diffC100_C170) > 0.05 ? 'text-red-600' : 'text-slate-900'}`}>
                                      R$ {formatMoney(res.somaC170VlItem)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Soma Base ICMS:</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.somaC170VlBcIcms)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Soma Valor ICMS:</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.somaC170VlIcms)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* C190 Column */}
                              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
                                <div className="font-bold text-slate-800 flex justify-between">
                                  <span>Bloco C190 (Analítico PVA)</span>
                                  <span className="text-[#1e3a5f] font-mono">{res.c190Breakdown.length} Linhas</span>
                                </div>
                                <div className="space-y-1 font-mono text-[11px] text-slate-600">
                                  <div className="flex justify-between">
                                    <span>Soma Opr (VL_OPR):</span>
                                    <span className={`font-bold ${Math.abs(res.diffC100_C190) > 0.05 ? 'text-red-600' : 'text-slate-900'}`}>
                                      R$ {formatMoney(res.somaC190VlOpr)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Soma Base ICMS:</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.somaC190VlBcIcms)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Soma Valor ICMS:</span>
                                    <span className="font-bold text-slate-900">R$ {formatMoney(res.somaC190VlIcms)}</span>
                                  </div>
                                </div>
                              </div>

                            </div>

                            {/* Breakdown by CST / CFOP Table */}
                            {res.c190Breakdown.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <h5 className="font-bold text-slate-800 text-xs">
                                  Detalhamento por CST / CFOP no Registro C190
                                </h5>
                                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                  <table className="min-w-full divide-y divide-slate-200 text-[11px] font-mono">
                                    <thead className="bg-slate-100">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-bold text-slate-700">CST ICMS</th>
                                        <th className="px-3 py-2 text-left font-bold text-slate-700">CFOP</th>
                                        <th className="px-3 py-2 text-right font-bold text-slate-700">Alíq. ICMS (%)</th>
                                        <th className="px-3 py-2 text-right font-bold text-slate-700">VL_OPR (R$)</th>
                                        <th className="px-3 py-2 text-right font-bold text-slate-700">VL_BC_ICMS (R$)</th>
                                        <th className="px-3 py-2 text-right font-bold text-slate-700">VL_ICMS (R$)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                      {res.c190Breakdown.map((c, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                          <td className="px-3 py-1.5 font-bold text-[#1e3a5f]">{c.cstIcms}</td>
                                          <td className="px-3 py-1.5 font-bold text-slate-800">{c.cfop}</td>
                                          <td className="px-3 py-1.5 text-right text-slate-600">{c.aliqIcms}%</td>
                                          <td className="px-3 py-1.5 text-right font-bold text-slate-900">R$ {formatMoney(c.vlOpr)}</td>
                                          <td className="px-3 py-1.5 text-right text-slate-700">R$ {formatMoney(c.vlBcIcms)}</td>
                                          <td className="px-3 py-1.5 text-right text-slate-700">R$ {formatMoney(c.vlIcms)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Recommendation / Fix Instructions */}
                            {res.status !== 'INTEGRO' && res.status !== 'CANCELADO' && (
                              <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs space-y-1.5 text-amber-900">
                                <span className="font-bold flex items-center text-amber-900">
                                  <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
                                  Instrução para Correção e Liberação no PVA:
                                </span>
                                <p className="text-[11px] leading-relaxed">
                                  {res.status === 'ERRO_C100_C170' &&
                                    `O valor total do documento C100 (R$ ${formatMoney(res.vlDoc)}) diverge da soma dos itens C170 (R$ ${formatMoney(res.somaC170VlItem)}). Ajuste o valor dos itens no registro C170 ou reajuste o total da nota no C100.`}
                                  {res.status === 'ERRO_C100_C190' &&
                                    `A soma do registro analítico C190 (R$ ${formatMoney(res.somaC190VlOpr)}) difere do total do documento C100 (R$ ${formatMoney(res.vlDoc)}). Atualize o registro C190 para que a soma dos valores da operação seja idêntica ao C100.`}
                                  {res.status === 'ERRO_C170_C190' &&
                                    `O somatório dos itens agrupados por CST/CFOP não coincide com as linhas do C190. Recalcule o C190 com base no agrupamento exato dos itens C170.`}
                                  {res.status === 'ERRO_C190_AUSENTE' &&
                                    `Este documento possui valor comercial mas não possui nenhum registro C190 associado. Insira o registro C190 correspondente ao enquadramento de CST e CFOP.`}
                                  {res.status === 'ERRO_C190_DUPLICADO' &&
                                    `Identificadas duplicidades no registro C190 (${res.duplicateC190Details.join(', ')}). Clique no botão "Recalcular C100 e C190" no topo do relatório para unificar e somar os valores das linhas duplicadas em um único registro.`}
                                </p>
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
  );
}
