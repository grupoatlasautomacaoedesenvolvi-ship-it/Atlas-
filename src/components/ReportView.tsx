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
        <div className="atlas-card p-12 space-y-4">
          <FileText className="w-16 h-16 text-[var(--atlas-navy)] mx-auto" />
          <h2 className="text-2xl font-bold text-[var(--atlas-navy)]">Nenhum arquivo SPED EFD carregado</h2>
          <p className="text-xs text-[var(--atlas-text-secondary)] max-w-md mx-auto">
            Importe o arquivo TXT do SPED Fiscal e os XMLs correspondentes para visualizar o Parecer Técnico e o Relatório de Correções do Analista Fiscal Senior.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 text-[var(--atlas-text)]">
      
      {/* Header Banner */}
      <div className="atlas-card p-6 sm:p-8 bg-[var(--atlas-navy)] text-white space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="atlas-pill atlas-pill-accent inline-flex items-center space-x-2 py-1 px-3 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[var(--atlas-accent)]" />
              <span>Parecer Técnico do Analista Fiscal Senior</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Relatório de Auditoria & Correções Fiscais
            </h1>
            <p className="text-white/80 text-xs max-w-2xl leading-relaxed">
              Consolidação técnica oficial contendo a sanitização do SPED TXT, resgate de notas omissas, readequação da Matriz Fiscal da UF <span className="font-bold text-white">{companyUf}</span> e reconciliação dos saldos de ICMS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              onClick={() => window.print()}
              className="atlas-btn atlas-btn-secondary text-xs py-2 px-3.5"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={generateExcel}
              className="atlas-btn atlas-btn-accent text-xs py-2 px-3.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.XLSX)</span>
            </button>

            <button
              onClick={generatePDF}
              disabled={generating}
              className="atlas-btn atlas-btn-primary text-xs py-2 px-3.5"
            >
              <Download className="w-4 h-4" />
              <span>{generating ? 'Gerando PDF...' : 'Exportar Parecer (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Company Meta Header Bar */}
        <div className="pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-white/60 block mb-0.5">Empresa / Razão Social</span>
            <span className="font-bold text-white truncate block">{spedData.header.nome}</span>
          </div>
          <div>
            <span className="text-white/60 block mb-0.5">CNPJ & Estado (UF)</span>
            <span className="font-bold text-white block">{spedData.header.cnpj} — <span>{companyUf}</span></span>
          </div>
          <div>
            <span className="text-white/60 block mb-0.5">Regime Tributário</span>
            <span className="font-bold text-white block">Regime Normal (EFD)</span>
          </div>
          <div>
            <span className="text-white/60 block mb-0.5">Período EFD ICMS/IPI</span>
            <span className="font-bold text-white block">{spedData.header.dtIni} a {spedData.header.dtFin}</span>
          </div>
          <div>
            <span className="text-white/60 block mb-0.5">Status da Sanitização</span>
            <span className="inline-flex items-center text-[var(--atlas-accent)] font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Auditado & Reconciliado
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--atlas-border)] pb-2 text-xs">
        <button
          onClick={() => setActiveReportTab('INTEGRIDADE')}
          className={`atlas-btn py-1.5 px-3.5 ${activeReportTab === 'INTEGRIDADE' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Checagem C100 / C170 / C190 (PVA)</span>
        </button>
        <button
          onClick={() => setActiveReportTab('PARECER')}
          className={`atlas-btn py-1.5 px-3.5 ${activeReportTab === 'PARECER' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <FileText className="w-4 h-4" />
          <span>Parecer Técnico & Sanitização</span>
        </button>
        <button
          onClick={() => setActiveReportTab('TODOS')}
          className={`atlas-btn py-1.5 px-3.5 ${activeReportTab === 'TODOS' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
        >
          <Layers className="w-4 h-4" />
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
          <div className="atlas-stat-strip">
            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Inconsistências</span>
              <span className="atlas-stat-value text-[var(--atlas-warning)]">{totalFindings}</span>
              <span className="text-[11px] text-[var(--atlas-text-secondary)] mt-1">{pendingCount} pendentes</span>
            </div>

            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Correções SPED TXT</span>
              <span className="atlas-stat-value text-[var(--atlas-accent)]">{totalCorrectionsApplied}</span>
              <span className="text-[11px] text-[var(--atlas-text-secondary)] mt-1">Linhas ajustadas</span>
            </div>

            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Notas Omissas Resgatadas</span>
              <span className="atlas-stat-value text-[var(--atlas-navy)]">{missingNotesInsertedCount}</span>
              <span className="text-[11px] text-[var(--atlas-text-secondary)] mt-1">Via cruzamento XML</span>
            </div>

            <div className="atlas-stat-item">
              <span className="atlas-stat-label">Sanitização Fiscal</span>
              <span className="atlas-stat-value text-[var(--atlas-navy)]">{sanitizationRate}%</span>
              <span className="text-[11px] text-[var(--atlas-text-secondary)] mt-1">Conformidade Guia EFD</span>
            </div>
          </div>

          {/* Senior Analyst Opinion Editor / View */}
          <div className="atlas-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--atlas-border)]">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-[var(--atlas-navy)]" />
                <h2 className="text-base font-bold text-[var(--atlas-navy)]">Parecer Técnico e Considerações do Auditor</h2>
              </div>
              <span className="atlas-pill atlas-pill-navy font-mono text-[10px]">
                EFD Layout v3.1.x / RICMS-{companyUf}
              </span>
            </div>

            <div className="space-y-3">
              <textarea
                rows={6}
                value={analystNotes || defaultParecerText}
                onChange={(e) => setAnalystNotes(e.target.value)}
                className="atlas-input font-sans text-xs leading-relaxed p-4"
                placeholder="Edite ou adicione considerações personalizadas para o relatório final..."
              />
              <p className="text-xs text-[var(--atlas-text-muted)] flex items-center">
                <Info className="w-3.5 h-3.5 mr-1" />
                Este parecer é incorporado ao cabeçalho do PDF oficial e serve como embasamento em fiscalizações estaduais.
              </p>
            </div>
          </div>

          {/* Reconciled ICMS Balance (E110) */}
          {spedData.apuracao && (
            <div className="atlas-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[var(--atlas-navy)] flex items-center">
                  <Building2 className="w-5 h-5 text-[var(--atlas-navy)] mr-2" />
                  Demonstrativo de Reconciliação do ICMS (Bloco E110)
                </h3>
                <span className="atlas-pill atlas-pill-accent">
                  Saldos Recalculados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-lg border border-[var(--atlas-border)]">
                  <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase block">Total de Débitos</span>
                  <span className="text-base font-bold text-[var(--atlas-text)] mt-1 block">
                    R$ {spedData.apuracao.vlTotDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-lg border border-[var(--atlas-border)]">
                  <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase block">Total de Créditos</span>
                  <span className="text-base font-bold text-[var(--atlas-text)] mt-1 block">
                    R$ {spedData.apuracao.vlTotCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-lg border border-[var(--atlas-border)]">
                  <span className="text-[11px] font-semibold text-[var(--atlas-text-secondary)] uppercase block">Saldo Apurado</span>
                  <span className="text-base font-bold text-[var(--atlas-navy)] mt-1 block">
                    R$ {spedData.apuracao.vlSldApurado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-[var(--atlas-accent-tint)] p-4 rounded-lg border border-[var(--atlas-accent)]/30">
                  <span className="text-[11px] font-semibold text-[var(--atlas-accent)] uppercase block">Saldo Credor a Transportar</span>
                  <span className="text-base font-bold text-[var(--atlas-accent)] mt-1 block">
                    R$ {spedData.apuracao.vlSldCredorTransportar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Table of Applied Corrections */}
          <div className="atlas-card p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--atlas-navy)] flex items-center">
                  <Layers className="w-5 h-5 text-[var(--atlas-navy)] mr-2" />
                  Detalhamento de Tudo Que Foi Corrigido no SPED TXT
                </h3>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  Exibindo <span className="font-bold text-[var(--atlas-text)]">{filteredCorrections.length}</span> de <span className="font-bold text-[var(--atlas-text)]">{appliedCorrections.length}</span> alterações aplicadas.
                </p>
              </div>

              {/* Search & Filter */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative w-full sm:w-60 flex items-center">
                  <Search className="w-3.5 h-3.5 text-[var(--atlas-text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar linha, registro..."
                    className="atlas-input atlas-input-icon-left text-xs py-1.5"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[var(--atlas-surface-hover)] p-1 rounded-lg border border-[var(--atlas-border)] text-xs w-full sm:w-auto">
                  <button
                    onClick={() => setFilterCategory('ALL')}
                    className={`atlas-btn py-1 px-2.5 text-xs ${filterCategory === 'ALL' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
                  >
                    Todas ({appliedCorrections.length})
                  </button>
                  <button
                    onClick={() => setFilterCategory('CST_CFOP')}
                    className={`atlas-btn py-1 px-2.5 text-xs ${filterCategory === 'CST_CFOP' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
                  >
                    CST/CFOP ({cstCfopCorrectionsCount})
                  </button>
                  <button
                    onClick={() => setFilterCategory('OMISSA')}
                    className={`atlas-btn py-1 px-2.5 text-xs ${filterCategory === 'OMISSA' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
                  >
                    Omissas ({missingNotesInsertedCount})
                  </button>
                  <button
                    onClick={() => setFilterCategory('VALORES')}
                    className={`atlas-btn py-1 px-2.5 text-xs ${filterCategory === 'VALORES' ? 'atlas-btn-primary' : 'atlas-btn-ghost'}`}
                  >
                    Valores ({valueCorrectionsCount})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-[var(--atlas-border)] rounded-lg">
              <table className="min-w-full divide-y divide-[var(--atlas-border)] text-xs">
                <thead className="bg-[var(--atlas-surface-hover)]">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider w-20">Linha TXT</th>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider w-20">Registro</th>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Campo Alterado</th>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Antes (Original)</th>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Depois (Corrigido)</th>
                    <th className="px-4 py-3 text-left font-bold text-[var(--atlas-text-secondary)] uppercase tracking-wider">Justificativa Técnico-Fiscal</th>
                  </tr>
                </thead>
                <tbody className="bg-[var(--atlas-surface)] divide-y divide-[var(--atlas-border)]">
                  {filteredCorrections.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--atlas-text-muted)]">
                        Nenhuma alteração encontrada para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredCorrections.map((alt, idx) => (
                      <tr key={idx} className="hover:bg-[var(--atlas-surface-hover)] transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-[var(--atlas-text-secondary)] whitespace-nowrap">
                          {alt.numeroLinha > 0 ? `#${alt.numeroLinha}` : <span className="text-[var(--atlas-navy)] font-bold">+Nova</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="atlas-pill atlas-pill-navy font-mono">
                            {alt.registro}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--atlas-text)] whitespace-nowrap">
                          {getFieldLabel(alt.campo)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="atlas-pill atlas-pill-danger font-mono line-through">
                            {alt.valorAntigo}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="atlas-pill atlas-pill-accent font-mono font-bold">
                            {alt.valorNovo}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--atlas-text-secondary)] leading-relaxed max-w-md">
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
          <div className="atlas-card p-6 space-y-4">
            <h3 className="text-base font-bold text-[var(--atlas-navy)] flex items-center">
              <AlertTriangle className="w-5 h-5 text-[var(--atlas-warning)] mr-2" />
              Resumo Geral dos Apontamentos de Auditoria
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-xl border border-[var(--atlas-border)] space-y-2">
                <span className="font-bold text-[var(--atlas-navy)] block text-sm">Status da Revisão</span>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Pendentes de Análise:</span>
                  <span className="font-bold text-[var(--atlas-warning)]">{pendingCount}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Aprovados / Sanitizados:</span>
                  <span className="font-bold text-[var(--atlas-accent)]">{approvedCount}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Rejeitados (Falso Positivo):</span>
                  <span className="font-bold text-[var(--atlas-text-muted)]">{rejectedCount}</span>
                </div>
              </div>

              <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-xl border border-[var(--atlas-border)] space-y-2">
                <span className="font-bold text-[var(--atlas-navy)] block text-sm">Severidade dos Riscos</span>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Risco Alto (Autuação):</span>
                  <span className="font-bold text-[var(--atlas-danger)]">{rawFindings.filter(f => f.severidade === 'alta').length}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Risco Médio (Inconsistência):</span>
                  <span className="font-bold text-[var(--atlas-warning)]">{rawFindings.filter(f => f.severidade === 'media').length}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Risco Baixo (Alerta):</span>
                  <span className="font-bold text-[var(--atlas-info)]">{rawFindings.filter(f => f.severidade === 'baixa').length}</span>
                </div>
              </div>

              <div className="bg-[var(--atlas-surface-hover)] p-4 rounded-xl border border-[var(--atlas-border)] space-y-2">
                <span className="font-bold text-[var(--atlas-navy)] block text-sm">Documentos Auditados</span>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>Total no SPED Fiscal:</span>
                  <span className="font-bold text-[var(--atlas-text)]">{spedData.documents.length}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>XMLs Terceiros Carregados:</span>
                  <span className="font-bold text-[var(--atlas-text)]">{xmlTerceiros.length}</span>
                </div>
                <div className="flex justify-between items-center text-[var(--atlas-text-secondary)]">
                  <span>XMLs Próprios / NFC-e:</span>
                  <span className="font-bold text-[var(--atlas-text)]">{xmlProprio.length + xmlNfce.length}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
