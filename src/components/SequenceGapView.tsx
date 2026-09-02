import React, { useState, useMemo } from 'react';
import { SpedData, XmlRecord, SpedDocument, SpedItem } from '../types';
import { 
  ListOrdered, 
  AlertTriangle, 
  CheckCircle2, 
  FileCheck, 
  Upload, 
  Download, 
  Search, 
  Filter, 
  PlusCircle, 
  HelpCircle,
  FileCode,
  ArrowRight
} from 'lucide-react';

interface SequenceGapViewProps {
  spedData: SpedData | null;
  xmlRecords: XmlRecord[];
  onImportMissingToSped: (xmlsToImport: XmlRecord[]) => void;
  onNavigateTab?: (tab: string) => void;
}

export interface SequenceGapGroup {
  serie: string;
  mod: string;
  minNum: number;
  maxNum: number;
  totalEsperado: number;
  totalPresentesSped: number;
  totalFaltantesXmlDisponivel: number;
  totalSemXml: number;
  items: SequenceItemStatus[];
}

export interface SequenceItemStatus {
  numDoc: number;
  formattedNum: string;
  serie: string;
  mod: string;
  status: 'PRESENT_SPED' | 'MISSING_IN_SPED_HAS_XML' | 'GAP_NO_XML';
  spedDoc?: SpedDocument;
  xmlRecord?: XmlRecord;
  chvNfe?: string;
  dtEmi?: string;
  valor?: number;
}

export function calcularQuebrasDeSequencia(
  spedData: SpedData | null,
  xmlRecords: XmlRecord[]
): SequenceGapGroup[] {
  if (!spedData || !spedData.documents) return [];

  const mapBySerie = new Map<string, {
    mod: string;
    numbersSped: Map<number, SpedDocument>;
    numbersXml: Map<number, XmlRecord>;
  }>();

  // 1. Index SPED documents — APENAS Saídas / Emissão Própria (indOper === '1')
  spedData.documents.forEach(doc => {
    if (doc.indOper !== '1') return; // Desconsidera documentos de entrada/compras de fornecedores

    const num = parseInt((doc.numDoc || '').replace(/\D/g, ''), 10);
    if (isNaN(num) || num <= 0 || num > 999999999) return;
    const serie = (doc.serie || '1').trim() || '1';
    const mod = doc.codMod || '55';
    const key = `${mod}_${serie}`;

    if (!mapBySerie.has(key)) {
      mapBySerie.set(key, { mod, numbersSped: new Map(), numbersXml: new Map() });
    }
    mapBySerie.get(key)!.numbersSped.set(num, doc);
  });

  // 2. Index XML records — APENAS Emissão Própria (desconsidera XMLs de Terceiros)
  xmlRecords.forEach(xml => {
    if (xml.isTerceiros) return; // Desconsidera XMLs de compras de fornecedores

    const num = parseInt((xml.nNF || '').replace(/\D/g, ''), 10);
    if (isNaN(num) || num <= 0 || num > 999999999) return;
    const serie = (xml.serie || '1').trim() || '1';
    const mod = xml.mod || '55';
    const key = `${mod}_${serie}`;

    if (!mapBySerie.has(key)) {
      mapBySerie.set(key, { mod, numbersSped: new Map(), numbersXml: new Map() });
    }
    mapBySerie.get(key)!.numbersXml.set(num, xml);
  });

  const result: SequenceGapGroup[] = [];

  mapBySerie.forEach((val, key) => {
    const [mod, serie] = key.split('_');
    const allNumsSet = new Set([...val.numbersSped.keys(), ...val.numbersXml.keys()]);
    const sortedNums = Array.from(allNumsSet).sort((a, b) => a - b);
    if (sortedNums.length === 0) return;

    const minNum = sortedNums[0];
    const maxNum = sortedNums[sortedNums.length - 1];

    const items: SequenceItemStatus[] = [];
    let totalPresentesSped = 0;
    let totalFaltantesXmlDisponivel = 0;
    let totalSemXml = 0;

    let lastProcessedNum: number | null = null;

    for (let i = 0; i < sortedNums.length; i++) {
      const currentNum = sortedNums[i];

      // Se houver quebra de sequência (salto em relação à nota anterior),
      // registra APENAS a nota faltante imediatamente subsequente (lastProcessedNum + 1)
      // para sinalizar a quebra e interrompe a verificação contínua dos números intermediários.
      if (lastProcessedNum !== null && currentNum > lastProcessedNum + 1) {
        const missingNum = lastProcessedNum + 1;
        totalSemXml++;
        items.push({
          numDoc: missingNum,
          formattedNum: String(missingNum).padStart(6, '0'),
          serie,
          mod,
          status: 'GAP_NO_XML'
        });
      }

      const spedDoc = val.numbersSped.get(currentNum);
      const xmlRec = val.numbersXml.get(currentNum);

      if (spedDoc) {
        totalPresentesSped++;
        items.push({
          numDoc: currentNum,
          formattedNum: String(currentNum).padStart(6, '0'),
          serie,
          mod,
          status: 'PRESENT_SPED',
          spedDoc,
          xmlRecord: xmlRec,
          chvNfe: spedDoc.chvNfe || xmlRec?.chvNfe,
          dtEmi: spedDoc.dtDoc || xmlRec?.dhEmi,
          valor: (spedDoc.items || []).reduce((acc, it) => acc + (it.vlItem || 0), 0) || xmlRec?.vNF
        });
      } else if (xmlRec) {
        totalFaltantesXmlDisponivel++;
        items.push({
          numDoc: currentNum,
          formattedNum: String(currentNum).padStart(6, '0'),
          serie,
          mod,
          status: 'MISSING_IN_SPED_HAS_XML',
          xmlRecord: xmlRec,
          chvNfe: xmlRec.chvNfe,
          dtEmi: xmlRec.dhEmi,
          valor: xmlRec.vNF
        });
      }

      lastProcessedNum = currentNum;
    }

    result.push({
      serie,
      mod,
      minNum,
      maxNum,
      totalEsperado: items.length,
      totalPresentesSped,
      totalFaltantesXmlDisponivel,
      totalSemXml,
      items
    });
  });

  return result.sort((a, b) => a.serie.localeCompare(b.serie));
}

export function SequenceGapView({
  spedData,
  xmlRecords,
  onImportMissingToSped,
  onNavigateTab
}: SequenceGapViewProps) {
  const [selectedSerieFilter, setSelectedSerieFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(120);

  // Group and analyze sequence numbers across SPED documents and XMLs
  const gapGroups = useMemo(() => {
    return calcularQuebrasDeSequencia(spedData, xmlRecords);
  }, [spedData, xmlRecords]);

  // Aggregate stats
  const totalGapsXmlAvailable = useMemo(() => {
    return gapGroups.reduce((acc, g) => acc + g.totalFaltantesXmlDisponivel, 0);
  }, [gapGroups]);

  const totalGapsNoXml = useMemo(() => {
    return gapGroups.reduce((acc, g) => acc + g.totalSemXml, 0);
  }, [gapGroups]);

  const totalXmlsToImport = useMemo(() => {
    const list: XmlRecord[] = [];
    gapGroups.forEach(g => {
      g.items.forEach(item => {
        if (item.status === 'MISSING_IN_SPED_HAS_XML' && item.xmlRecord) {
          list.push(item.xmlRecord);
        }
      });
    });
    return list;
  }, [gapGroups]);

  const handleImportAllMissing = () => {
    if (totalXmlsToImport.length === 0) {
      alert('Nenhuma nota fiscal XML faltante disponível para importação direta no SPED.');
      return;
    }
    setIsImporting(true);
    setTimeout(() => {
      onImportMissingToSped(totalXmlsToImport);
      setIsImporting(false);
    }, 300);
  };

  if (!spedData) {
    return (
      <div className="max-w-6xl mx-auto py-12 px-4 text-center">
        <ListOrdered className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Nenhum Arquivo SPED Fiscal Carregado</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Faça o upload do arquivo SPED na aba de Importação para conferir automaticamente as quebras de sequência de numeração das notas fiscais.
        </p>
        {onNavigateTab && (
          <button
            onClick={() => onNavigateTab('upload')}
            className="mt-6 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            Ir para Importação
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-lg border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-slate-100 text-[#1e3a5f] rounded-lg">
              <ListOrdered className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Análise de Quebra de Sequência de Documentos</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Verificação automatizada da numeração contínua de Notas Fiscais (Modelos 55, 65) escrituradas no SPED x XML.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {totalGapsXmlAvailable > 0 && (
            <button
              onClick={handleImportAllMissing}
              disabled={isImporting}
              className="bg-[#0f6e56] hover:bg-[#0b5240] disabled:bg-[#0f6e56]/50 text-white px-5 py-2.5 rounded-lg text-xs font-bold flex items-center space-x-2 shadow-xs transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>
                {isImporting ? 'Importando no SPED...' : `Importar ${totalGapsXmlAvailable} Nota(s) Faltantes no SPED`}
              </span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('omissas')}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center space-x-2 transition"
            >
              <FileCheck className="w-4 h-4" />
              <span>Ver no Módulo Omissas</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <ListOrdered className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Séries Analisadas</p>
            <p className="text-2xl font-black text-slate-900">{gapGroups.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-emerald-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-emerald-800 uppercase">Notas no SPED</p>
            <p className="text-2xl font-black text-emerald-700">
              {gapGroups.reduce((acc, g) => acc + g.totalPresentesSped, 0)}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-slate-100 text-[#1e3a5f] flex items-center justify-center font-bold">
            <FileCode className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-700 uppercase">Faltam no SPED (XML OK)</p>
            <p className="text-2xl font-black text-[#1e3a5f]">{totalGapsXmlAvailable}</p>
            <p className="text-[10px] text-slate-500 font-medium">Prontas p/ inserção à parte</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-amber-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-900 uppercase">Quebras sem XML</p>
            <p className="text-2xl font-black text-amber-700">{totalGapsNoXml}</p>
            <p className="text-[10px] text-amber-800 font-medium">Necessita inutilização/justificativa</p>
          </div>
        </div>
      </div>

      {/* Layperson explanation callout */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start space-x-3 text-sm text-slate-800">
        <HelpCircle className="w-5 h-5 text-[#1e3a5f] shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900">Como funciona o ajuste para leigos?</p>
          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
            As notas destacadas em <span className="font-bold text-[#1e3a5f]">Azul (XML Disponível)</span> constam nos arquivos da empresa, mas foram esquecidas no SPED Fiscal. Ao clicar no botão <strong>"Importar Nota(s) Faltantes no SPED"</strong>, o sistema cria automaticamente os registros fiscais (C100, C170 e C190) diretamente no arquivo do SPED para exportação oficial completa.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar número de nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            >
              <option value="ALL">Todos os Status</option>
              <option value="MISSING_IN_SPED_HAS_XML">Faltante no SPED (Com XML)</option>
              <option value="GAP_NO_XML">Quebra de Sequência (Sem XML)</option>
              <option value="PRESENT_SPED">Escrituradas no SPED</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedSerieFilter}
              onChange={(e) => setSelectedSerieFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            >
              <option value="ALL">Todas as Séries</option>
              {gapGroups.map(g => (
                <option key={g.serie} value={g.serie}>Série {g.serie} (Mod {g.mod})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-slate-600 font-medium">OK no SPED</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#1e3a5f] inline-block"></span>
            <span className="text-slate-600 font-medium">XML Faltante no SPED</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
            <span className="text-slate-600 font-medium">Quebra (Sem XML)</span>
          </div>
        </div>
      </div>

      {/* Series Groups List */}
      <div className="space-y-6">
        {gapGroups
          .filter(g => selectedSerieFilter === 'ALL' || g.serie === selectedSerieFilter)
          .map(group => {
            const filteredItems = group.items.filter(item => {
              if (selectedStatusFilter !== 'ALL' && item.status !== selectedStatusFilter) return false;
              if (searchTerm && !item.formattedNum.includes(searchTerm) && !String(item.numDoc).includes(searchTerm)) return false;
              return true;
            });

            if (filteredItems.length === 0) return null;

            return (
              <div key={`${group.mod}_${group.serie}`} className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-base font-bold text-slate-900">Série {group.serie}</span>
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">Modelo {group.mod}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Faixa Numérica: NFs {group.minNum} até {group.maxNum} ({group.totalEsperado} números no total)
                    </p>
                  </div>

                  <div className="flex items-center space-x-3 text-xs">
                    <span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded border border-emerald-200 font-medium">
                      {group.totalPresentesSped} escrituradas
                    </span>
                    {group.totalFaltantesXmlDisponivel > 0 && (
                      <span className="bg-slate-100 text-[#1e3a5f] px-2.5 py-1 rounded border border-slate-300 font-semibold">
                        {group.totalFaltantesXmlDisponivel} faltam no SPED (Com XML)
                      </span>
                    )}
                    {group.totalSemXml > 0 && (
                      <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded border border-amber-200 font-semibold">
                        {group.totalSemXml} faltam sem XML
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Grid */}
                <div className="p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {filteredItems.slice(0, displayLimit).map(item => {
                      if (item.status === 'PRESENT_SPED') {
                        return (
                          <div
                            key={item.numDoc}
                            className="bg-emerald-50/60 border border-emerald-200 rounded-lg p-3 flex flex-col justify-between hover:bg-emerald-100/60 transition"
                            title={`NF ${item.formattedNum} — Escriturada no SPED`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-900">NF {item.formattedNum}</span>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            </div>
                            <span className="text-[10px] text-emerald-700 font-semibold mt-2">No SPED</span>
                          </div>
                        );
                      }

                      if (item.status === 'MISSING_IN_SPED_HAS_XML') {
                        return (
                          <div
                            key={item.numDoc}
                            className="bg-slate-50 border border-slate-300 rounded-lg p-3 flex flex-col justify-between shadow-2xs hover:bg-slate-100 transition"
                            title={`NF ${item.formattedNum} — Disponível em XML, mas NÃO escriturada no SPED`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">NF {item.formattedNum}</span>
                              <FileCode className="w-3.5 h-3.5 text-[#1e3a5f]" />
                            </div>
                            <div className="mt-2">
                              <span className="text-[10px] font-bold bg-slate-200 text-[#1e3a5f] px-1.5 py-0.5 rounded block text-center">
                                Com XML
                              </span>
                              {item.xmlRecord && (
                                <button
                                  onClick={() => onImportMissingToSped([item.xmlRecord!])}
                                  className="mt-1.5 w-full bg-[#1e3a5f] hover:bg-[#142c47] text-white text-[9px] font-bold py-1 rounded transition text-center"
                                >
                                  + Inserir SPED
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={item.numDoc}
                          className="bg-amber-50/70 border border-amber-300 rounded-lg p-3 flex flex-col justify-between hover:bg-amber-100/60 transition"
                          title={`NF ${item.formattedNum} — Quebra de sequência sem XML no sistema`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950">NF {item.formattedNum}</span>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          </div>
                          <span className="text-[10px] text-amber-800 font-bold mt-2">Sem XML</span>
                        </div>
                      );
                    })}
                  </div>

                  {filteredItems.length > displayLimit && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                      <span>Exibindo os primeiros {displayLimit} de {filteredItems.length} itens desta série</span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setDisplayLimit(prev => prev + 120)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition"
                        >
                          Carregar mais (+120)
                        </button>
                        <button
                          onClick={() => setDisplayLimit(filteredItems.length)}
                          className="bg-slate-100 text-[#1e3a5f] hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition"
                        >
                          Mostrar Todos ({filteredItems.length})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {gapGroups.length === 0 && (
          <div className="bg-white p-12 text-center rounded-lg border border-slate-200 text-slate-500">
            Nenhuma série ou documento identificado no arquivo.
          </div>
        )}
      </div>
    </div>
  );
}
