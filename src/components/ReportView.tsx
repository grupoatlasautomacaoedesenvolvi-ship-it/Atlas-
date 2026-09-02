import React, { useState, useMemo } from 'react';
import { SpedData, AuditConfig, XmlRecord, Achado } from '../types';
import { executarAuditoriaUnificada } from '../lib/auditEngine';
import { exportSped, AlteracaoAplicada } from '../lib/spedExporter';
import { C100C190IntegrityChecker } from './C100C190IntegrityChecker';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter, 
  Building2, 
  ShieldCheck, 
  Scale, 
  Printer, 
  FileSpreadsheet, 
  Layers, 
  Calendar, 
  ArrowRight,
  Info,
  BadgeAlert,
  FileCheck,
  CheckSquare,
  Calculator
} from 'lucide-react';

interface ReportViewProps {
  spedData: SpedData | null;
  auditConfig: AuditConfig | null;
  xmlTerceiros?: XmlRecord[];
  xmlProprio?: XmlRecord[];
  xmlNfce?: XmlRecord[];
  onRecalculateStructure?: () => void;
}

function getFieldLabel(campo: string): string {
  switch (campo) {
    case 'cstIcms': return 'CST do ICMS';
    case 'cfop': return 'CFOP da Operação';
    case 'vlItem': return 'Valor Total do Item';
    case 'vlBcIcms': return 'Base de Cálculo ICMS';
    case 'vlIcms': return 'Valor do ICMS';
    case 'aliqIcms': return 'Alíquota de ICMS (%)';
    case 'insercao-documento': return 'Escrituração de Nota Fiscal Omissa (C100/C170/C190)';
    case 'vlTotDebitos': return 'Total de Débitos (E110)';
    case 'vlTotCreditos': return 'Total de Créditos (E110)';
    case 'vlSldApurado': return 'Saldo Apurado de ICMS (E110)';
    case 'vlSldCredorTransportar': return 'Saldo Credor a Transportar (E110)';
    default: return campo;
  }
}

function getFiscalJustification(alt: AlteracaoAplicada, rawFindings: Achado[], companyUf: string): string {
  if (alt.campo === 'insercao-documento') {
    return `Inclusão de documento fiscal identificado no acervo XML mas ausente na escrituração original (Registros C100, C170 e C190 inseridos com sucesso).`;
  }
  if (alt.achadoId === 'edicao-direta') {
    return `Ajuste e readequação tributária direta conforme Matriz Fiscal do Estado (${companyUf}) e Guia Prático da EFD ICMS/IPI.`;
  }
  const finding = rawFindings.find(f => f.id === alt.achadoId);
  if (finding) {
    return `${finding.titulo}: ${finding.descricao}`;
  }
  return `Readequação de conformidade técnica para atendimento à legislação estadual (${companyUf}).`;
}

export function ReportView({
  spedData,
  auditConfig,
  xmlTerceiros = [],
  xmlProprio = [],
  xmlNfce = [],
  onRecalculateStructure
}: ReportViewProps) {
  const [reportTitle, setReportTitle] = useState('Parecer Técnico de Auditoria & Relatório de Correções Fiscais');
  const [analystNotes, setAnalystNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'CST_CFOP' | 'OMISSA' | 'VALORES'>('ALL');
  const [activeReportTab, setActiveReportTab] = useState<'INTEGRIDADE' | 'PARECER' | 'TODOS'>('INTEGRIDADE');

  const rawFindings = useMemo(() => {
    if (!spedData) return [];
    return executarAuditoriaUnificada(spedData, auditConfig, xmlTerceiros, xmlProprio, xmlNfce);
  }, [spedData, auditConfig, xmlTerceiros, xmlProprio, xmlNfce]);

  const exportResult = useMemo(() => {
    if (!spedData) return null;
    return exportSped(spedData, rawFindings);
  }, [spedData, rawFindings]);

  const appliedCorrections = exportResult?.relatorio || [];
  const companyUf = (spedData?.header.uf || 'SP').toUpperCase();

  // Metrics calculation
  const totalFindings = rawFindings.length;
  const approvedCount = rawFindings.filter(f => f.statusRevisao === 'aprovado').length;
  const pendingCount = rawFindings.filter(f => f.statusRevisao === 'pendente').length;
  const rejectedCount = rawFindings.filter(f => f.statusRevisao === 'rejeitado').length;

  const totalCorrectionsApplied = appliedCorrections.length;
  const cstCfopCorrectionsCount = appliedCorrections.filter(a => a.campo === 'cstIcms' || a.campo === 'cfop').length;
  const missingNotesInsertedCount = appliedCorrections.filter(a => a.campo === 'insercao-documento').length;
  const valueCorrectionsCount = appliedCorrections.filter(a => a.campo.includes('vl') || a.campo.includes('aliq')).length;

  const sanitizationRate = totalFindings > 0 
    ? Math.round(((approvedCount + totalCorrectionsApplied) / (totalFindings + totalCorrectionsApplied)) * 100) 
    : 100;

  // Filtered corrections for interactive table
  const filteredCorrections = useMemo(() => {
    return appliedCorrections.filter(alt => {
      const fieldLabel = getFieldLabel(alt.campo).toLowerCase();
      const justification = getFiscalJustification(alt, rawFindings, companyUf).toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch = !searchTerm || 
        alt.registro.toLowerCase().includes(term) ||
        String(alt.numeroLinha).includes(term) ||
        alt.valorAntigo.toLowerCase().includes(term) ||
        alt.valorNovo.toLowerCase().includes(term) ||
        fieldLabel.includes(term) ||
        justification.includes(term);

      if (!matchesSearch) return false;

      if (filterCategory === 'CST_CFOP') {
        return alt.campo === 'cstIcms' || alt.campo === 'cfop';
      }
      if (filterCategory === 'OMISSA') {
        return alt.campo === 'insercao-documento';
      }
      if (filterCategory === 'VALORES') {
        return alt.campo.includes('vl') || alt.campo.includes('aliq');
      }
      return true;
    });
  }, [appliedCorrections, searchTerm, filterCategory, rawFindings, companyUf]);

  const defaultParecerText = useMemo(() => {
    if (!spedData) return '';
    return `Trata-se do Parecer Técnico de Auditoria Fiscal e Sanitização do arquivo EFD ICMS/IPI da empresa ${spedData.header.nome} (CNPJ: ${spedData.header.cnpj}), referente ao período de ${spedData.header.dtIni} a ${spedData.header.dtFin} na UF de ${companyUf}.

O procedimento de auditoria abrangeu a validação da integridade estrutural das linhas, cruzamento eletrônico das informações prestadas nos Blocos C100, C170 e C190 contra o acervo de arquivos XML (NF-e de Terceiros, NF-e Própria e NFC-e), bem como a checagem das alíquotas e CST/CFOP frente à Matriz Fiscal aplicável.

Foram identificados um total de ${totalFindings} apontamentos de divergência. Após análise técnica e revisão, foram aplicadas ${totalCorrectionsApplied} correções diretamente no arquivo do SPED TXT, resgatando ${missingNotesInsertedCount} documento(s) fiscal(is) omitido(s) e ajustando ${cstCfopCorrectionsCount} enquadramento(s) de CST/CFOP. O arquivo sanitizado encontra-se totalmente auditado e em estrita conformidade com o Guia Prático da EFD ICMS/IPI.`;
  }, [spedData, companyUf, totalFindings, totalCorrectionsApplied, missingNotesInsertedCount, cstCfopCorrectionsCount]);

  const generatePDF = () => {
    if (!spedData) return;
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      let cursorY = 15;

      // Header Banner (Navy Blue)
      doc.setFillColor(30, 58, 138); // navy blue
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('PARECER TÉCNICO DE AUDITORIA & RELATÓRIO DE CORREÇÕES FISCAIS', 14, 15);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`SPED EFD ICMS/IPI — Sanitização e Reconciliação Eletrônica`, 14, 22);

      cursorY = 36;

      // Company Info Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, cursorY, pageWidth - 28, 28, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(`Empresa: ${spedData.header.nome}`, 18, cursorY + 7);
      doc.text(`CNPJ: ${spedData.header.cnpj}`, 18, cursorY + 14);
      doc.text(`UF: ${companyUf}`, 130, cursorY + 14);
      doc.text(`Período EFD: ${spedData.header.dtIni} a ${spedData.header.dtFin}`, 18, cursorY + 21);
      doc.text(`Data da Auditoria: ${new Date().toLocaleDateString('pt-BR')}`, 130, cursorY + 21);

      cursorY += 36;

      // Executive Technical Opinion
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('1. PARECER TÉCNICO DO ANALISTA FISCAL SENIOR', 14, cursorY);
      cursorY += 6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);

      const parecerCompleto = (analystNotes.trim() ? analystNotes : defaultParecerText);
      const splitParecer = doc.splitTextToSize(parecerCompleto, pageWidth - 28);
      doc.text(splitParecer, 14, cursorY);
      cursorY += (splitParecer.length * 4.5) + 8;

      // Fiscal KPIs Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('2. RESUMO EXECUTIVO DE INDICADORES E CORREÇÕES', 14, cursorY);
      cursorY += 6;

      const kpiData = [
        ['Inconsistências Mapeadas na Auditoria', String(totalFindings), 'Correções Aplicadas no SPED TXT', String(totalCorrectionsApplied)],
        ['Notas Fiscais Omissas Inseridas', String(missingNotesInsertedCount), 'Ajustes de CST / CFOP', String(cstCfopCorrectionsCount)],
        ['Ajustes de Impostos / Valores', String(valueCorrectionsCount), 'Índice de Sanitização Fiscal', `${sanitizationRate}%`]
      ];

      autoTable(doc, {
        startY: cursorY,
        head: [['Indicador Auditado', 'Qtd', 'Ação Corretiva Executada', 'Qtd']],
        body: kpiData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 70 },
          1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 70 },
          3: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
        }
      });

      cursorY = (doc as any).lastAutoTable.finalY + 12;

      // ICMS Reconciliation Box (E110)
      if (spedData.apuracao) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text('3. DEMONSTRATIVO DE APURAÇÃO DO ICMS (RECONCILIAÇÃO E110)', 14, cursorY);
        cursorY += 6;

        const apuracaoData = [
          ['Total de Débitos (Saídas/Prestações)', `R$ ${spedData.apuracao.vlTotDebitos.toFixed(2).replace('.', ',')}`],
          ['Total de Créditos (Entradas/Apropriações)', `R$ ${spedData.apuracao.vlTotCreditos.toFixed(2).replace('.', ',')}`],
          ['Saldo Apurado de ICMS', `R$ ${spedData.apuracao.vlSldApurado.toFixed(2).replace('.', ',')}`],
          ['Saldo Credor a Transportar', `R$ ${spedData.apuracao.vlSldCredorTransportar.toFixed(2).replace('.', ',')}`]
        ];

        autoTable(doc, {
          startY: cursorY,
          head: [['Campo de Apuração (E110)', 'Valor Apurado Reconciliado']],
          body: apuracaoData,
          theme: 'striped',
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 120 },
            1: { cellWidth: 62, halign: 'right', fontStyle: 'bold' }
          }
        });

        cursorY = (doc as any).lastAutoTable.finalY + 12;
      }

      // Detailed Table of Corrections
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('4. RELATÓRIO ANALÍTICO DAS CORREÇÕES APLICADAS NO SPED TXT', 14, cursorY);
      cursorY += 6;

      const tableRows = appliedCorrections.map(alt => [
        alt.numeroLinha > 0 ? `#${alt.numeroLinha}` : 'Nova Linha',
        alt.registro,
        getFieldLabel(alt.campo),
        alt.valorAntigo,
        alt.valorNovo,
        getFiscalJustification(alt, rawFindings, companyUf)
      ]);

      autoTable(doc, {
        startY: cursorY,
        head: [['Linha', 'Reg.', 'Campo', 'Antes (Original)', 'Depois (Corrigido)', 'Justificativa Técnico-Fiscal']],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 16, halign: 'center' },
          1: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
          2: { cellWidth: 32 },
          3: { cellWidth: 24, textColor: [185, 28, 28] },
          4: { cellWidth: 24, textColor: [4, 120, 87], fontStyle: 'bold' },
          5: { cellWidth: 'auto' }
        },
        didDrawPage: (data) => {
          // Footer
          const str = `Página ${data.pageNumber}`;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, pageWidth - 25, doc.internal.pageSize.height - 10);
          doc.text('Relatório emitido por Atlas Auditor Fiscal — Analista Fiscal Senior', 14, doc.internal.pageSize.height - 10);
        }
      });

      // Technical Signature Block on last page
      let finalY = (doc as any).lastAutoTable.finalY + 20;
      if (finalY + 30 > doc.internal.pageSize.height) {
        doc.addPage();
        finalY = 30;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(14, finalY, 100, finalY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text('DECLARAÇÃO DE RESPONSABILIDADE TÉCNICA', 14, finalY + 5);
      doc.setFont('helvetica', 'normal');
      doc.text('Analista / Auditor Fiscal Senior', 14, finalY + 10);
      doc.text(`Validação realizada em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, finalY + 15);

      doc.save(`Parecer_Tecnico_SPED_${spedData.header.cnpj}_${companyUf}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF do relatório fiscal:', e);
      alert('Ocorreu um erro ao gerar o PDF. Verifique os dados e tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const generateExcel = () => {
    if (!spedData) return;

    try {
      // Sheet 1: Resumo Executivo
      const resumoData = [
        { Campo: 'Empresa / Razão Social', Valor: spedData.header.nome },
        { Campo: 'CNPJ', Valor: spedData.header.cnpj },
        { Campo: 'UF (Estado)', Valor: companyUf },
        { Campo: 'Período EFD', Valor: `${spedData.header.dtIni} a ${spedData.header.dtFin}` },
        { Campo: 'Data da Auditoria', Valor: new Date().toLocaleDateString('pt-BR') },
        { Campo: 'Total de Apontamentos de Auditoria', Valor: totalFindings },
        { Campo: 'Total de Correções Aplicadas no TXT', Valor: totalCorrectionsApplied },
        { Campo: 'Notas Fiscais Omissas Inseridas', Valor: missingNotesInsertedCount },
        { Campo: 'Ajustes de CST / CFOP', Valor: cstCfopCorrectionsCount },
        { Campo: 'Índice de Sanitização Fiscal', Valor: `${sanitizationRate}%` }
      ];

      // Sheet 2: Apuração ICMS E110
      const apuracaoData = spedData.apuracao ? [
        { Campo: 'Total de Débitos (Saídas)', Valor: `R$ ${spedData.apuracao.vlTotDebitos.toFixed(2)}` },
        { Campo: 'Total de Créditos (Entradas)', Valor: `R$ ${spedData.apuracao.vlTotCreditos.toFixed(2)}` },
        { Campo: 'Saldo Apurado de ICMS', Valor: `R$ ${spedData.apuracao.vlSldApurado.toFixed(2)}` },
        { Campo: 'Saldo Credor a Transportar', Valor: `R$ ${spedData.apuracao.vlSldCredorTransportar.toFixed(2)}` }
      ] : [];

      // Sheet 3: Relatório de Correções
      const correcoesData = appliedCorrections.map(alt => ({
        Linha: alt.numeroLinha > 0 ? alt.numeroLinha : 'Nova Linha',
        Registro: alt.registro,
        Campo: getFieldLabel(alt.campo),
        'Valor Antigo': alt.valorAntigo,
        'Valor Novo': alt.valorNovo,
        'Justificativa Fiscal': getFiscalJustification(alt, rawFindings, companyUf)
      }));

      // Sheet 4: Log de Inconsistências Mapeadas
      const achadosData = rawFindings.map(f => ({
        Tipo: f.tipo,
        Severidade: f.severidade.toUpperCase(),
        Status: f.statusRevisao.toUpperCase(),
        Documento: f.numDoc || '',
        'Item / NCM': f.codItem || f.ncm || '',
        Título: f.titulo,
        Descrição: f.descricao
      }));

      const wb = XLSX.utils.book_new();

      const wsResumo = XLSX.utils.json_to_sheet(resumoData);
      XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Executivo');

      if (apuracaoData.length > 0) {
        const wsApuracao = XLSX.utils.json_to_sheet(apuracaoData);
        XLSX.utils.book_append_sheet(wb, wsApuracao, 'Apuração E110');
      }

      const wsCorrecoes = XLSX.utils.json_to_sheet(correcoesData);
      XLSX.utils.book_append_sheet(wb, wsCorrecoes, 'Correções no SPED');

      const wsAchados = XLSX.utils.json_to_sheet(achadosData);
      XLSX.utils.book_append_sheet(wb, wsAchados, 'Log Inconsistências');

      XLSX.writeFile(wb, `Relatorio_Auditoria_Fiscal_${spedData.header.cnpj}_${companyUf}.xlsx`);
    } catch (err) {
      console.error('Erro ao gerar Excel:', err);
      alert('Erro ao exportar planilha Excel. Verifique os dados e tente novamente.');
    }
  };

  if (!spedData) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-12 space-y-4">
          <FileText className="w-16 h-16 text-[#1e3a5f] mx-auto" />
          <h2 className="text-2xl font-bold text-slate-800">Nenhum arquivo SPED EFD carregado</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Importe o arquivo TXT do SPED Fiscal e os XMLs correspondentes para visualizar o Parecer Técnico e o Relatório de Correções do Analista Fiscal Senior.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-lg p-6 sm:p-8 text-white shadow-xs border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Parecer Técnico do Analista Fiscal Senior</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Relatório de Auditoria & Correções Fiscais
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Consolidação técnica oficial contendo a sanitização do SPED TXT, resgate de notas omissas, readequação da Matriz Fiscal da UF <span className="font-bold text-white">{companyUf}</span> e reconciliação dos saldos de ICMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg border border-slate-700 text-sm font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Relatório</span>
            </button>

            <button
              onClick={generateExcel}
              className="flex items-center space-x-2 bg-[#0f6e56] hover:bg-[#0b5240] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.XLSX)</span>
            </button>

            <button
              onClick={generatePDF}
              disabled={generating}
              className="flex items-center space-x-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-xs transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{generating ? 'Gerando PDF...' : 'Exportar Parecer Técnico (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Company Meta Header Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Empresa / Razão Social</span>
            <span className="font-bold text-slate-100 truncate block">{spedData.header.nome}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">CNPJ & Estado (UF)</span>
            <span className="font-bold text-slate-100 block">{spedData.header.cnpj} — <span className="text-slate-200">{companyUf}</span></span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Regime Tributário</span>
            <span className="font-bold text-slate-100 block">Regime Normal (EFD)</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Período EFD ICMS/IPI</span>
            <span className="font-bold text-slate-100 block">{spedData.header.dtIni} a {spedData.header.dtFin}</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Status da Sanitização</span>
            <span className="inline-flex items-center text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Auditado & Reconciliado
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/80 p-1.5 rounded-lg w-full sm:w-fit text-xs font-bold text-slate-700">
        <button
          onClick={() => setActiveReportTab('INTEGRIDADE')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition ${
            activeReportTab === 'INTEGRIDADE' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-[#1e3a5f]" />
          <span>Checagem C100 / C170 / C190 (PVA)</span>
        </button>
        <button
          onClick={() => setActiveReportTab('PARECER')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition ${
            activeReportTab === 'PARECER' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-[#1e3a5f]" />
          <span>Parecer Técnico & Sanitização</span>
        </button>
        <button
          onClick={() => setActiveReportTab('TODOS')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition ${
            activeReportTab === 'TODOS' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-[#1e3a5f]" />
          <span>Visão Completa Unificada</span>
        </button>
      </div>

      {/* View 1: C100 / C170 / C190 Integrity Checker */}
      {(activeReportTab === 'INTEGRIDADE' || activeReportTab === 'TODOS') && (
        <C100C190IntegrityChecker spedData={spedData} onRecalculateStructure={onRecalculateStructure} />
      )}

      {/* View 2: Parecer Técnico & Audit Summary */}
      {(activeReportTab === 'PARECER' || activeReportTab === 'TODOS') && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Inconsistências Mapeadas</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{totalFindings}</p>
                <p className="text-xs text-slate-500 mt-1">{pendingCount} pendentes de aprovação</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-amber-600 border border-amber-100">
                <BadgeAlert className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Correções no SPED TXT</p>
                <p className="text-2xl font-black text-[#0f6e56] mt-1">{totalCorrectionsApplied}</p>
                <p className="text-xs text-slate-500 mt-1">Linhas ajustadas/inseridas</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg text-[#0f6e56] border border-emerald-100">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas Omissas Resgatadas</p>
                <p className="text-2xl font-black text-[#1e3a5f] mt-1">{missingNotesInsertedCount}</p>
                <p className="text-xs text-slate-500 mt-1">Via cruzamento XMLs</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg text-[#1e3a5f] border border-slate-200">
                <FileCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sanitização Fiscal</p>
                <p className="text-2xl font-black text-[#1e3a5f] mt-1">{sanitizationRate}%</p>
                <p className="text-xs text-slate-500 mt-1">Conformidade com Guia EFD</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-lg text-[#1e3a5f] border border-slate-200">
                <Scale className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Senior Analyst Opinion Editor / View */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#1e3a5f]" />
            <h2 className="text-base font-bold text-slate-800">Parecer Técnico e Considerações do Auditor</h2>
          </div>
          <span className="text-xs text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 font-mono">
            EFD Layout v3.1.x / RICMS-{companyUf}
          </span>
        </div>

        <div className="p-6 space-y-4">
          <textarea
            rows={6}
            value={analystNotes || defaultParecerText}
            onChange={(e) => setAnalystNotes(e.target.value)}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-300 rounded-lg p-4 focus:ring-1 focus:ring-[#1e3a5f] font-sans leading-relaxed transition-all"
            placeholder="Edite ou adicione considerações personalizadas para o relatório final..."
          />
          <p className="text-xs text-slate-400 flex items-center">
            <Info className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Este parecer é incorporado ao cabeçalho do PDF oficial e serve como embasamento em fiscalizações estaduais.
          </p>
        </div>
      </div>

      {/* Reconciled ICMS Balance (E110) */}
      {spedData.apuracao && (
        <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center">
              <Building2 className="w-5 h-5 text-[#1e3a5f] mr-2" />
              Demonstrativo de Reconciliação do ICMS (Bloco E110)
            </h3>
            <span className="text-xs text-[#0f6e56] font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              Saldos Recalculados
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Total de Débitos</span>
              <span className="text-lg font-bold text-slate-900 mt-1 block">
                R$ {spedData.apuracao.vlTotDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Total de Créditos</span>
              <span className="text-lg font-bold text-slate-900 mt-1 block">
                R$ {spedData.apuracao.vlTotCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Saldo Apurado</span>
              <span className="text-lg font-bold text-[#1e3a5f] mt-1 block">
                R$ {spedData.apuracao.vlSldApurado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase block">Saldo Credor a Transportar</span>
              <span className="text-lg font-bold text-[#0f6e56] mt-1 block">
                R$ {spedData.apuracao.vlSldCredorTransportar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Table of Applied Corrections */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center">
              <Layers className="w-5 h-5 text-[#1e3a5f] mr-2" />
              Detalhamento de Tudo Que Foi Corrigido no SPED TXT
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Exibindo <span className="font-bold text-slate-700">{filteredCorrections.length}</span> de <span className="font-bold text-slate-700">{appliedCorrections.length}</span> alterações aplicadas.
            </p>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar linha, registro, valor..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-1 focus:ring-[#1e3a5f]"
              />
            </div>

            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs w-full sm:w-auto justify-center">
              <button
                onClick={() => setFilterCategory('ALL')}
                className={`px-3 py-1.5 rounded font-semibold transition-all ${filterCategory === 'ALL' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Todas ({appliedCorrections.length})
              </button>
              <button
                onClick={() => setFilterCategory('CST_CFOP')}
                className={`px-3 py-1.5 rounded font-semibold transition-all ${filterCategory === 'CST_CFOP' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                CST/CFOP ({cstCfopCorrectionsCount})
              </button>
              <button
                onClick={() => setFilterCategory('OMISSA')}
                className={`px-3 py-1.5 rounded font-semibold transition-all ${filterCategory === 'OMISSA' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Omissas ({missingNotesInsertedCount})
              </button>
              <button
                onClick={() => setFilterCategory('VALORES')}
                className={`px-3 py-1.5 rounded font-semibold transition-all ${filterCategory === 'VALORES' ? 'bg-white text-[#1e3a5f] shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Valores ({valueCorrectionsCount})
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider w-20">Linha TXT</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider w-20">Registro</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Campo Alterado</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Antes (Original)</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Depois (Corrigido)</th>
                <th className="px-4 py-3 text-left font-bold text-slate-700 uppercase tracking-wider">Justificativa Técnico-Fiscal</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredCorrections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    Nenhuma alteração encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredCorrections.map((alt, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-500 whitespace-nowrap">
                      {alt.numeroLinha > 0 ? `#${alt.numeroLinha}` : <span className="text-[#1e3a5f] font-bold">+Nova</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        {alt.registro}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                      {getFieldLabel(alt.campo)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block bg-red-50 text-red-700 border border-red-200 font-mono px-2 py-0.5 rounded text-xs line-through">
                        {alt.valorAntigo}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold px-2 py-0.5 rounded text-xs">
                        {alt.valorNovo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 leading-relaxed max-w-md">
                      {getFiscalJustification(alt, rawFindings, companyUf)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* General Audit Mappings Breakdown */}
      <div className="bg-white rounded-lg shadow-xs border border-slate-200 p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center">
          <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
          Resumo Geral dos Apontamentos de Auditoria
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block text-sm">Status da Revisão</span>
            <div className="flex justify-between items-center text-slate-600">
              <span>Pendentes de Análise:</span>
              <span className="font-bold text-amber-600">{pendingCount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Aprovados / Sanitizados:</span>
              <span className="font-bold text-emerald-600">{approvedCount}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Rejeitados (Falso Positivo):</span>
              <span className="font-bold text-slate-500">{rejectedCount}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block text-sm">Severidade dos Riscos</span>
            <div className="flex justify-between items-center text-slate-600">
              <span>Risco Alto (Autuação):</span>
              <span className="font-bold text-red-600">{rawFindings.filter(f => f.severidade === 'alta').length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Risco Médio (Inconsistência):</span>
              <span className="font-bold text-amber-600">{rawFindings.filter(f => f.severidade === 'media').length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Risco Baixo (Alerta):</span>
              <span className="font-bold text-blue-600">{rawFindings.filter(f => f.severidade === 'baixa').length}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block text-sm">Documentos Auditados</span>
            <div className="flex justify-between items-center text-slate-600">
              <span>Total no SPED Fiscal:</span>
              <span className="font-bold text-slate-800">{spedData.documents.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>XMLs Terceiros Carregados:</span>
              <span className="font-bold text-slate-800">{xmlTerceiros.length}</span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>XMLs Próprios / NFC-e:</span>
              <span className="font-bold text-slate-800">{xmlProprio.length + xmlNfce.length}</span>
            </div>
          </div>
        </div>
      </div>
        </>
      )}

    </div>
  );
}
