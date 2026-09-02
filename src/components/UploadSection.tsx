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
    <div className="max-w-7xl w-full mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Central de Importação Fiscal</h1>
        <p className="text-base text-slate-500">
          Importe seu arquivo SPED Fiscal (.txt), XMLs de NF-e/NFC-e e reponha notas faltantes para auditoria em tempo real.
        </p>
      </div>

      {/* SEÇÃO COMPACTA E DISCRETA: Captura de Notas Faltantes e Omissas */}
      <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
              <FilePlus className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-bold text-slate-900">Captura de XMLs de Notas Faltantes</h2>
                {spedData && missingXmlDocs.length > 0 && (
                  <span className="bg-amber-200 text-amber-900 font-extrabold text-[11px] px-2 py-0.5 rounded-md border border-amber-300/60">
                    {missingXmlDocs.length} nota(s) pendente(s)
                  </span>
                )}
                {spedData && missingXmlDocs.length === 0 && (
                  <span className="bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2 py-0.5 rounded-md border border-emerald-200">
                    0 pendências
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Importe lotes de XMLs/ZIPs capturados para complementar o SPED sem sobrescrever arquivos já carregados.
              </p>
            </div>
          </div>

          <div className="shrink-0 self-end sm:self-auto">
            <label className="inline-flex items-center justify-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer shadow-2xs transition-colors">
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

      {/* QUADRO DE IMPORTAÇÕES REGULARES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ZONA: SPED Fiscal */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-slate-100 text-[#1e3a5f] p-4 rounded-lg">
                <FileCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">SPED Fiscal</h3>
                <p className="text-sm text-slate-500">Arquivo .txt ICMS/IPI</p>
              </div>
            </div>
            {loadingSped && (
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-blue-900">
                  <span className="truncate">{spedStatusText || 'Processando SPED...'}</span>
                  <span>{spedProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${spedProgress}%` }}></div>
                </div>
              </div>
            )}
            {spedLoaded ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-900 text-sm font-medium truncate">
                  <FileCheck className="w-5 h-5 text-[#0f6e56] shrink-0" />
                  <span className="truncate">{spedFileName || 'SPED Carregado'}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-semibold">Pronto</span>
                  {onClearSped && (
                    <button
                      onClick={() => { setSpedFileName(null); onClearSped(); }}
                      className="text-xs text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded shadow-xs"
                      title="Excluir importação"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center mb-4 hover:border-slate-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium mb-1">Selecione o SPED .txt</p>
                <label className="inline-block mt-2 bg-[#1e3a5f] text-white text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#142c47] font-medium shadow-xs">
                  Procurar Arquivo
                  <input type="file" accept=".txt" onChange={handleSpedUpload} className="hidden" />
                </label>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleLoadSample}
              className="flex items-center space-x-1.5 text-xs text-[#1e3a5f] bg-slate-100 hover:bg-slate-200 px-3.5 py-2 rounded-lg font-medium transition-colors border border-slate-200"
            >
              <FileCode className="w-3.5 h-3.5 text-[#1e3a5f]" />
              <span>Carregar Arquivo Exemplo</span>
            </button>
            {spedLoaded && (
              <button
                onClick={onGoToAudit}
                className="flex items-center space-x-1.5 text-xs text-white bg-[#0f6e56] hover:bg-[#0b5240] px-4 py-2 rounded-lg font-medium shadow-xs transition-colors"
              >
                <span>Auditar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            {loadingSped && <span className="text-[#1e3a5f] text-xs font-medium animate-pulse">Lendo...</span>}
          </div>
        </div>

        {/* ZONA: XML de Terceiros */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-slate-100 text-[#0f6e56] p-4 rounded-lg">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">XML de Terceiros</h3>
                <p className="text-sm text-slate-500">NF-e recebidas de fornecedores (Entradas)</p>
              </div>
            </div>
            {xmlLoadings['XML_TERCEIROS'] && (
              <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs font-semibold text-emerald-900">
                  <span className="truncate">{xmlProgress['XML_TERCEIROS']?.text || 'Importando...'}</span>
                  <span>{xmlProgress['XML_TERCEIROS']?.pct || 0}%</span>
                </div>
                <div className="w-full bg-emerald-200 rounded-full h-2 overflow-hidden">
                  <div className="bg-emerald-600 h-2 rounded-full transition-all duration-300" style={{ width: `${xmlProgress['XML_TERCEIROS']?.pct || 0}%` }}></div>
                </div>
              </div>
            )}
            {xmlTerceirosCount > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-900 text-sm font-medium">
                  <FileCheck className="w-5 h-5 text-[#0f6e56] shrink-0" />
                  <span>{xmlTerceirosCount} arquivos carregados</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-semibold">Pronto</span>
                  {onClearXmlTerceiros && (
                    <button
                      onClick={onClearXmlTerceiros}
                      className="text-xs text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded shadow-xs"
                      title="Excluir importação"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center mb-4 hover:border-slate-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium mb-1">XML ou lote .zip (Terceiros)</p>
                <label className="inline-block mt-2 bg-[#0f6e56] text-white text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#0b5240] font-medium shadow-xs">
                  Procurar Arquivo
                  <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_TERCEIROS')} className="hidden" />
                </label>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
             {xmlLoadings['XML_TERCEIROS'] && <span className="text-[#0f6e56] text-xs font-medium animate-pulse">Lendo...</span>}
          </div>
        </div>

        {/* ZONA: XML Próprio */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-slate-100 text-[#1e3a5f] p-4 rounded-lg">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">NF-e Próprio</h3>
                <p className="text-sm text-slate-500">NF-e emitidas pela empresa (Saídas)</p>
              </div>
            </div>
            {xmlProprioCount > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-900 text-sm font-medium">
                  <FileCheck className="w-5 h-5 text-[#1e3a5f] shrink-0" />
                  <span>{xmlProprioCount} arquivos carregados</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-semibold">Pronto</span>
                  {onClearXmlProprio && (
                    <button
                      onClick={onClearXmlProprio}
                      className="text-xs text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded shadow-xs"
                      title="Excluir importação"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center mb-4 hover:border-slate-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium mb-1">XML ou lote .zip (Próprio)</p>
                <label className="inline-block mt-2 bg-[#1e3a5f] text-white text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#142c47] font-medium shadow-xs">
                  Procurar Arquivo
                  <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_PROPRIO')} className="hidden" />
                </label>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
             {xmlLoadings['XML_PROPRIO'] && <span className="text-[#1e3a5f] text-xs font-medium animate-pulse">Lendo...</span>}
          </div>
        </div>

        {/* ZONA: XML NFC-e */}
        <div className="bg-white rounded-lg border border-slate-200/60 p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-4 mb-6">
              <div className="bg-slate-100 text-[#0f6e56] p-4 rounded-lg">
                <Archive className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">NFC-e</h3>
                <p className="text-sm text-slate-500">Nota Fiscal de Consumidor (Mod 65)</p>
              </div>
            </div>
            {xmlNfceCount > 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-900 text-sm font-medium">
                  <FileCheck className="w-5 h-5 text-[#0f6e56] shrink-0" />
                  <span>{xmlNfceCount} arquivos carregados</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-semibold">Pronto</span>
                  {onClearXmlNfce && (
                    <button
                      onClick={onClearXmlNfce}
                      className="text-xs text-red-600 hover:text-red-800 bg-white border border-red-200 px-2 py-0.5 rounded shadow-xs"
                      title="Excluir importação"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center mb-4 hover:border-slate-400 transition-colors">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-medium mb-1">XML ou lote .zip (NFC-e)</p>
                <label className="inline-block mt-2 bg-[#0f6e56] text-white text-xs px-4 py-2 rounded-lg cursor-pointer hover:bg-[#0b5240] font-medium shadow-xs">
                  Procurar Arquivo
                  <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_NFCE')} className="hidden" />
                </label>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-end">
             {xmlLoadings['XML_NFCE'] && <span className="text-[#0f6e56] text-xs font-medium animate-pulse">Lendo...</span>}
          </div>
        </div>

      </div>

      {/* MODAL DE SUCESSO DE CAPTURA */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl border border-slate-100 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900">Captura Realizada com Sucesso!</h3>
              <p className="text-sm text-slate-600">
                Foram capturados e integrados <strong className="text-emerald-700 font-extrabold">{lastCapturedCount} novo(s) arquivo(s) XML</strong> à base de conferência.
              </p>
            </div>

            {spedData && (
              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-700 border border-slate-200 text-left space-y-1">
                <p className="font-bold text-slate-900">Status Atualizado do Confronto:</p>
                <p className="text-slate-600">
                  {missingXmlDocs.length > 0 
                    ? `Restam ainda ${missingXmlDocs.length} nota(s) faltantes no SPED C100 aguardando XML.` 
                    : '🎉 Todas as notas do SPED C100 agora possuem XMLs correspondentes localizados!'}
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Continuar Importando
              </button>
              <button
                onClick={() => { setShowSuccessModal(false); onGoToAudit(); }}
                className="flex-1 py-2.5 px-4 bg-[#0f6e56] hover:bg-[#0b5240] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
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

