import React, { useState, useEffect } from 'react';
import { PeriodoAcumulado, DecisaoNotaOmissa, Achado, XmlRecord } from '../types';
import { db, EmpresaOmissa } from '../lib/db';
import { Upload, FileCheck, Search, Filter, CheckCircle2, XCircle, Clock, Download, FileText, Printer, Trash2, AlertTriangle, ShieldCheck, Plus, Building2, ChevronDown } from 'lucide-react';
import { parseSpedContent, parseXmlFiles } from '../lib/clientParser';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function NotasOmissasView() {
  const [empresas, setEmpresas] = useState<EmpresaOmissa[]>([]);
  const [selectedCnpj, setSelectedCnpj] = useState<string>('');
  const [showNewEmpresaModal, setShowNewEmpresaModal] = useState(false);

  // New company form state
  const [newCnpj, setNewCnpj] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newUf, setNewUf] = useState('SP');
  const [newRegime, setNewRegime] = useState('Lucro Real');

  const [periodos, setPeriodos] = useState<PeriodoAcumulado[]>([]);
  const [decisoes, setDecisoes] = useState<DecisaoNotaOmissa[]>([]);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Bulk selection state
  const [selectedNotas, setSelectedNotas] = useState<string[]>([]);

  // Date range state for historical load
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const allEmpresas = await db.empresasOmissas.toArray();
      setEmpresas(allEmpresas);
      const allDecisoes = await db.decisoes.toArray();
      setDecisoes(allDecisoes);

      if (allEmpresas.length > 0) {
        if (!selectedCnpj || !allEmpresas.some(e => e.cnpj === selectedCnpj)) {
          setSelectedCnpj(allEmpresas[0].cnpj);
          await loadPeriodosForCompany(allEmpresas[0].cnpj, allDecisoes);
        } else {
          await loadPeriodosForCompany(selectedCnpj, allDecisoes);
        }
      } else {
        // Default sample company if none exists
        const defaultEmpresa: EmpresaOmissa = {
          cnpj: '12345678000199',
          nome: 'Empresa Exemplo Auditoria Ltda',
          uf: 'SP',
          regime: 'Lucro Real'
        };
        await db.empresasOmissas.put(defaultEmpresa);
        setEmpresas([defaultEmpresa]);
        setSelectedCnpj(defaultEmpresa.cnpj);
        await loadPeriodosForCompany(defaultEmpresa.cnpj, allDecisoes);
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
    }
  };

  const loadPeriodosForCompany = async (cnpj: string, allDecisoes: DecisaoNotaOmissa[]) => {
    const allPeriodos = await db.periodos.toArray();
    // Filter periods belonging to this company (id starts with cnpj_)
    const companyPeriodos = allPeriodos.filter(p => p.id.startsWith(`${cnpj}_`) || (!p.id.includes('_') && empresas.length <= 1));
    setPeriodos(companyPeriodos.sort((a, b) => a.id.localeCompare(b.id)));
    processarAchados(companyPeriodos, allDecisoes);
  };

  const handleSelectCompany = async (cnpj: string) => {
    setSelectedCnpj(cnpj);
    setSelectedNotas([]);
    const allDecisoes = await db.decisoes.toArray();
    await loadPeriodosForCompany(cnpj, allDecisoes);
  };

  const toggleSelectAll = () => {
    if (selectedNotas.length === achados.length) {
      setSelectedNotas([]);
    } else {
      setSelectedNotas(achados.map(a => a.docId));
    }
  };

  const toggleSelectNota = (docId: string) => {
    setSelectedNotas(prev => 
      prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
    );
  };

  const removerNotasEmLote = async () => {
    if (selectedNotas.length === 0) return;
    if (!confirm(`Deseja realmente remover permanentemente ${selectedNotas.length} nota(s) fiscal(is) selecionada(s)?`)) return;
    
    setLoading(true);
    try {
      const chavesSet = new Set(selectedNotas.map(c => normalizarChave(c)));
      const todosPeriodos = await db.periodos.toArray();
      
      for (const p of todosPeriodos) {
        if (!p.id.startsWith(`${selectedCnpj}_`) && !p.id.includes('_')) continue;
        const xmlsFiltrados = p.xmlTerceiros.filter(x => !chavesSet.has(normalizarChave(x.chvNfe)));
        if (xmlsFiltrados.length !== p.xmlTerceiros.length) {
          await db.periodos.put({
            ...p,
            xmlTerceiros: xmlsFiltrados
          });
        }
      }

      for (const chv of selectedNotas) {
        await db.decisoes.delete(chv);
      }

      setSelectedNotas([]);
      const allDecisoes = await db.decisoes.toArray();
      setDecisoes(allDecisoes);
      await loadPeriodosForCompany(selectedCnpj, allDecisoes);
    } catch (err) {
      console.error('Erro ao remover notas em lote:', err);
      alert('Erro ao remover notas em lote.');
    }
    setLoading(false);
  };

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCnpj || !newNome) {
      alert('Preencha o CNPJ e a Razão Social.');
      return;
    }
    const cleanCnpj = newCnpj.replace(/\D/g, '');
    const nova: EmpresaOmissa = {
      cnpj: cleanCnpj,
      nome: newNome,
      uf: newUf,
      regime: newRegime
    };
    await db.empresasOmissas.put(nova);
    setEmpresas(prev => [...prev.filter(p => p.cnpj !== cleanCnpj), nova]);
    setSelectedCnpj(cleanCnpj);
    setShowNewEmpresaModal(false);
    setNewCnpj('');
    setNewNome('');
    await loadPeriodosForCompany(cleanCnpj, decisoes);
  };

  const currentEmpresa = empresas.find(e => e.cnpj === selectedCnpj) || {
    cnpj: selectedCnpj || '00000000000000',
    nome: 'Empresa Selecionada',
    uf: 'SP',
    regime: 'Lucro Real'
  };

  const extrairMesAno = (dateString: string) => {
    if (dateString.includes('T')) {
      return dateString.substring(0, 7); // "YYYY-MM"
    }
    const parts = dateString.split(/[-/]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1]}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1]}`;
    }
    return '';
  };

  const normalizarChave = (chv: string) => chv.replace(/\D/g, '');

  const processarAchados = (periodosAcumulados: PeriodoAcumulado[], decisoesAcumuladas: DecisaoNotaOmissa[]) => {
    const chavesNoSped = new Set(
      periodosAcumulados.flatMap(p =>
        p.spedData?.documents.filter(d => d.indOper === '0').map(d => normalizarChave(d.chvNfe || (d as any).id)) ?? []
      )
    );
    const mesesComBuraco = new Set(periodosAcumulados.filter(p => !p.temSped).map(p => p.id.split('_').pop() || p.id));
    const decisaoPorChave = new Map(decisoesAcumuladas.map(d => [d.chvNfe, d]));

    const novosAchados: Achado[] = [];
    for (const p of periodosAcumulados) {
      for (const xml of p.xmlTerceiros) {
        const chave = normalizarChave(xml.chvNfe);
        if (chavesNoSped.has(chave)) continue;

        const decisao = decisaoPorChave.get(chave);
        if (decisao && decisao.decisao !== 'pendente') continue;

        const mesDoXml = extrairMesAno(xml.dhEmi);
        const ehBuraco = mesesComBuraco.has(mesDoXml);
        novosAchados.push({
          id: chave,
          tipo: ehBuraco ? 'NOTA_EM_MES_SEM_SPED' : 'NOTA_ENTRADA_NAO_ESCRITURADA',
          severidade: ehBuraco ? 'baixa' : 'alta',
          titulo: ehBuraco
            ? 'Nota em mês sem SPED importado — não dá para confirmar se está lançada'
            : 'Nota de entrada não escriturada em nenhum período acumulado',
          docId: chave, 
          numDoc: xml.nNF, 
          serie: xml.serie,
          descricao: `${xml.emitNome} (${xml.emitCnpj}) — R$ ${xml.vNF.toFixed(2)}, emitida em ${xml.dhEmi}`,
          statusRevisao: 'pendente'
        } as Achado);
      }
    }
    setAchados(novosAchados);
  };

  const handleUploadMultipleSpeds = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);

    try {
      for (const file of files) {
        const content = await file.text();
        const spedData = await parseSpedContent(content);
        if (!spedData) continue;

        const dtIni = spedData.header.dtIni; // DDMMYYYY
        const mesAno = `${dtIni.substring(4, 8)}-${dtIni.substring(2, 4)}`;
        const periodId = `${selectedCnpj}_${mesAno}`;
        const ano = parseInt(dtIni.substring(4, 8));
        const mes = parseInt(dtIni.substring(2, 4));

        const existente = await db.periodos.get(periodId);
        
        await db.periodos.put({
          id: periodId,
          ano,
          mes,
          temSped: true,
          spedData,
          xmlTerceiros: existente ? existente.xmlTerceiros : []
        });
      }
      await loadPeriodosForCompany(selectedCnpj, decisoes);
    } catch (err) {
      console.error(err);
      alert('Erro ao importar SPEDs.');
    }
    setLoading(false);
  };

  const handleUploadMultipleXmls = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setLoading(true);

    try {
      const records = await parseXmlFiles(files);
      const xmlsByPeriod = new Map<string, XmlRecord[]>();
      
      for (const xml of records) {
        if (xml.mod !== '55') continue;
        const mesAno = extrairMesAno(xml.dhEmi);
        if (!mesAno) continue;
        
        if (!xmlsByPeriod.has(mesAno)) xmlsByPeriod.set(mesAno, []);
        xmlsByPeriod.get(mesAno)!.push(xml);
      }

      for (const [mesAno, xmls] of xmlsByPeriod.entries()) {
        const periodId = `${selectedCnpj}_${mesAno}`;
        const existente = await db.periodos.get(periodId);
        
        if (existente) {
          const mergedXmls = [...existente.xmlTerceiros];
          const chavesExistentes = new Set(mergedXmls.map(x => normalizarChave(x.chvNfe)));
          
          for (const xml of xmls) {
            const chv = normalizarChave(xml.chvNfe);
            if (!chavesExistentes.has(chv)) {
              mergedXmls.push(xml);
            }
          }
          await db.periodos.put({
            ...existente,
            xmlTerceiros: mergedXmls
          });
        } else {
          const parts = mesAno.split('-');
          await db.periodos.put({
            id: periodId,
            ano: parseInt(parts[0]),
            mes: parseInt(parts[1]),
            temSped: false,
            spedData: null,
            xmlTerceiros: xmls
          });
        }
      }
      
      await loadPeriodosForCompany(selectedCnpj, decisoes);
    } catch (err) {
      console.error(err);
      alert('Erro ao importar XMLs.');
    }
    setLoading(false);
  };

  const registrarDecisao = async (chvNfe: string, decisao: DecisaoNotaOmissa['decisao'], justificativa: string = '') => {
    const chave = normalizarChave(chvNfe);
    await db.decisoes.put({
      chvNfe: chave,
      decisao,
      justificativa,
      decididoEm: new Date().toISOString()
    });
    const allDecisoes = await db.decisoes.toArray();
    setDecisoes(allDecisoes);
    await loadPeriodosForCompany(selectedCnpj, allDecisoes);
  };

  const removerNotaOmissa = async (chvNfe: string) => {
    if (!confirm('Deseja realmente remover permanentemente esta nota fiscal da análise de omissas?')) return;
    setLoading(true);
    try {
      const chaveNorm = normalizarChave(chvNfe);
      const todosPeriodos = await db.periodos.toArray();
      for (const p of todosPeriodos) {
        if (!p.id.startsWith(`${selectedCnpj}_`)) continue;
        const xmlsFiltrados = p.xmlTerceiros.filter(x => normalizarChave(x.chvNfe) !== chaveNorm);
        if (xmlsFiltrados.length !== p.xmlTerceiros.length) {
          await db.periodos.put({
            ...p,
            xmlTerceiros: xmlsFiltrados
          });
        }
      }
      await db.decisoes.delete(chvNfe);
      const allDecisoes = await db.decisoes.toArray();
      setDecisoes(allDecisoes);
      await loadPeriodosForCompany(selectedCnpj, allDecisoes);
    } catch (err) {
      console.error('Erro ao remover nota:', err);
      alert('Erro ao remover nota omissa.');
    }
    setLoading(false);
  };

  const handleGerarIntervalo = async () => {
    if (!dataInicio || !dataFim) return;
    
    let atual = new Date(`${dataInicio}-01T00:00:00`);
    const fim = new Date(`${dataFim}-01T00:00:00`);
    
    setLoading(true);
    while (atual <= fim) {
      const mesAno = `${atual.getFullYear()}-${String(atual.getMonth() + 1).padStart(2, '0')}`;
      const periodId = `${selectedCnpj}_${mesAno}`;
      const existente = await db.periodos.get(periodId);
      
      if (!existente) {
        await db.periodos.put({
          id: periodId,
          ano: atual.getFullYear(),
          mes: atual.getMonth() + 1,
          temSped: false,
          spedData: null,
          xmlTerceiros: []
        });
      }
      atual.setMonth(atual.getMonth() + 1);
    }
    await loadPeriodosForCompany(selectedCnpj, decisoes);
    setLoading(false);
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica');
      
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138);
      doc.text('Relatório de Auditoria de Notas Omissas', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text(`Empresa: ${currentEmpresa.nome} (CNPJ: ${currentEmpresa.cnpj})`, 14, 28);
      doc.text(`Regime: ${currentEmpresa.regime} | UF: ${currentEmpresa.uf}`, 14, 34);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 40);
      
      let cursorY = 48;

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Resumo Executivo', 14, cursorY);
      cursorY += 8;

      const omitidas = achados.filter(a => a.tipo === 'NOTA_ENTRADA_NAO_ESCRITURADA').length;
      const buracos = achados.filter(a => a.tipo === 'NOTA_EM_MES_SEM_SPED').length;

      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text(`Total de Notas Pendentes: ${achados.length}`, 14, cursorY);
      cursorY += 6;
      doc.text(`Notas Omissas Confirmadas: ${omitidas}`, 14, cursorY);
      doc.text(`Notas em Meses sem SPED: ${buracos}`, 90, cursorY);
      cursorY += 12;

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text('Detalhamento das Notas Omissas', 14, cursorY);
      
      const tableData = achados.map(f => [
        f.docId || f.numDoc,
        f.tipo === 'NOTA_EM_MES_SEM_SPED' ? 'Buraco (Sem SPED)' : 'Omissa',
        f.descricao
      ]);

      autoTable(doc, {
        startY: cursorY + 6,
        head: [['Chave/Documento', 'Status', 'Descrição']],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 35 },
          2: { cellWidth: 'auto' }
        }
      });

      doc.save(`relatorio_omissas_${currentEmpresa.cnpj}.pdf`);
    } catch (e) {
      console.error('Error generating PDF', e);
      alert('Erro ao gerar PDF');
    }
  };

  const omitidasCount = achados.filter(a => a.tipo === 'NOTA_ENTRADA_NAO_ESCRITURADA').length;
  const buracosCount = achados.filter(a => a.tipo === 'NOTA_EM_MES_SEM_SPED').length;

  return (
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Top Company Selector Bar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="p-2.5 bg-blue-50 text-[#1e3a5f] rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Painel Multivagas / Outras Empresas</span>
            <div className="flex items-center space-x-2 mt-0.5">
              <select
                value={selectedCnpj}
                onChange={e => handleSelectCompany(e.target.value)}
                className="text-base font-bold text-slate-900 border-none bg-transparent focus:ring-0 cursor-pointer pr-8"
              >
                {empresas.map(emp => (
                  <option key={emp.cnpj} value={emp.cnpj}>
                    {emp.nome} — CNPJ: {emp.cnpj}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowNewEmpresaModal(true)}
          className="flex items-center space-x-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-xs w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Outra Empresa</span>
        </button>
      </div>

      {/* Professional Header Banner */}
      <div className="bg-slate-900 rounded-xl p-6 sm:p-8 text-white shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Auditoria de Notas Omissas e Terceiros</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {currentEmpresa.nome}
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              CNPJ: <span className="font-mono font-bold text-white">{currentEmpresa.cnpj}</span> | Regime: <span className="font-bold text-white">{currentEmpresa.regime}</span> | UF: <span className="font-bold text-white">{currentEmpresa.uf}</span>
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
              onClick={generatePDF}
              disabled={achados.length === 0}
              className="flex items-center space-x-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Exportar PDF (Oficial)</span>
            </button>
          </div>
        </div>

        {/* Company Meta Header Bar */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Períodos Acumulados</span>
            <span className="font-bold text-slate-100 block">{periodos.length} Meses Carregados</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Notas Pendentes</span>
            <span className="font-bold text-amber-400 block">{achados.length} Notas Identificadas</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Omissas Confirmadas</span>
            <span className="font-bold text-red-400 block">{omitidasCount} Notas</span>
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Meses sem SPED (Buracos)</span>
            <span className="font-bold text-slate-200 block">{buracosCount} Períodos</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-xl flex items-center space-x-2">
          <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <span>Processando arquivos e cruzando dados...</span>
        </div>
      )}

      {/* Carga de Períodos e Arquivos (No Print) */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 no-print">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
          <Upload className="w-5 h-5 mr-2 text-[#1e3a5f]" />
          Carga de Períodos & Arquivos para {currentEmpresa.nome}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-3 border-r border-slate-100 pr-6">
            <label className="block text-sm font-medium text-slate-700">1. Definir Intervalo Histórico</label>
            <div className="flex space-x-2">
              <input 
                type="month" 
                value={dataInicio} 
                onChange={e => setDataInicio(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg p-2 bg-slate-50 border"
              />
              <input 
                type="month" 
                value={dataFim} 
                onChange={e => setDataFim(e.target.value)}
                className="w-full text-sm border-slate-300 rounded-lg p-2 bg-slate-50 border"
              />
            </div>
            <button 
              onClick={handleGerarIntervalo}
              disabled={!dataInicio || !dataFim}
              className="w-full bg-slate-800 text-white px-4 py-2 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-50 font-medium"
            >
              Criar Períodos em Branco
            </button>
          </div>

          <div className="space-y-3 border-r border-slate-100 pr-6">
            <label className="block text-sm font-medium text-slate-700">2. Importar SPEDs (Múltiplos)</label>
            <input 
              type="file" 
              multiple 
              accept=".txt"
              onChange={handleUploadMultipleSpeds}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#f1efe8] file:text-[#1e3a5f] hover:file:bg-[#e5e2d9] border border-slate-200 rounded-lg p-1"
            />
            <p className="text-xs text-slate-500">O sistema alocará cada arquivo ao mês correto.</p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">3. Importar XMLs (Múltiplos)</label>
            <input 
              type="file" 
              multiple 
              accept=".xml"
              onChange={handleUploadMultipleXmls}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[#f1efe8] file:text-[#1e3a5f] hover:file:bg-[#e5e2d9] border border-slate-200 rounded-lg p-1"
            />
            <p className="text-xs text-slate-500">Notas serão vinculadas ao mês de emissão.</p>
          </div>
        </div>
      </div>

      {/* Lista de Achados / Notas Omissas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center">
            <Search className="w-5 h-5 mr-2 text-[#1e3a5f]" />
            Notas Omissas Encontradas ({achados.length})
          </h3>
          <span className="text-xs text-slate-500">Listagem oficial pronta para conferência e remoção</span>
        </div>
        
        {achados.length === 0 ? (
          <div className="bg-white p-12 rounded-lg border border-slate-200 text-center shadow-xs">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhuma nota omissa pendente para {currentEmpresa.nome}</h3>
            <p className="text-slate-500 mt-2">Todas as notas importadas estão escrituradas ou justificadas.</p>
          </div>
        ) : (
          <>
            {/* Bulk Selection Bar */}
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs no-print">
              <label className="flex items-center space-x-2.5 text-sm font-semibold text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={selectedNotas.length === achados.length && achados.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-[#1e3a5f] rounded border-slate-300 focus:ring-blue-500"
                />
                <span>Selecionar Todas ({selectedNotas.length} de {achados.length} selecionadas)</span>
              </label>

              {selectedNotas.length > 0 && (
                <button
                  onClick={removerNotasEmLote}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold shadow-xs transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remover Selecionadas ({selectedNotas.length})</span>
                </button>
              )}
            </div>

            {achados.map(achado => (
              <div key={achado.id} className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-start space-x-3.5 flex-1">
                  <input 
                    type="checkbox"
                    checked={selectedNotas.includes(achado.docId)}
                    onChange={() => toggleSelectNota(achado.docId)}
                    className="mt-1.5 w-4 h-4 text-[#1e3a5f] rounded border-slate-300 focus:ring-blue-500 no-print flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase ${achado.tipo === 'NOTA_EM_MES_SEM_SPED' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                        {achado.tipo === 'NOTA_EM_MES_SEM_SPED' ? 'Buraco (Sem SPED)' : 'Omissa'}
                      </span>
                      <span className="text-sm font-semibold text-slate-700">Chave: {achado.docId}</span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900">{achado.titulo}</h4>
                    <p className="text-sm text-slate-600 mt-1">{achado.descricao}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto no-print">
                  <button 
                    onClick={() => registrarDecisao(achado.docId, 'lancada_retroativo')}
                    className="px-3.5 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors"
                  >
                    Marcar Lançada
                  </button>
                  <button 
                    onClick={() => {
                      const just = prompt('Justificativa para ignorar (ex: Nota Cancelada, Fora de Escopo):');
                      if (just !== null) registrarDecisao(achado.docId, 'ignorada_justificada', just);
                    }}
                    className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ignorar
                  </button>
                  <button 
                    onClick={() => removerNotaOmissa(achado.docId)}
                    className="flex items-center space-x-1 px-3.5 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                    title="Remover Nota Omissa"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Modal Nova Empresa */}
      {showNewEmpresaModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 flex items-center">
                <Building2 className="w-5 h-5 mr-2 text-[#1e3a5f]" />
                Cadastrar Outra Empresa para Auditoria
              </h3>
              <button 
                onClick={() => setShowNewEmpresaModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEmpresa} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">CNPJ</label>
                <input 
                  type="text" 
                  placeholder="00.000.000/0001-00" 
                  value={newCnpj}
                  onChange={e => setNewCnpj(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Razão Social / Nome da Empresa</label>
                <input 
                  type="text" 
                  placeholder="Ex: Filial Sul Comércio Ltda" 
                  value={newNome}
                  onChange={e => setNewNome(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">UF</label>
                  <select 
                    value={newUf} 
                    onChange={e => setNewUf(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  >
                    {['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'GO', 'DF', 'ES', 'PE', 'CE', 'PA', 'AM', 'MT', 'MS', 'MA', 'PB', 'RN', 'PI', 'AL', 'SE', 'TO', 'RO', 'AC', 'AP', 'RR'].map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Regime Tributário</label>
                  <select 
                    value={newRegime} 
                    onChange={e => setNewRegime(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-lg p-2.5 bg-slate-50"
                  >
                    <option value="Lucro Real">Lucro Real</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewEmpresaModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg text-sm font-semibold shadow-xs"
                >
                  Salvar Empresa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
