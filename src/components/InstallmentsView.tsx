import React, { useMemo } from 'react';
import { SpedData } from '../types';
import { CreditCard, Calendar, ArrowRight, Wallet, Receipt, Clock, AlertCircle, Download, RefreshCw, FileCode } from 'lucide-react';
import { exportInstallments } from '../lib/spedExporter';

interface InstallmentsViewProps {
  spedData: SpedData;
  onCrossReferenceXml?: () => void;
}

export function InstallmentsView({ spedData, onCrossReferenceXml }: InstallmentsViewProps) {
  const invoices = spedData.invoices || [];

  const handleExport = () => {
    const content = exportInstallments(spedData);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PARCELAS_C140_C141_${spedData.header.cnpj || 'SPED'}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    let totalTit = 0;
    let totalParc = 0;
    let countParc = 0;
    
    invoices.forEach(inv => {
      totalTit += inv.vlTit;
      inv.installments.forEach(p => {
        totalParc += p.vlParc;
        countParc++;
      });
    });

    return { totalTit, totalParc, countParc, countInv: invoices.length };
  }, [invoices]);

  const formatMoney = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (val: string) => {
    if (!val || val.length !== 8) return val;
    return `${val.substring(0, 2)}/${val.substring(2, 4)}/${val.substring(4, 8)}`;
  };

  if (invoices.length === 0) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 text-center space-y-6">
        <div className="w-20 h-20 bg-[var(--atlas-surface-hover)] text-[var(--atlas-text-muted)] rounded-full flex items-center justify-center mx-auto border-2 border-dashed border-[var(--atlas-border)]">
          <CreditCard className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-[var(--atlas-navy)]">Nenhuma Fatura Encontrada</h2>
          <p className="text-[var(--atlas-text-secondary)] max-w-md mx-auto">
            Não foram identificados registros de faturas (C140/C141) no SPED. Você pode capturar essas informações automaticamente cruzando com os arquivos XML.
          </p>
        </div>
        
        {onCrossReferenceXml && (
          <button
            onClick={onCrossReferenceXml}
            className="atlas-btn atlas-btn-accent py-3 px-8 shadow-xl hover:scale-105 transition-transform"
          >
            <RefreshCw className="w-5 h-5" />
            <span className="text-sm font-bold uppercase tracking-wider">Cruzar XMLs para Extrair Parcelas</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--atlas-navy)] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            Parcelas e Faturas
          </h1>
          <p className="text-sm text-[var(--atlas-text-secondary)] mt-2">Cruzamento de faturas, duplicatas e fluxos de vencimento (Registros C140/C141)</p>
          <div className="flex items-center gap-2 mt-2 p-2 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Nota: Use o botão de exportação para gerar o arquivo financeiro separado, conforme exigência de alguns validadores que não aceitam C140/C141 dentro do arquivo principal.</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onCrossReferenceXml && (
            <button
              onClick={onCrossReferenceXml}
              className="atlas-btn atlas-btn-secondary py-2 px-5"
              title="Sincronizar dados financeiros a partir dos XMLs carregados"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Sincronizar com XMLs</span>
            </button>
          )}
          
          <button
            onClick={handleExport}
            className="atlas-btn atlas-btn-primary py-2 px-6 shadow-lg"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Arquivo de Parcelas</span>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="atlas-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">Total em Faturas</p>
            <p className="text-xl font-black text-[var(--atlas-navy)]">{formatMoney(stats.totalTit)}</p>
          </div>
        </div>

        <div className="atlas-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">Soma das Parcelas</p>
            <p className="text-xl font-black text-[var(--atlas-navy)]">{formatMoney(stats.totalParc)}</p>
          </div>
        </div>

        <div className="atlas-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">Qtd. Parcelas</p>
            <p className="text-xl font-black text-[var(--atlas-navy)]">{stats.countParc}</p>
          </div>
        </div>

        <div className="atlas-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">Qtd. Títulos</p>
            <p className="text-xl font-black text-[var(--atlas-navy)]">{stats.countInv}</p>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="atlas-card overflow-hidden">
        <div className="p-5 border-b border-[var(--atlas-border)] bg-[var(--atlas-surface-hover)]/30">
          <h3 className="text-xs font-bold text-[var(--atlas-navy)] uppercase tracking-wider">Listagem de Documentos Financeiros</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[var(--atlas-surface)] border-b border-[var(--atlas-border)]">
              <tr className="text-[10px] font-bold text-[var(--atlas-text-muted)] uppercase tracking-widest">
                <th className="px-6 py-4">Doc/Série</th>
                <th className="px-6 py-4">Emissão</th>
                <th className="px-6 py-4 text-right">Vl. Título</th>
                <th className="px-6 py-4 text-right">Vl. Líquido</th>
                <th className="px-6 py-4">Parcelamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--atlas-border)]">
              {invoices.map((inv, idx) => (
                <React.Fragment key={idx}>
                  <tr className="hover:bg-[var(--atlas-surface-hover)]/30 transition-colors">
                    <td className="px-6 py-4 font-bold text-[var(--atlas-navy)]">
                      {inv.numDoc} / {inv.serie}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--atlas-text-secondary)]">
                      {formatDate(inv.dtEmis)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm">
                      {formatMoney(inv.vlTit)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm font-bold text-emerald-600">
                      {formatMoney(inv.vlLiq)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {inv.installments.map((p, pIdx) => (
                          <div key={pIdx} className="atlas-pill atlas-pill-navy text-[10px] py-0.5">
                            {p.numParc}: {formatDate(p.dtVcto)} - {formatMoney(p.vlParc)}
                          </div>
                        ))}
                        {inv.installments.length === 0 && (
                          <span className="text-[10px] italic text-[var(--atlas-text-muted)]">Sem parcelas detalhadas</span>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Integrity Check for individual invoice */}
                  {inv.installments.length > 0 && Math.abs(inv.vlTit - inv.installments.reduce((s, p) => s + p.vlParc, 0)) > 0.05 && (
                    <tr className="bg-red-50/50">
                      <td colSpan={5} className="px-6 py-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-600">
                          <AlertCircle className="w-3 h-3" />
                          <span>Divergência: Soma das parcelas ({formatMoney(inv.installments.reduce((s, p) => s + p.vlParc, 0))}) difere do valor do título ({formatMoney(inv.vlTit)})</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
