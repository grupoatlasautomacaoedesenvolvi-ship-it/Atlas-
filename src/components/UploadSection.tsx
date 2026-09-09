import React, { useState, useMemo } from 'react';
import { Upload, FileCheck, ArrowRight, FileCode, Archive, FilePlus, AlertCircle, CheckCircle2, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
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
    <div className="max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6 text-[var(--atlas-text)]">
      {/* Header Breadcrumb Bar */}
      <div className="atlas-breadcrumb-bar rounded-xl">
        <div className="flex items-center space-x-2">
          <Upload className="w-4 h-4 text-[var(--atlas-navy)] shrink-0" />
          <span className="font-semibold text-[var(--atlas-text-secondary)]">Módulo 1:</span>
          <span className="font-bold text-[var(--atlas-navy)]">Central de Importação Fiscal & XMLs</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span>SPED Fiscal: {spedLoaded ? <strong className="text-[var(--atlas-accent)]">Carregado</strong> : <strong className="text-[var(--atlas-text-muted)]">Pendente</strong>}</span>
          <span>•</span>
          <span>XMLs Totais: <strong className="text-[var(--atlas-navy)]">{xmlTerceirosCount + xmlProprioCount + xmlNfceCount}</strong></span>
        </div>
      </div>

      {/* Faixa fina de aviso de notas faltantes com borda inferior em --atlas-warning */}
      <div className="bg-[var(--atlas-warning-bg)] border-b-2 border-[var(--atlas-warning)] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-[var(--atlas-surface)] text-[var(--atlas-warning)] rounded-lg shrink-0 border border-[var(--atlas-border)]">
            <FilePlus className="w-4 h-4 text-[var(--atlas-warning)]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[var(--atlas-text)]">Captura Integrada de XMLs Faltantes</span>
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
            <p className="text-[var(--atlas-text-secondary)] mt-0.5">
              Complemente sua auditoria enviando lotes de XMLs/ZIPs sem sobrescrever os arquivos já carregados.
            </p>
          </div>
        </div>

        <label className="atlas-btn atlas-btn-primary py-1.5 px-3.5 text-xs cursor-pointer shrink-0">
          <Upload className="w-3.5 h-3.5" />
          <span>{loadingMissingXmls ? 'Lendo...' : 'Capturar XMLs Faltantes'}</span>
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

      {/* QUADRO ÚNICO DE IMPORTAÇÕES REGULARES (.atlas-card com .atlas-list-row) */}
      <div className="atlas-card p-0 overflow-hidden">
        <div className="p-5 border-b border-[var(--atlas-border)] flex items-center justify-between bg-[var(--atlas-surface)]">
          <div>
            <h2 className="text-sm font-bold text-[var(--atlas-navy)]">Zonas de Importação Fiscal</h2>
            <p className="text-xs text-[var(--atlas-text-secondary)]">Carregue cada modalidade de arquivo para cruzamento automatizado</p>
          </div>
          {spedLoaded && (
            <button
              onClick={onGoToAudit}
              className="atlas-btn atlas-btn-accent py-1.5 px-4 text-xs"
            >
              <span>Ir para Auditoria</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="divide-y divide-[var(--atlas-border)]">
          {/* LINHA 1: SPED Fiscal */}
          <div className="atlas-list-row justify-between flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="p-2.5 rounded-lg bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] shrink-0">
                <FileCode className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] text-xs">SPED Fiscal (EFD ICMS/IPI)</h3>
                  {spedLoaded ? (
                    <span className="atlas-pill atlas-pill-accent">Carregado</span>
                  ) : (
                    <span className="atlas-pill atlas-pill-navy">Pendente</span>
                  )}
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] truncate mt-0.5">
                  {spedLoaded ? (spedFileName || 'SPED Ativo na Sessão') : 'Arquivo .txt oficial do SPED Fiscal'}
                </p>
                {loadingSped && (
                  <div className="mt-2 text-[11px] text-[var(--atlas-navy)] font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{spedStatusText} ({spedProgress}%)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
              <button
                onClick={handleLoadSample}
                className="atlas-btn atlas-btn-secondary py-1.5 px-3 text-xs"
              >
                <FileCode className="w-3.5 h-3.5 text-[var(--atlas-navy)]" />
                <span>Exemplo</span>
              </button>
              {spedLoaded && onClearSped && (
                <button
                  onClick={() => { setSpedFileName(null); onClearSped(); }}
                  className="atlas-btn atlas-btn-secondary py-1.5 px-3 text-xs text-[var(--atlas-danger)] hover:border-[var(--atlas-danger)]"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-primary py-1.5 px-4 text-xs cursor-pointer">
                <span>{spedLoaded ? 'Substituir .txt' : 'Selecionar .txt'}</span>
                <input type="file" accept=".txt" onChange={handleSpedUpload} className="hidden" />
              </label>
            </div>
          </div>

          {/* LINHA 2: XML de Terceiros */}
          <div className="atlas-list-row justify-between flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="p-2.5 rounded-lg bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] text-xs">XML de Terceiros (Entradas / Fornecedores)</h3>
                  {xmlTerceirosCount > 0 ? (
                    <span className="atlas-pill atlas-pill-accent">{xmlTerceirosCount} arquivo(s)</span>
                  ) : (
                    <span className="atlas-pill atlas-pill-info">Opcional</span>
                  )}
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] truncate mt-0.5">
                  NF-e Mod 55 recebidas de fornecedores de mercadoria/insumos.
                </p>
                {xmlLoadings['XML_TERCEIROS'] && (
                  <div className="mt-2 text-[11px] text-[var(--atlas-accent)] font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{xmlProgress['XML_TERCEIROS']?.text || 'Importando...'} ({xmlProgress['XML_TERCEIROS']?.pct || 0}%)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
              {xmlTerceirosCount > 0 && onClearXmlTerceiros && (
                <button
                  onClick={onClearXmlTerceiros}
                  className="atlas-btn atlas-btn-secondary py-1.5 px-3 text-xs text-[var(--atlas-danger)] hover:border-[var(--atlas-danger)]"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-accent py-1.5 px-4 text-xs cursor-pointer">
                <span>{xmlTerceirosCount > 0 ? 'Adicionar XML/ZIP' : 'Enviar XML/ZIP'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_TERCEIROS')} className="hidden" />
              </label>
            </div>
          </div>

          {/* LINHA 3: XML Próprio */}
          <div className="atlas-list-row justify-between flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="p-2.5 rounded-lg bg-[var(--atlas-navy-tint)] text-[var(--atlas-navy)] shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] text-xs">NF-e Próprio (Saídas / Vendas)</h3>
                  {xmlProprioCount > 0 ? (
                    <span className="atlas-pill atlas-pill-navy">{xmlProprioCount} arquivo(s)</span>
                  ) : (
                    <span className="atlas-pill atlas-pill-info">Opcional</span>
                  )}
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] truncate mt-0.5">
                  NF-e Mod 55 emitidas pelo próprio contribuinte.
                </p>
                {xmlLoadings['XML_PROPRIO'] && (
                  <div className="mt-2 text-[11px] text-[var(--atlas-navy)] font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Lendo XMLs próprios...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
              {xmlProprioCount > 0 && onClearXmlProprio && (
                <button
                  onClick={onClearXmlProprio}
                  className="atlas-btn atlas-btn-secondary py-1.5 px-3 text-xs text-[var(--atlas-danger)] hover:border-[var(--atlas-danger)]"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-primary py-1.5 px-4 text-xs cursor-pointer">
                <span>{xmlProprioCount > 0 ? 'Adicionar XML/ZIP' : 'Enviar XML/ZIP'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_PROPRIO')} className="hidden" />
              </label>
            </div>
          </div>

          {/* LINHA 4: NFC-e */}
          <div className="atlas-list-row justify-between flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center space-x-4 min-w-0">
              <div className="p-2.5 rounded-lg bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] shrink-0">
                <Archive className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[var(--atlas-text)] text-xs">NFC-e (Nota de Consumidor Eletrônica)</h3>
                  {xmlNfceCount > 0 ? (
                    <span className="atlas-pill atlas-pill-accent">{xmlNfceCount} arquivo(s)</span>
                  ) : (
                    <span className="atlas-pill atlas-pill-info">Opcional</span>
                  )}
                </div>
                <p className="text-[var(--atlas-text-secondary)] text-[11px] truncate mt-0.5">
                  NFC-e Mod 65 para conciliação de cupom fiscal e vendas no varejo.
                </p>
                {xmlLoadings['XML_NFCE'] && (
                  <div className="mt-2 text-[11px] text-[var(--atlas-accent)] font-medium flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Lendo NFC-es...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0 self-end md:self-auto">
              {xmlNfceCount > 0 && onClearXmlNfce && (
                <button
                  onClick={onClearXmlNfce}
                  className="atlas-btn atlas-btn-secondary py-1.5 px-3 text-xs text-[var(--atlas-danger)] hover:border-[var(--atlas-danger)]"
                >
                  Remover
                </button>
              )}
              <label className="atlas-btn atlas-btn-accent py-1.5 px-4 text-xs cursor-pointer">
                <span>{xmlNfceCount > 0 ? 'Adicionar XML/ZIP' : 'Enviar XML/ZIP'}</span>
                <input type="file" accept=".xml,.zip" multiple onChange={(e) => handleXmlUpload(e, 'XML_NFCE')} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE SUCESSO DE CAPTURA */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="atlas-card max-w-md w-full p-6 space-y-5 shadow-2xl text-center">
            <div className="w-16 h-16 bg-[var(--atlas-accent-tint)] text-[var(--atlas-accent)] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-[var(--atlas-navy)]">Captura Realizada com Sucesso!</h3>
              <p className="text-xs text-[var(--atlas-text-secondary)]">
                Foram capturados e integrados <strong className="text-[var(--atlas-accent)]">{lastCapturedCount} novo(s) arquivo(s) XML</strong> à base de conferência.
              </p>
            </div>

            {spedData && (
              <div className="bg-[var(--atlas-surface-hover)] rounded-xl p-3 text-xs text-[var(--atlas-text)] border border-[var(--atlas-border)] text-left space-y-1">
                <p className="font-bold text-[var(--atlas-navy)]">Status Atualizado do Confronto:</p>
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
                className="atlas-btn atlas-btn-secondary flex-1 py-2 px-4 text-xs"
              >
                Continuar Importando
              </button>
              <button
                onClick={() => { setShowSuccessModal(false); onGoToAudit(); }}
                className="atlas-btn atlas-btn-accent flex-1 py-2 px-4 text-xs"
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

