import React, { useState, useMemo } from 'react';
import { Upload, FileCheck, ArrowRight, FileCode, Archive, FilePlus, AlertCircle, CheckCircle2, Sparkles, RefreshCw } from 'lucide-react';
import { SpedData, XmlRecord, XmlCategoria } from '../types';
import { parseSpedContent, parseXmlFiles } from '../lib/clientParser';
import { trackConferenciaEvent } from '../lib/tracking';

interface UploadSectionProps {
  onSpedLoaded: (data: SpedData) => void;
  onXmlTerceirosLoaded: (records: XmlRecord[]) => void;
  onXmlProprioLoaded: (records: XmlRecord[]) => void;
  onXmlNfceLoaded: (records: XmlRecord[]) => void;
  onClearSped?: () => void;
  onClearXmlTerceiros?: () => void;
  onClearXmlProprio?: () => void;
  onClearXmlNfce?: () => void;
  onGoToAudit: () => void;
  spedLoaded: boolean;
  xmlTerceirosCount: number;
  xmlProprioCount: number;
  xmlNfceCount: number;
  spedData?: SpedData | null;
  allXmlRecords?: XmlRecord[];
  onAppendXmlRecords?: (records: XmlRecord[]) => void;
}

const SAMPLE_SPED_CONTENT = `|0000|016|0|01012023|31012023|ATLAS COMERCIO DE COMBUSTIVEIS LTDA|12345678000199||SP|123456789|123456|3550308||3|1|
|0200|ITEM001|OLEO DIESEL S10|||L|01|27101921||27|18.00|
|0200|ITEM002|GASOLINA COMUM|||L|01|27101259||27|18.00|
|C100|0|1|FOR001|55|001|1|123|35230112345678000199550010000001231234567890|01012023|01012023|3500.00|0.00|3500.00|3500.00|630.00|0.00|0.00|0.00|0.00|
|C170|1|ITEM001|OLEO DIESEL S10|1000.00|L|1500.00|0.00|0|060|5102|VENDA DIESEL|1500.00|18.00|270.00|0.00|0.00|0.00|
|C170|2|ITEM002|GASOLINA COMUM|500.00|L|2000.00|0.00|0|000|1653|VENDA GASOLINA|2000.00|18.00|360.00|0.00|0.00|0.00|
|C190|060|5102|18.00|1500.00|1500.00|270.00|0.00|0.00|0.00|0.00|
|C190|000|1653|18.00|2000.00|2000.00|360.00|0.00|0.00|0.00|0.00|`;

function categoriaEsperada(zona: XmlCategoria, registro: XmlRecord): boolean {
  if (zona === 'XML_NFCE') return registro.mod === '65';
  if (zona === 'XML_PROPRIO') return registro.mod === '55';
  if (zona === 'XML_TERCEIROS') return registro.mod === '55';
  return true;
}

export function UploadSection({
  onSpedLoaded,
  onXmlTerceirosLoaded,
  onXmlProprioLoaded,
  onXmlNfceLoaded,
  onClearSped,
  onClearXmlTerceiros,
  onClearXmlProprio,
  onClearXmlNfce,
  onGoToAudit,
  spedLoaded,
  xmlTerceirosCount,
  xmlProprioCount,
  xmlNfceCount,
  spedData,
  allXmlRecords = [],
  onAppendXmlRecords
}: UploadSectionProps) {
  const [spedFileName, setSpedFileName] = useState<string | null>(spedLoaded ? 'Arquivo SPED Carregado' : null);
  const [loadingSped, setLoadingSped] = useState(false);
  const [spedProgress, setSpedProgress] = useState(0);
  const [spedStatusText, setSpedStatusText] = useState('');
  const [xmlLoadings, setXmlLoadings] = useState<Record<string, boolean>>({});
  const [xmlProgress, setXmlProgress] = useState<Record<string, { pct: number; text: string }>>({});
  const [loadingMissingXmls, setLoadingMissingXmls] = useState(false);
  const [missingXmlProgressText, setMissingXmlProgressText] = useState('');
  const [lastCapturedCount, setLastCapturedCount] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Documentos no SPED C100 sem XML correspondente
  const missingXmlDocs = useMemo(() => {
    if (!spedData || !spedData.documents) return [];
    const loadedKeys = new Set(allXmlRecords.map(x => (x.chvNfe || '').replace(/\D/g, '')));
    return spedData.documents.filter(d => {
      if (!d.chvNfe || d.chvNfe.length < 44) return false;
      const cleanChv = d.chvNfe.replace(/\D/g, '');
      return !loadedKeys.has(cleanChv);
    });
  }, [spedData, allXmlRecords]);

  const handleSpedUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSpedFileName(file.name);
    setLoadingSped(true);
    setSpedProgress(0);
    setSpedStatusText('Lendo arquivo SPED...');
    const startTime = Date.now();

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const result = await parseSpedContent(text, (pct, msg) => {
          setSpedProgress(pct);
          setSpedStatusText(msg);
        });
        const tempoSegundos = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        await trackConferenciaEvent({
          empresaNome: result.header.nome || 'Empresa SPED',
          arquivoNome: file.name,
          resumo: `Importação e auditoria de ${result.documents.length} documentos fiscais`,
          tempoSegundos
        });
        onSpedLoaded(result);
      } catch (err) {
        console.error('Error parsing SPED:', err);
        alert('Erro ao processar arquivo SPED.');
      } finally {
        setLoadingSped(false);
        setSpedProgress(0);
        setSpedStatusText('');
      }
    };
    reader.readAsText(file, 'ISO-8859-1');
  };

  const handleLoadSample = async () => {
    setSpedFileName('sped_demonstrativo.txt');
    setLoadingSped(true);
    setSpedProgress(0);
    setSpedStatusText('Carregando demonstrativo...');
    const startTime = Date.now();
    try {
      const result = await parseSpedContent(SAMPLE_SPED_CONTENT, (pct, msg) => {
        setSpedProgress(pct);
        setSpedStatusText(msg);
      });
      const tempoSegundos = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      await trackConferenciaEvent({
        empresaNome: result.header.nome || 'Demonstrativo SPED',
        arquivoNome: 'sped_demonstrativo.txt',
        resumo: `Demonstrativo carregado (${result.documents.length} documentos)`,
        tempoSegundos
      });
      onSpedLoaded(result);
    } catch (err) {
      console.error('Error loading sample SPED:', err);
    } finally {
      setLoadingSped(false);
      setSpedProgress(0);
      setSpedStatusText('');
    }
  };

  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>, zona: XmlCategoria) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setXmlLoadings(prev => ({ ...prev, [zona]: true }));
    setXmlProgress(prev => ({ ...prev, [zona]: { pct: 0, text: 'Iniciando importação...' } }));

    try {
      const records = await parseXmlFiles(Array.from(files), (pct: number, msg: string) => {
        setXmlProgress(prev => ({ ...prev, [zona]: { pct, text: msg } }));
      });
      
      let allMatch = true;
      let detectedCategory = '';

      for (const rec of records) {
        if (!categoriaEsperada(zona, rec)) {
          allMatch = false;
          if (rec.mod === '65') detectedCategory = 'NFC-e';
          else if (rec.mod === '55' && rec.tpNF === '1') detectedCategory = 'NF-e Próprio';
          else if (rec.mod === '55' && rec.tpNF === '0') detectedCategory = 'XML de Terceiros';
          else detectedCategory = 'Outro';
          break;
        }
      }

      if (!allMatch) {
        const proceed = window.confirm(`Algum dos arquivos selecionados parece ser ${detectedCategory}, não a categoria selecionada. Importar mesmo assim?`);
        if (!proceed) return;
      }

      if (zona === 'XML_TERCEIROS') onXmlTerceirosLoaded(records);
      else if (zona === 'XML_PROPRIO') onXmlProprioLoaded(records);
      else if (zona === 'XML_NFCE') onXmlNfceLoaded(records);
    } catch (err) {
      console.error('Error parsing XML/ZIP:', err);
      alert('Erro ao processar arquivos XML/ZIP.');
    } finally {
      setXmlLoadings(prev => ({ ...prev, [zona]: false }));
      if (e.target) e.target.value = '';
    }
  };

  // Upload específico para Captura de Notas Faltantes
  const handleMissingXmlsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoadingMissingXmls(true);
    setMissingXmlProgressText('Processando lote de notas faltantes...');

    try {
      const records = await parseXmlFiles(Array.from(files), (pct: number, msg: string) => {
        setMissingXmlProgressText(msg);
      });
      if (records.length === 0) {
        alert('Nenhum arquivo XML válido foi encontrado no lote selecionado.');
        return;
      }

      if (onAppendXmlRecords) {
        onAppendXmlRecords(records);
      } else {
        onXmlTerceirosLoaded(records);
      }

      setLastCapturedCount(records.length);
      setShowSuccessModal(true);
    } catch (err) {
      console.error('Erro ao processar XMLs faltantes:', err);
      alert('Erro ao processar o lote de notas faltantes.');
    } finally {
      setLoadingMissingXmls(false);
      setMissingXmlProgressText('');
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-16 text-xs font-sans">
      {/* Breadcrumb Bar */}
      <div className="atlas-breadcrumb-bar">
        <div className="flex items-center space-x-2 text-[13px]">
          <span className="text-[var(--atlas-text-muted)] font-medium">Atlas</span>
          <span className="text-[var(--atlas-text-muted)]">/</span>
          <span className="text-[var(--atlas-text)] font-semibold">Central de Importação</span>
        </div>
        <div className="text-[12px] text-[var(--atlas-text-secondary)] font-medium">
          Carregamento de SPED e Lotes de XML
        </div>
      </div>

      <div className="px-6 space-y-6 max-w-6xl mx-auto">
        {/* Header Banner */}
        <div className="text-center max-w-2xl mx-auto space-y-1.5 pt-2">
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--atlas-text)] font-serif tracking-tight">
            Central de Importação Fiscal
          </h1>
          <p className="text-sm text-[var(--atlas-text-secondary)] leading-relaxed">
            Importe seu arquivo SPED Fiscal (.txt), XMLs de NF-e/NFC-e e reponha notas faltantes para auditoria em tempo real.
          </p>
        </div>

        {/* SEÇÃO COMPACTA: Captura de Notas Faltantes e Omissas */}
        <div className="atlas-card p-4 space-y-3 bg-[var(--atlas-warning-bg)] border-[var(--atlas-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-100 text-[var(--atlas-warning)] rounded-xl shrink-0">
                <FilePlus className="w-5 h-5 text-[var(--atlas-warning)]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm font-bold text-[var(--atlas-text)] font-serif">Captura de XMLs de Notas Faltantes</h2>
                  {spedData && missingXmlDocs.length > 0 && (
                    <span className="atlas-pill atlas-pill-warning">
                      {missingXmlDocs.length} nota(s) pendente(s)
                    </span>
                  )}
                  {spedData && missingXmlDocs.length === 0 && (
                    <span className="atlas-pill atlas-pill-accent">
                      0 pendências
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  Importe lotes de XMLs/ZIPs capturados para complementar o SPED sem sobrescrever arquivos já carregados.
                </p>
              </div>
            </div>

            <div className="shrink-0 self-end sm:self-auto">
              <label className="atlas-btn atlas-btn-warning px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{loadingMissingXmls ? 'Lendo...' : 'Capturar Notas Faltantes (.xml / .zip)'}</span>
                <input
                  type="file"
                  accept=".xml,.zip"
                  multiple
                  onChange={handleMissingXmlsUpload}
                  disabled={loadingMissingXmls}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* LISTA DE IMPORTAÇÕES REGULARES (Layout Horizontal usando atlas-list-row num único atlas-card) */}
        <div className="atlas-card p-0 overflow-hidden">
          <div className="p-4 bg-[var(--atlas-navy-tint)] border-b border-[var(--atlas-border)] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--atlas-navy)] font-serif flex items-center space-x-2">
              <Archive className="w-4 h-4 text-[var(--atlas-navy)]" />
              <span>Arquivos para Auditoria Fiscal</span>
            </h2>
            <button
              onClick={handleLoadSample}
              className="atlas-btn atlas-btn-secondary px-3 py-1 text-xs"
            >
              <FileCode className="w-3.5 h-3.5 text-[var(--atlas-navy)]" />
              <span>Carregar Arquivo Exemplo</span>
            </button>
          </div>

          {/* LINHA 1: SPED Fiscal */}
          <div className="atlas-list-row flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] flex items-center justify-center shrink-0">
                <FileCode className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[var(--atlas-text)] font-serif">SPED Fiscal (.txt)</h3>
                  {spedLoaded && <span className="atlas-pill atlas-pill-accent">Pronto</span>}
                </div>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  {spedLoaded 
                    ? `Arquivo: ${spedFileName || 'SPED Carregado'}` 
                    : 'Arquivo texto da EFD ICMS/IPI com registros do Bloco C, H e 0000'}
                </p>
                {loadingSped && (
                  <div className="mt-2 text-xs font-semibold text-[var(--atlas-navy)] flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{spedStatusText} ({spedProgress}%)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
              {spedLoaded ? (
                <>
                  {onClearSped && (
                    <button
                      onClick={() => { setSpedFileName(null); onClearSped(); }}
                      className="atlas-btn atlas-btn-danger px-3 py-1.5 text-xs"
                    >
                      Remover
                    </button>
                  )}
                  <button
                    onClick={onGoToAudit}
                    className="atlas-btn atlas-btn-accent px-4 py-2 text-xs"
                  >
                    <span>Ir para Auditoria</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <label className="atlas-btn atlas-btn-primary px-4 py-2 text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Selecionar SPED .txt</span>
                  <input type="file" accept=".txt" onChange={handleSpedUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* LINHA 2: XML de Terceiros */}
          <div className="atlas-list-row flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[var(--atlas-text)] font-serif">XML de Terceiros (Entradas)</h3>
                  {xmlTerceirosCount > 0 && <span className="atlas-pill atlas-pill-accent">{xmlTerceirosCount} arquivos</span>}
                </div>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  NF-e Mod 55 recebidas de fornecedores em lote .xml ou arquivo .zip
                </p>
                {xmlLoadings['XML_TERCEIROS'] && (
                  <div className="mt-2 text-xs font-semibold text-[var(--atlas-accent)] flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{xmlProgress['XML_TERCEIROS']?.text || 'Importando...'} ({xmlProgress['XML_TERCEIROS']?.pct || 0}%)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
              {xmlTerceirosCount > 0 && onClearXmlTerceiros && (
                <button
                  onClick={onClearXmlTerceiros}
                  className="atlas-btn atlas-btn-danger px-3 py-1.5 text-xs"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-accent px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{xmlTerceirosCount > 0 ? 'Adicionar Mais XMLs' : 'Importar XMLs Terceiros'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_TERCEIROS')} className="hidden" />
              </label>
            </div>
          </div>

          {/* LINHA 3: XML Próprio */}
          <div className="atlas-list-row flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[var(--atlas-text)] font-serif">NF-e Próprio (Saídas)</h3>
                  {xmlProprioCount > 0 && <span className="atlas-pill atlas-pill-navy">{xmlProprioCount} arquivos</span>}
                </div>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  NF-e Mod 55 emitidas pela própria empresa em lote .xml ou arquivo .zip
                </p>
                {xmlLoadings['XML_PROPRIO'] && (
                  <div className="mt-2 text-xs font-semibold text-[var(--atlas-navy)] flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Lendo arquivos...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
              {xmlProprioCount > 0 && onClearXmlProprio && (
                <button
                  onClick={onClearXmlProprio}
                  className="atlas-btn atlas-btn-danger px-3 py-1.5 text-xs"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-secondary px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[var(--atlas-navy)]" />
                <span>{xmlProprioCount > 0 ? 'Adicionar Mais XMLs' : 'Importar NF-e Próprio'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_PROPRIO')} className="hidden" />
              </label>
            </div>
          </div>

          {/* LINHA 4: XML NFC-e */}
          <div className="atlas-list-row flex flex-col md:flex-row md:items-center justify-between gap-4 p-5">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-[var(--atlas-info-tint)] text-[var(--atlas-info)] flex items-center justify-center shrink-0">
                <Archive className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-[var(--atlas-text)] font-serif">NFC-e (Mod 65)</h3>
                  {xmlNfceCount > 0 && <span className="atlas-pill atlas-pill-info">{xmlNfceCount} arquivos</span>}
                </div>
                <p className="text-xs text-[var(--atlas-text-secondary)] mt-0.5">
                  Notas Fiscais de Consumidor Eletrônicas em lote .xml ou arquivo .zip
                </p>
                {xmlLoadings['XML_NFCE'] && (
                  <div className="mt-2 text-xs font-semibold text-[var(--atlas-info)] flex items-center space-x-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Lendo NFC-e...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 self-end md:self-auto">
              {xmlNfceCount > 0 && onClearXmlNfce && (
                <button
                  onClick={onClearXmlNfce}
                  className="atlas-btn atlas-btn-danger px-3 py-1.5 text-xs"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-secondary px-4 py-2 text-xs cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[var(--atlas-info)]" />
                <span>{xmlNfceCount > 0 ? 'Adicionar Mais NFC-e' : 'Importar NFC-e'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_NFCE')} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE SUCESSO DE CAPTURA */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-[var(--atlas-border)] text-center">
            <div className="w-16 h-16 bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[var(--atlas-text)] font-serif">Captura Realizada com Sucesso!</h3>
              <p className="text-xs text-[var(--atlas-text-secondary)]">
                Foram capturados e integrados <strong className="text-[var(--atlas-accent)] font-extrabold">{lastCapturedCount} novo(s) arquivo(s) XML</strong> à base de conferência.
              </p>
            </div>

            {spedData && (
              <div className="bg-[var(--atlas-bg)] rounded-xl p-3 text-xs text-[var(--atlas-text-secondary)] border border-[var(--atlas-border)] text-left space-y-1">
                <p className="font-bold text-[var(--atlas-text)] font-serif">Status Atualizado do Confronto:</p>
                <p className="text-[var(--atlas-text-secondary)]">
                  {missingXmlDocs.length > 0 
                    ? `Restam ainda ${missingXmlDocs.length} nota(s) faltantes no SPED C100 aguardando XML.` 
                    : '🎉 Todas as notas do SPED C100 agora possuem XMLs correspondentes localizados!'}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="atlas-btn atlas-btn-secondary flex-1 py-2.5 px-4 text-xs font-bold"
              >
                Continuar Importando
              </button>
              <button
                onClick={() => { setShowSuccessModal(false); onGoToAudit(); }}
                className="atlas-btn atlas-btn-accent flex-1 py-2.5 px-4 text-xs font-bold"
              >
                <span>Ir para Auditoria</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

