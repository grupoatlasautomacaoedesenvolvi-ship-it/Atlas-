import React, { useState, useMemo, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FiscalTooltip } from './FiscalTooltip';
import { SpedData, AuditConfig, SpedDocument, SpedItem, XmlRecord, StateTaxRule } from '../types';
import { mapXmlCfopToEntryCfop, findMatchingXmlItem, findBestFuzzyXmlItemMatch, ItemMatchDetails } from '../lib/cfopUtils';
import { AgentErrorReportModal } from './AgentErrorReportModal';
import { 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Pencil, 
  Check, 
  X, 
  CheckSquare, 
  Square, 
  Download, 
  FileText,
  Database,
  ArrowRight,
  Filter,
  RefreshCw,
  Calculator,
  Scale,
  ChevronDown,
  Eye
} from 'lucide-react';

function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  icon
}: {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: Set<string>;
  onChange: (vals: Set<string>) => void;
  icon?: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));
  const isAll = selectedValues.size === 0 || selectedValues.has('ALL');

  const toggleOption = (val: string) => {
    const next = new Set(selectedValues);
    if (val === 'ALL') {
      onChange(new Set(['ALL']));
      return;
    }
    next.delete('ALL');
    if (next.has(val)) {
      next.delete(val);
    } else {
      next.add(val);
    }
    onChange(next);
  };

  const selectAll = () => {
    onChange(new Set(['ALL']));
  };

  const clearAll = () => {
    onChange(new Set());
  };

  const countSelected = isAll ? 0 : selectedValues.size;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-1.5 border rounded-lg bg-white text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-2xs ${
          countSelected > 0
            ? 'border-[#1e3a5f] bg-slate-50 text-[#1e3a5f] font-semibold'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        {icon}
        <span>{label}</span>
        {countSelected > 0 && (
          <span className="ml-1 px-1.5 py-0.2 bg-[#1e3a5f] text-white rounded-full text-[10px] font-bold">
            {countSelected}
          </span>
        )}
        <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white rounded-xl shadow-xl border border-slate-200 z-50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">{label}</span>
            <div className="space-x-2 text-[11px]">
              <button type="button" onClick={selectAll} className="text-[#1e3a5f] hover:underline font-semibold">Todos</button>
              <span className="text-slate-300">|</span>
              <button type="button" onClick={clearAll} className="text-rose-600 hover:underline font-semibold">Limpar</button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Filtrar opções..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <label className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={isAll}
                onChange={selectAll}
                className="rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
              />
              <span>(Todos)</span>
            </label>

            {filteredOptions.map(opt => {
              const checked = !isAll && selectedValues.has(opt.value);
              return (
                <label key={opt.value} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-50 rounded-md cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(opt.value)}
                    className="rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                  />
                  <span className="truncate" title={opt.label}>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface AllItemsViewProps {
  spedData: SpedData;
  auditConfig: AuditConfig | null;
  stateTaxRules?: StateTaxRule[];
  xmlRecords?: XmlRecord[];
  onUpdateItem?: (
    docId: string,
    itemNum: string,
    newCst: string,
    newCfop: string,
    newVlBcIcms: number,
    newAliqIcms: number,
    newVlIcms: number,
    newNcm?: string,
    newVlItem?: number,
    correctedByRobot?: boolean,
    robotCorrectionReason?: string,
    analystConfirmed?: boolean
  ) => void;
  onBulkUpdateItems?: (
    targets: Array<{ docId: string; itemNum: string }>,
    updates: { cst?: string; cfop?: string; ncm?: string; vlBcIcms?: number; aliqIcms?: number; vlIcms?: number; applyXml?: boolean; applyMatriz?: boolean; analystConfirmed?: boolean; correctedByRobot?: boolean; robotCorrectionReason?: string }
  ) => void;
  hasHistory?: boolean;
  onUndoChanges?: () => void;
  onExportSped?: () => void;
  onRecalculateStructure?: () => void;
}

const C170_FILTERS_STORAGE_KEY = 'atlas_c170_filters_v1';

function getC170SavedSet(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(C170_FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed[key] && Array.isArray(parsed[key]) && parsed[key].length > 0) {
        return new Set(parsed[key]);
      }
    }
  } catch (e) {}
  return new Set(['ALL']);
}

function getC170SavedString(key: string): string {
  try {
    const raw = sessionStorage.getItem(C170_FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[key] === 'string') {
        return parsed[key];
      }
    }
  } catch (e) {}
  return '';
}

function getC170SavedNumber(key: string, defaultVal: number): number {
  try {
    const raw = sessionStorage.getItem(C170_FILTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed[key] === 'number') {
        return parsed[key];
      }
    }
  } catch (e) {}
  return defaultVal;
}

export function AllItemsView({ 
  spedData, 
  auditConfig, 
  stateTaxRules = [],
  xmlRecords = [], 
  onUpdateItem, 
  onBulkUpdateItems,
  hasHistory,
  onUndoChanges,
  onExportSped,
  onRecalculateStructure
}: AllItemsViewProps) {
  const [searchTerm, setSearchTerm] = useState(() => getC170SavedString('searchTerm'));
  const [statusFilter, setStatusFilter] = useState<Set<string>>(() => getC170SavedSet('statusFilter'));
  const [operFilter, setOperFilter] = useState<Set<string>>(() => getC170SavedSet('operFilter'));
  const [xmlFilter, setXmlFilter] = useState<Set<string>>(() => getC170SavedSet('xmlFilter'));
  const [divergenceTypeFilter, setDivergenceTypeFilter] = useState<Set<string>>(() => getC170SavedSet('divergenceTypeFilter'));
  const [cfopFilter, setCfopFilter] = useState<Set<string>>(() => getC170SavedSet('cfopFilter'));
  const [cstFilter, setCstFilter] = useState<Set<string>>(() => getC170SavedSet('cstFilter'));
  const [xmlCfopFilter, setXmlCfopFilter] = useState<Set<string>>(() => getC170SavedSet('xmlCfopFilter'));
  const [xmlCstFilter, setXmlCstFilter] = useState<Set<string>>(() => getC170SavedSet('xmlCstFilter'));
  const [ncmFilter, setNcmFilter] = useState<Set<string>>(() => getC170SavedSet('ncmFilter'));
  const [productFilter, setProductFilter] = useState<Set<string>>(() => getC170SavedSet('productFilter'));
  const [analystFilter, setAnalystFilter] = useState<Set<string>>(() => getC170SavedSet('analystFilter'));
  const [robotFilter, setRobotFilter] = useState<Set<string>>(() => getC170SavedSet('robotFilter'));
  const [modifiedFilter, setModifiedFilter] = useState<Set<string>>(() => getC170SavedSet('modifiedFilter'));
  const [learnedPatternsCount, setLearnedPatternsCount] = useState<number>(() => {
    const saved = localStorage.getItem('atlas_learned_patterns_count');
    return saved ? parseInt(saved, 10) : 142;
  });
  const [currentPage, setCurrentPage] = useState(() => getC170SavedNumber('currentPage', 1));

  useEffect(() => {
    try {
      const filterObj = {
        searchTerm,
        statusFilter: Array.from(statusFilter),
        operFilter: Array.from(operFilter),
        xmlFilter: Array.from(xmlFilter),
        divergenceTypeFilter: Array.from(divergenceTypeFilter),
        cfopFilter: Array.from(cfopFilter),
        cstFilter: Array.from(cstFilter),
        xmlCfopFilter: Array.from(xmlCfopFilter),
        xmlCstFilter: Array.from(xmlCstFilter),
        ncmFilter: Array.from(ncmFilter),
        productFilter: Array.from(productFilter),
        analystFilter: Array.from(analystFilter),
        robotFilter: Array.from(robotFilter),
        modifiedFilter: Array.from(modifiedFilter),
        currentPage
      };
      sessionStorage.setItem(C170_FILTERS_STORAGE_KEY, JSON.stringify(filterObj));
    } catch (e) {}
  }, [
    searchTerm, statusFilter, operFilter, xmlFilter, divergenceTypeFilter,
    cfopFilter, cstFilter, xmlCfopFilter, xmlCstFilter, ncmFilter,
    productFilter, analystFilter, robotFilter, modifiedFilter, currentPage
  ]);
  const itemsPerPage = 50;

  // Agent Report Modal State
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedReportItem, setSelectedReportItem] = useState<{
    descrItem: string;
    ncm?: string;
    cstIcms?: string;
    cfop?: string;
    docNum?: string;
    itemNum?: string;
  }>({ descrItem: '' });

  // Missing XML Modal State
  const [missingXmlModalOpen, setMissingXmlModalOpen] = useState(false);
  const [missingXmlModalTab, setMissingXmlModalTab] = useState<'sped_no_xml' | 'xml_no_sped'>('sped_no_xml');

  // Editing state
  const [editingItemData, setEditingItemData] = useState<{ docId: string; item: SpedItem } | null>(null);
  const [editNcm, setEditNcm] = useState('');
  const [editCst, setEditCst] = useState('');
  const [editCfop, setEditCfop] = useState('');
  const [editVlItem, setEditVlItem] = useState('');
  const [editVlBc, setEditVlBc] = useState('');
  const [editAliq, setEditAliq] = useState('');
  const [editVlIcms, setEditVlIcms] = useState('');

  // Inline editing state
  const [inlineEditingKey, setInlineEditingKey] = useState<string | null>(null);
  const [inlineCst, setInlineCst] = useState('');
  const [inlineCfop, setInlineCfop] = useState('');
  const [inlineVlItem, setInlineVlItem] = useState('');
  const [inlineAliq, setInlineAliq] = useState('');
  const [inlineVlBc, setInlineVlBc] = useState('');
  const [inlineVlIcms, setInlineVlIcms] = useState('');

  // Bulk selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkNcmInput, setBulkNcmInput] = useState('');
  const [bulkCstInput, setBulkCstInput] = useState('');
  const [bulkCfopInput, setBulkCfopInput] = useState('');
  const [bulkVlBcInput, setBulkVlBcInput] = useState('');
  const [bulkAliqInput, setBulkAliqInput] = useState('');
  const [bulkVlIcmsInput, setBulkVlIcmsInput] = useState('');

  // Map XML items by doc.chvNfe, numDoc+serie, item.numItem, cProd, and positional index
  const xmlItemMap = useMemo(() => {
    const map = new Map<string, any>();
    if (!spedData || !xmlRecords) return map;

    const xmlByChv = new Map<string, any>();
    const xmlByDocKey = new Map<string, any>();

    xmlRecords.forEach(x => {
      if (x.chvNfe) {
        xmlByChv.set(x.chvNfe.replace(/\D/g, ''), x);
      }
      if (x.nNF) {
        const cleanNum = x.nNF.replace(/^0+/, '');
        const cleanSerie = (x.serie || '0').replace(/^0+/, '');
        const cleanCnpj = (x.emitCnpj || '').replace(/\D/g, '');
        if (cleanNum) {
          xmlByDocKey.set(`${cleanNum}_${cleanSerie}_${cleanCnpj}`, x);
          xmlByDocKey.set(`${cleanNum}_${cleanSerie}`, x);
          xmlByDocKey.set(cleanNum, x);
        }
      }
    });

    spedData.documents.forEach(doc => {
      let xmlRec = null;
      if (doc.chvNfe) {
        const cleanChv = doc.chvNfe.replace(/\D/g, '');
        xmlRec = xmlByChv.get(cleanChv);
      }
      if (!xmlRec && doc.numDoc) {
        const cleanNum = doc.numDoc.replace(/^0+/, '');
        const cleanSerie = (doc.serie || '0').replace(/^0+/, '');
        const cleanCnpj = (doc.cnpjEmit || '').replace(/\D/g, '');
        xmlRec =
          xmlByDocKey.get(`${cleanNum}_${cleanSerie}_${cleanCnpj}`) ||
          xmlByDocKey.get(`${cleanNum}_${cleanSerie}`) ||
          xmlByDocKey.get(cleanNum);
      }

      if (!xmlRec && doc.numDoc) {
        const cleanNum = doc.numDoc.replace(/^0+/, '');
        xmlRec = xmlRecords.find(x => x.nNF && x.nNF.replace(/^0+/, '') === cleanNum);
      }

      if (!xmlRec || !xmlRec.items) return;

      doc.items.forEach((item, index) => {
        const xi = findMatchingXmlItem(xmlRec.items, item, index);
        if (xi) {
          map.set(`${doc.id}_cprod_${item.codItem}`, xi);
          map.set(`${doc.id}_${item.numItem}`, xi);
          map.set(`${doc.id}_${parseInt(item.numItem, 10)}`, xi);
          map.set(`${doc.id}_idx_${index}`, xi);
        }
      });
    });
    return map;
  }, [spedData, xmlRecords]);

  const getXmlItemForSped = (doc: SpedDocument, item: SpedItem, index: number) => {
    const cached = (
      xmlItemMap.get(`${doc.id}_cprod_${item.codItem}`) ||
      xmlItemMap.get(`${doc.id}_${item.numItem}`) ||
      xmlItemMap.get(`${doc.id}_${parseInt(item.numItem, 10)}`) ||
      xmlItemMap.get(`${doc.id}_idx_${index}`)
    );
    if (cached) return cached;

    if (!xmlRecords) return null;
    let xmlRec = null;
    if (doc.chvNfe) {
      const cleanChv = doc.chvNfe.replace(/\D/g, '');
      xmlRec = xmlRecords.find(x => x.chvNfe && x.chvNfe.replace(/\D/g, '') === cleanChv);
    }
    if (!xmlRec && doc.numDoc) {
      const cleanNum = doc.numDoc.replace(/^0+/, '');
      xmlRec = xmlRecords.find(x => x.nNF && x.nNF.replace(/^0+/, '') === cleanNum);
    }
    if (!xmlRec || !xmlRec.items) return null;
    return findMatchingXmlItem(xmlRec.items, item, index);
  };

  const getXmlMatchDetailsForSped = (doc: SpedDocument, item: SpedItem, index: number): ItemMatchDetails | null => {
    if (!xmlRecords) return null;
    let xmlRec = null;
    if (doc.chvNfe) {
      const cleanChv = doc.chvNfe.replace(/\D/g, '');
      xmlRec = xmlRecords.find(x => x.chvNfe && x.chvNfe.replace(/\D/g, '') === cleanChv);
    }
    if (!xmlRec && doc.numDoc) {
      const cleanNum = doc.numDoc.replace(/^0+/, '');
      xmlRec = xmlRecords.find(x => x.nNF && x.nNF.replace(/^0+/, '') === cleanNum);
    }
    if (!xmlRec || !xmlRec.items) return null;
    return findBestFuzzyXmlItemMatch(xmlRec.items, item, index);
  };

  const startEditing = (docId: string, item: SpedItem) => {
    if (item.analystConfirmed) {
      alert('Este item está marcado como Conferido. Para editá-lo, você deve primeiro desmarcar a conferência.');
      return;
    }
    setEditingItemData({ docId, item });
    setEditNcm(item.ncm || '');
    setEditCst(item.cstIcms || '');
    setEditCfop(item.cfop || '');
    setEditVlItem(String(item.vlItem ?? 0));
    setEditVlBc(String(item.vlBcIcms ?? 0));
    setEditAliq(String(item.aliqIcms ?? 0));
    setEditVlIcms(String(item.vlIcms ?? 0));
  };

  const cancelEditing = () => {
    setEditingItemData(null);
  };

  const startInlineEdit = (docId: string, item: SpedItem) => {
    if (item.analystConfirmed) {
      alert('Este item está marcado como Conferido. Para editá-lo, você deve primeiro desmarcar a conferência.');
      return;
    }
    const key = `${docId}_${item.numItem}`;
    setInlineEditingKey(key);
    setInlineCst(item.cstIcms || '');
    setInlineCfop(item.cfop || '');
    setInlineVlItem(String(item.vlItem ?? 0));
    setInlineAliq(String(item.aliqIcms ?? 0));
    setInlineVlBc(String(item.vlBcIcms ?? 0));
    setInlineVlIcms(String(item.vlIcms ?? 0));
  };

  const cancelInlineEdit = () => {
    setInlineEditingKey(null);
  };

  const copyFromXmlForInline = (docId: string, item: SpedItem) => {
    if (!spedData) return;
    const doc = spedData.documents.find(d => d.id === docId);
    if (!doc) return;
    const idx = doc.items.findIndex(i => i.numItem === item.numItem);
    const xmlItem = getXmlItemForSped(doc, item, idx >= 0 ? idx : 0);
    if (!xmlItem) {
      alert('Nenhum item XML vinculado encontrado para este item.');
      return;
    }
    if (xmlItem.cst) setInlineCst(xmlItem.cst);
    if (xmlItem.cfop) {
      const isEntry = item.cfop.startsWith('1') || item.cfop.startsWith('2');
      setInlineCfop(mapXmlCfopToEntryCfop(xmlItem.cfop, isEntry));
    }
    if (xmlItem.vProd !== undefined || xmlItem.vItem !== undefined) {
      setInlineVlItem(String(xmlItem.vProd ?? xmlItem.vItem ?? 0));
    }
    if (xmlItem.vBc !== undefined) setInlineVlBc(String(xmlItem.vBc));
    if (xmlItem.pIcms !== undefined) setInlineAliq(String(xmlItem.pIcms));
    if (xmlItem.vIcms !== undefined) setInlineVlIcms(String(xmlItem.vIcms));
  };

  const saveInlineEdit = (docId: string, item: SpedItem) => {
    if (!onUpdateItem) return;
    const cst = inlineCst.trim();
    const cfop = inlineCfop.trim();
    const vlItem = parseFloat(inlineVlItem.replace(',', '.')) || item.vlItem || 0;
    const aliq = parseFloat(inlineAliq.replace(',', '.')) || 0;
    const vlBc = parseFloat(inlineVlBc.replace(',', '.')) || vlItem;
    const vlIcms = parseFloat(inlineVlIcms.replace(',', '.')) || ((vlBc * aliq) / 100);

    onUpdateItem(
      docId,
      item.numItem,
      cst,
      cfop,
      vlBc,
      aliq,
      vlIcms,
      item.ncm,
      vlItem
    );
    setInlineEditingKey(null);
  };

  const saveEditing = () => {
    if (!editingItemData || !onUpdateItem) return;
    const vlItem = parseFloat(editVlItem.replace(',', '.')) || 0;
    const vlBc = parseFloat(editVlBc.replace(',', '.')) || 0;
    const aliq = parseFloat(editAliq.replace(',', '.')) || 0;
    const vlIcms = parseFloat(editVlIcms.replace(',', '.')) || 0;

    onUpdateItem(
      editingItemData.docId,
      editingItemData.item.numItem,
      editCst.trim(),
      editCfop.trim(),
      vlBc,
      aliq,
      vlIcms,
      editingItemData.item.ncm,
      vlItem
    );
    setEditingItemData(null);
  };

  // Flatten all items with parent document, XML cross-check, and Matriz Tax Rules matching
  const enrichedItems = useMemo(() => {
    if (!spedData || !spedData.documents) return [];
    const companyUf = (spedData.header.uf || 'SP').trim().toUpperCase();
    const list: Array<{
      doc: SpedDocument;
      item: SpedItem;
      status: 'OK' | 'MALFORMED' | 'DIVERGENT';
      reason: string;
      xmlItem: any;
      fuzzyMatch: ItemMatchDetails | null;
      matrizRule?: StateTaxRule;
      matrizDiff: boolean;
      matrizDiffReason?: string;
    }> = [];

    for (const doc of spedData.documents) {
      doc.items.forEach((item, index) => {
        const ncm = (item.ncm || '').trim();
        const cfop = (item.cfop || '').trim();
        const cst = (item.cstIcms || '').trim();
        const xmlItem = getXmlItemForSped(doc, item, index);
        const fuzzyMatch = getXmlMatchDetailsForSped(doc, item, index);

        let status: 'OK' | 'MALFORMED' | 'DIVERGENT' = 'OK';
        let reason = 'OK';

        // Match against State Tax Matrix Rules (Banco de Dados de Alíquotas e NCMs)
        let matrizRule: StateTaxRule | undefined = undefined;
        let matrizDiff = false;
        let matrizDiffReason = '';

        if (stateTaxRules.length > 0) {
          matrizRule = stateTaxRules.find(smRule => {
            const ruleNcm = (smRule.ncmPrefix || '').trim();
            const ncmMatches = ruleNcm ? ncm.startsWith(ruleNcm) : false;
            const smUf = (smRule.uf || 'ALL').trim().toUpperCase();
            
            let ufDestino = companyUf;
            if (doc.indOper === '1' && cfop.startsWith('6')) {
              ufDestino = 'INTERESTADUAL'; 
            }
            const ufMatches = smUf === 'ALL' || smUf === ufDestino || smUf === companyUf;
            return ncmMatches && ufMatches;
          });

          if (matrizRule) {
            const expCst = (matrizRule.expectedCst || '').trim().padStart(3, '0');
            const curCst = cst.padStart(3, '0');
            const isCstDiff = expCst ? curCst !== expCst : false;
            
            const expCfops = Array.isArray(matrizRule.expectedCfop) ? matrizRule.expectedCfop : [];
            const isCfopDiff = expCfops.length > 0 && !expCfops.includes(cfop);

            const expAliq = matrizRule.expectedAliqIcms;
            const isAliqDiff = expAliq !== undefined && expAliq !== null && Math.abs((item.aliqIcms || 0) - expAliq) > 0.01;

            if (isCstDiff || isCfopDiff || isAliqDiff) {
              matrizDiff = true;
              matrizDiffReason = `Divergência na Matriz Cadastrada: ${
                isCstDiff ? `CST esperado ${expCst} (atual: ${cst}); ` : ''
              }${
                isAliqDiff ? `Alíquota esperada ${expAliq}% (atual: ${item.aliqIcms}%); ` : ''
              }${
                isCfopDiff ? `CFOP incompatível com a regra; ` : ''
              }`;
            }
          }
        }

        if (item.malformed) {
          status = 'MALFORMED';
          reason = item.malformedReason || 'Registro malformado ou alíquota implausível';
        } else {
          // Check Audit Config Rules
          if (auditConfig?.rules) {
            for (const rule of auditConfig.rules) {
              const ruleNcm = (rule.ncm || '').trim();
              const ncmMatch = ruleNcm ? ncm.startsWith(ruleNcm) : false;
              const ruleUf = (rule.uf || 'ALL').trim().toUpperCase();
              const ufMatch = ruleUf === 'ALL' || ruleUf === companyUf;

              if (ncmMatch && ufMatch) {
                const isCfopInvalid = rule.expectedCfops.length > 0 && !rule.expectedCfops.includes(cfop);
                const isCstInvalid = rule.expectedCsts.length > 0 && !rule.expectedCsts.includes(cst);

                if (isCfopInvalid || isCstInvalid) {
                  status = 'DIVERGENT';
                  reason = `${rule.name}: ${rule.errorMessage} (CST/CFOP: ${cst}/${cfop})`;
                  break;
                }
              }
            }
          }

          if (status === 'OK' && matrizDiff) {
            status = 'DIVERGENT';
            reason = matrizDiffReason;
          }
        }

        list.push({ 
          doc, 
          item, 
          status, 
          reason, 
          xmlItem, 
          fuzzyMatch,
          matrizRule, 
          matrizDiff, 
          matrizDiffReason 
        });
      });
    }
    return list;
  }, [spedData, auditConfig, xmlItemMap, stateTaxRules]);

  // Helper for Excel-like cascading filters
  const itemMatchesFilters = (itemRow: { doc: SpedDocument; item: SpedItem; status: string; xmlItem: any; fuzzyMatch?: ItemMatchDetails | null; matrizDiff: boolean }, excludeKey?: string) => {
    const { doc, item, status, xmlItem, fuzzyMatch, matrizDiff } = itemRow;

    if (excludeKey !== 'status' && statusFilter.size > 0 && !statusFilter.has('ALL')) {
      let matchesAny = false;
      const isDocCancelado = ['02', '03', '04', '05'].includes(doc.codSit) || (xmlItem && xmlItem.isCancelada);
      if (statusFilter.has('OK') && status === 'OK' && !isDocCancelado) matchesAny = true;
      if (statusFilter.has('MALFORMED') && status === 'MALFORMED') matchesAny = true;
      if (statusFilter.has('DIVERGENT') && status === 'DIVERGENT') matchesAny = true;
      if (statusFilter.has('MATRIZ_DIFF') && matrizDiff) matchesAny = true;
      if (statusFilter.has('CANCELLED') && isDocCancelado) matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'oper' && operFilter.size > 0 && !operFilter.has('ALL')) {
      let matchesAny = false;
      if (operFilter.has('ENTRY') && doc.indOper === '0') matchesAny = true;
      if (operFilter.has('EXIT') && doc.indOper === '1') matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'xml' && xmlFilter.size > 0 && !xmlFilter.has('ALL')) {
      let matchesAny = false;
      if (xmlFilter.has('HAS_XML') && xmlItem) matchesAny = true;
      if (xmlFilter.has('MISSING_XML') && !xmlItem) matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'divergence' && divergenceTypeFilter.size > 0 && !divergenceTypeFilter.has('ALL')) {
      let matchesAny = false;
      for (const divType of divergenceTypeFilter) {
        if (divType === 'SEQUENCE_MISMATCH') {
          if (fuzzyMatch && fuzzyMatch.isSequenceMismatch) matchesAny = true;
        } else if (xmlItem) {
          if (divType === 'CST_DIF' && xmlItem.cst !== item.cstIcms) matchesAny = true;
          if (divType === 'CFOP_DIF' && xmlItem.cfop !== item.cfop) matchesAny = true;
          if (divType === 'ALIQ_DIF' && Math.abs((xmlItem.pIcms || 0) - (item.aliqIcms || 0)) > 0.01) matchesAny = true;
          if (divType === 'VALUE_DIF' && Math.abs((xmlItem.vProd || 0) - (item.vlItem || 0)) > 0.05) matchesAny = true;
        }
      }
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'cfop' && cfopFilter.size > 0 && !cfopFilter.has('ALL')) {
      if (!cfopFilter.has(item.cfop)) return false;
    }

    if (excludeKey !== 'cst' && cstFilter.size > 0 && !cstFilter.has('ALL')) {
      if (!cstFilter.has(item.cstIcms.trim().padStart(3, '0'))) return false;
    }

    if (excludeKey !== 'xmlCfop' && xmlCfopFilter.size > 0 && !xmlCfopFilter.has('ALL')) {
      const xCfop = xmlItem ? String(xmlItem.cfop || '').trim() : '';
      if (!xmlCfopFilter.has(xCfop)) return false;
    }

    if (excludeKey !== 'xmlCst' && xmlCstFilter.size > 0 && !xmlCstFilter.has('ALL')) {
      const xCst = xmlItem ? String(xmlItem.cst || '').trim().padStart(3, '0') : '';
      if (!xmlCstFilter.has(xCst)) return false;
    }

    if (excludeKey !== 'ncm' && ncmFilter.size > 0 && !ncmFilter.has('ALL')) {
      if (!ncmFilter.has(item.ncm.trim())) return false;
    }

    if (excludeKey !== 'product' && productFilter.size > 0 && !productFilter.has('ALL')) {
      if (!productFilter.has(item.codItem.trim())) return false;
    }

    if (excludeKey !== 'analyst' && analystFilter.size > 0 && !analystFilter.has('ALL')) {
      let matchesAny = false;
      if (analystFilter.has('CONFIRMED') && item.analystConfirmed) matchesAny = true;
      if (analystFilter.has('PENDING') && !item.analystConfirmed) matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'robot' && robotFilter.size > 0 && !robotFilter.has('ALL')) {
      let matchesAny = false;
      if (robotFilter.has('ROBOT_CORRECTED') && item.correctedByRobot) matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'modified' && modifiedFilter.size > 0 && !modifiedFilter.has('ALL')) {
      let matchesAny = false;
      const isModified = item.isModified || item.correctedByRobot;
      if (modifiedFilter.has('MODIFIED') && isModified) matchesAny = true;
      if (modifiedFilter.has('UNMODIFIED') && !isModified) matchesAny = true;
      if (!matchesAny) return false;
    }

    if (excludeKey !== 'search' && searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const searchChave = doc.chvNfe ? doc.chvNfe.toLowerCase() : '';
      const searchCnpj = doc.cnpjEmit ? doc.cnpjEmit.toLowerCase() : '';
      const xmlCfop = xmlItem && xmlItem.cfop ? String(xmlItem.cfop).toLowerCase() : '';
      const xmlCst = xmlItem && xmlItem.cst ? String(xmlItem.cst).toLowerCase() : '';
      const matches = (
        item.codItem.toLowerCase().includes(term) ||
        item.descrItem.toLowerCase().includes(term) ||
        doc.numDoc.toLowerCase().includes(term) ||
        searchCnpj.includes(term) ||
        item.ncm.toLowerCase().includes(term) ||
        searchChave.includes(term) ||
        item.cfop.toLowerCase().includes(term) ||
        item.cstIcms.toLowerCase().includes(term) ||
        xmlCfop.includes(term) ||
        xmlCst.includes(term)
      );
      if (!matches) return false;
    }

    return true;
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return enrichedItems.filter(i => itemMatchesFilters(i));
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCfopFilter, xmlCstFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  // Unique CFOPs and CSTs for SPED (cascading / Excel-like)
  const uniqueCfops = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'cfop')).forEach(i => { if (i.item.cfop) set.add(i.item.cfop); });
    return Array.from(set).sort();
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cstFilter, xmlCfopFilter, xmlCstFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  const uniqueCsts = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'cst')).forEach(i => { if (i.item.cstIcms) set.add(i.item.cstIcms.trim().padStart(3, '0')); });
    return Array.from(set).sort();
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, xmlCfopFilter, xmlCstFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  // Unique NCMs and Products (cascading)
  const uniqueNcms = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'ncm')).forEach(i => { if (i.item.ncm) set.add(i.item.ncm.trim()); });
    return Array.from(set).sort();
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCfopFilter, xmlCstFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  const uniqueProducts = useMemo(() => {
    const map = new Map<string, string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'product')).forEach(i => {
      if (i.item.codItem) {
        map.set(i.item.codItem.trim(), i.item.descrItem ? `${i.item.codItem} - ${i.item.descrItem}` : i.item.codItem);
      }
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCfopFilter, xmlCstFilter, ncmFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  // Unique CFOPs and CSTs for XML (cascading)
  const uniqueXmlCfops = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'xmlCfop')).forEach(i => {
      if (i.xmlItem && i.xmlItem.cfop) {
        set.add(String(i.xmlItem.cfop).trim());
      }
    });
    return Array.from(set).sort();
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCstFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  const uniqueXmlCsts = useMemo(() => {
    const set = new Set<string>();
    enrichedItems.filter(i => itemMatchesFilters(i, 'xmlCst')).forEach(i => {
      if (i.xmlItem && i.xmlItem.cst !== undefined && i.xmlItem.cst !== null && String(i.xmlItem.cst).trim() !== '') {
        set.add(String(i.xmlItem.cst).trim().padStart(3, '0'));
      }
    });
    return Array.from(set).sort();
  }, [enrichedItems, statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCfopFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  // Active filters count helper
  const activeFiltersCount = useMemo(() => {
    let cnt = 0;
    if (statusFilter.size > 0 && !statusFilter.has('ALL')) cnt++;
    if (operFilter.size > 0 && !operFilter.has('ALL')) cnt++;
    if (xmlFilter.size > 0 && !xmlFilter.has('ALL')) cnt++;
    if (divergenceTypeFilter.size > 0 && !divergenceTypeFilter.has('ALL')) cnt++;
    if (cfopFilter.size > 0 && !cfopFilter.has('ALL')) cnt++;
    if (cstFilter.size > 0 && !cstFilter.has('ALL')) cnt++;
    if (xmlCfopFilter.size > 0 && !xmlCfopFilter.has('ALL')) cnt++;
    if (xmlCstFilter.size > 0 && !xmlCstFilter.has('ALL')) cnt++;
    if (ncmFilter.size > 0 && !ncmFilter.has('ALL')) cnt++;
    if (productFilter.size > 0 && !productFilter.has('ALL')) cnt++;
    if (analystFilter.size > 0 && !analystFilter.has('ALL')) cnt++;
    if (robotFilter.size > 0 && !robotFilter.has('ALL')) cnt++;
    if (modifiedFilter.size > 0 && !modifiedFilter.has('ALL')) cnt++;
    if (searchTerm.trim() !== '') cnt++;
    return cnt;
  }, [statusFilter, operFilter, xmlFilter, divergenceTypeFilter, cfopFilter, cstFilter, xmlCfopFilter, xmlCstFilter, ncmFilter, productFilter, analystFilter, robotFilter, modifiedFilter, searchTerm]);

  const resetAllFilters = () => {
    setStatusFilter(new Set(['ALL']));
    setOperFilter(new Set(['ALL']));
    setXmlFilter(new Set(['ALL']));
    setDivergenceTypeFilter(new Set(['ALL']));
    setCfopFilter(new Set(['ALL']));
    setCstFilter(new Set(['ALL']));
    setXmlCfopFilter(new Set(['ALL']));
    setXmlCstFilter(new Set(['ALL']));
    setNcmFilter(new Set(['ALL']));
    setProductFilter(new Set(['ALL']));
    setAnalystFilter(new Set(['ALL']));
    setRobotFilter(new Set(['ALL']));
    setModifiedFilter(new Set(['ALL']));
    setSearchTerm('');
    setCurrentPage(1);
    try {
      sessionStorage.removeItem(C170_FILTERS_STORAGE_KEY);
    } catch (e) {}
  };

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage]);

  // Counts
  const counts = useMemo(() => {
    const ok = enrichedItems.filter(i => i.status === 'OK').length;
    const malformed = enrichedItems.filter(i => i.status === 'MALFORMED').length;
    const divergent = enrichedItems.filter(i => i.status === 'DIVERGENT').length;
    const matrizDiffCount = enrichedItems.filter(i => i.matrizDiff).length;
    const entries = enrichedItems.filter(i => i.doc.indOper === '0').length;
    const exits = enrichedItems.filter(i => i.doc.indOper === '1').length;
    const withXml = enrichedItems.filter(i => !!i.xmlItem).length;
    const missingXml = enrichedItems.filter(i => !i.xmlItem).length;
    const cancelledCount = enrichedItems.filter(i => ['02', '03', '04', '05'].includes(i.doc.codSit) || (i.xmlItem && i.xmlItem.isCancelada)).length;
    return { total: enrichedItems.length, ok, malformed, divergent, matrizDiffCount, cancelledCount, entries, exits, withXml, missingXml };
  }, [enrichedItems]);

  // Dynamic Totalizers calculation based on filtered items (SPED vs XML)
  const totals = useMemo(() => {
    let spedVlItem = 0;
    let spedVlBcIcms = 0;
    let spedVlIcms = 0;

    let xmlVlItem = 0;
    let xmlVlBcIcms = 0;
    let xmlVlIcms = 0;

    let itemsWithXmlCount = 0;

    filteredItems.forEach(({ item, xmlItem }) => {
      spedVlItem += item.vlItem || 0;
      spedVlBcIcms += item.vlBcIcms || 0;
      spedVlIcms += item.vlIcms || 0;

      if (xmlItem) {
        itemsWithXmlCount++;
        xmlVlItem += (xmlItem.vProd ?? xmlItem.vItem ?? xmlItem.vlItem ?? 0);
        xmlVlBcIcms += (xmlItem.vBc ?? xmlItem.vBcIcms ?? xmlItem.vlBcIcms ?? 0);
        xmlVlIcms += (xmlItem.vIcms ?? xmlItem.vlIcms ?? 0);
      }
    });

    const diffVlItem = spedVlItem - xmlVlItem;
    const diffVlBcIcms = spedVlBcIcms - xmlVlBcIcms;
    const diffVlIcms = spedVlIcms - xmlVlIcms;

    return {
      itemCount: filteredItems.length,
      itemsWithXmlCount,
      spedVlItem,
      spedVlBcIcms,
      spedVlIcms,
      xmlVlItem,
      xmlVlBcIcms,
      xmlVlIcms,
      diffVlItem,
      diffVlBcIcms,
      diffVlIcms
    };
  }, [filteredItems]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedKeys.size === filteredItems.length) {
      setSelectedKeys(new Set());
    } else {
      const allKeys = new Set(filteredItems.map(i => `${i.doc.id}_${i.item.numItem}`));
      setSelectedKeys(allKeys);
    }
  };

  const toggleSelectItem = (docId: string, itemNum: string) => {
    const key = `${docId}_${itemNum}`;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const handleBulkApply = (mode: 'manual' | 'xml' | 'matriz') => {
    if (!onBulkUpdateItems || selectedKeys.size === 0) return;
    const targets = Array.from(selectedKeys).map(k => {
      const lastUnderscore = k.lastIndexOf('_');
      return {
        docId: k.substring(0, lastUnderscore),
        itemNum: k.substring(lastUnderscore + 1)
      };
    });

    onBulkUpdateItems(targets, {
      ncm: bulkNcmInput.trim() || undefined,
      cst: bulkCstInput.trim() || undefined,
      cfop: bulkCfopInput.trim() || undefined,
      vlBcIcms: bulkVlBcInput.trim() !== '' ? parseFloat(bulkVlBcInput.replace(',', '.')) : undefined,
      aliqIcms: bulkAliqInput.trim() !== '' ? parseFloat(bulkAliqInput.replace(',', '.')) : undefined,
      vlIcms: bulkVlIcmsInput.trim() !== '' ? parseFloat(bulkVlIcmsInput.replace(',', '.')) : undefined,
      applyXml: mode === 'xml',
      applyMatriz: mode === 'matriz'
    });

    setSelectedKeys(new Set());
    setBulkNcmInput('');
    setBulkCstInput('');
    setBulkCfopInput('');
    setBulkVlBcInput('');
    setBulkAliqInput('');
    setBulkVlIcmsInput('');
  };

  const handleFixIcmsBaseAll = () => {
    if (!onBulkUpdateItems) return;
    const itemsWithIcmsDiff = enrichedItems.filter(i => {
      if (!i.xmlItem) return false;
      const bcDiff = Math.abs((i.item.vlBcIcms || 0) - (i.xmlItem.vBc ?? i.xmlItem.vProd ?? 0)) > 0.05;
      const icmsDiff = Math.abs((i.item.vlIcms || 0) - (i.xmlItem.vIcms ?? 0)) > 0.05;
      return bcDiff || icmsDiff;
    });

    if (itemsWithIcmsDiff.length === 0) {
      alert('Nenhuma divergência de Base de ICMS ou Valor de ICMS identificada em relação aos XMLs vinculados.');
      return;
    }

    const confirmFix = window.confirm(
      `Identificamos ${itemsWithIcmsDiff.length} item(ns) com diferença de Base/Valor de ICMS entre o SPED e o XML. Deseja aplicar os valores do XML automaticamente em todos eles?`
    );

    if (confirmFix) {
      const targets = itemsWithIcmsDiff.map(i => ({
        docId: i.doc.id,
        itemNum: i.item.numItem
      }));
      onBulkUpdateItems(targets, { applyXml: true });
    }
  };

  // Calculate SPED C100 documents missing XMLs
  const missingXmlDocs = useMemo(() => {
    if (!spedData || !spedData.documents) return [];

    const xmlByChv = new Set<string>();
    const xmlByDocKey = new Set<string>();

    (xmlRecords || []).forEach(x => {
      if (x.chvNfe) xmlByChv.add(x.chvNfe.replace(/\D/g, ''));
      if (x.nNF) {
        const cleanNum = x.nNF.replace(/^0+/, '');
        const cleanSerie = (x.serie || '0').replace(/^0+/, '');
        xmlByDocKey.add(`${cleanNum}_${cleanSerie}`);
        xmlByDocKey.add(cleanNum);
      }
    });

    return spedData.documents.filter(doc => {
      if (['02', '03', '04', '05'].includes(doc.codSit)) return false;

      const cleanChv = doc.chvNfe ? doc.chvNfe.replace(/\D/g, '') : '';
      const cleanNum = doc.numDoc ? doc.numDoc.replace(/^0+/, '') : '';
      const cleanSerie = (doc.serie || '0').replace(/^0+/, '');

      let hasMatch = false;
      if (cleanChv && xmlByChv.has(cleanChv)) {
        hasMatch = true;
      } else if (cleanNum && (xmlByDocKey.has(`${cleanNum}_${cleanSerie}`) || xmlByDocKey.has(cleanNum))) {
        hasMatch = true;
      }

      return !hasMatch;
    });
  }, [spedData, xmlRecords]);

  // Calculate XMLs imported that are missing in SPED (Notas Omissas)
  const omissaXmls = useMemo(() => {
    if (!spedData || !xmlRecords || xmlRecords.length === 0) return [];
    const spedChaves = new Set(
      spedData.documents
        .map(d => (d.chvNfe || '').replace(/\D/g, ''))
        .filter(Boolean)
    );
    const spedDocNums = new Set(
      spedData.documents
        .map(d => (d.numDoc || '').replace(/^0+/, ''))
        .filter(Boolean)
    );

    return xmlRecords.filter(x => {
      if (x.isCancelada) return false;
      const cleanChv = (x.chvNfe || '').replace(/\D/g, '');
      const cleanNum = (x.nNF || '').replace(/^0+/, '');
      const inSpedByChv = cleanChv && spedChaves.has(cleanChv);
      const inSpedByNum = cleanNum && spedDocNums.has(cleanNum);
      return !inSpedByChv && !inSpedByNum;
    });
  }, [spedData, xmlRecords]);

  const totalMissingXmlCount = missingXmlDocs.length + omissaXmls.length;

  const handleExportMissingXmlPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('helvetica');

      // Title & Header Banner
      doc.setFillColor(30, 58, 95); // Navy
      doc.rect(0, 0, 210, 28, 'F');

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('RELATÓRIO DE NOTAS FISCAIS E XMLS FALTANTES / OMISSOS', 14, 16);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const empresa = spedData?.header?.nome || 'Empresa Cliente';
      doc.text(`Empresa: ${empresa} | Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 23);

      let cursorY = 36;

      // Executive Summary
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('Resumo Executivo de Inconsistências de XML', 14, cursorY);
      cursorY += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(`Total de Notas no SPED C100 sem XML correspondente: ${missingXmlDocs.length}`, 14, cursorY);
      cursorY += 5;
      doc.text(`Total de XMLs terceiros sem escrituração no SPED (Omissas): ${omissaXmls.length}`, 14, cursorY);
      cursorY += 10;

      // Table 1: SPED Docs missing XML
      if (missingXmlDocs.length > 0) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(180, 83, 9); // Amber-700
        doc.text(`1. Documentos no SPED C100 sem Arquivo XML (${missingXmlDocs.length})`, 14, cursorY);

        const tableData1 = missingXmlDocs.map(d => [
          d.numDoc || '-',
          d.serie || '1',
          d.dtDoc || '-',
          (d.chvNfe || 'Sem Chave NFe').substring(0, 44),
          ((d as any).nomeEmit || d.cnpjEmit || 'Fornecedor').substring(0, 28),
          `R$ ${(d.vlDoc || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
          startY: cursorY + 4,
          head: [['Nº Doc', 'Série', 'Data', 'Chave NFe / CTe', 'Emitente / CNPJ', 'Valor Total']],
          body: tableData1,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [30, 58, 95], textColor: 255 }
        });

        cursorY = (doc as any).lastAutoTable.finalY + 12;
      }

      // Table 2: Omitted XMLs
      if (omissaXmls.length > 0) {
        if (cursorY > 230) {
          doc.addPage();
          cursorY = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(190, 18, 60); // Rose-700
        doc.text(`2. XMLs de Terceiros sem Escrituração no SPED (${omissaXmls.length})`, 14, cursorY);

        const tableData2 = omissaXmls.map(x => [
          x.nNF || '-',
          x.serie || '1',
          x.dhEmi ? x.dhEmi.substring(0, 10) : '-',
          (x.chvNfe || '-').substring(0, 44),
          (x.emitNome || x.emitCnpj || 'Emitente').substring(0, 28),
          `R$ ${(x.vNF || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
          startY: cursorY + 4,
          head: [['Nº NF', 'Série', 'Data Emissão', 'Chave NFe', 'Emitente', 'Valor Total']],
          body: tableData2,
          theme: 'grid',
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [180, 83, 9], textColor: 255 }
        });
      }

      doc.save(`Relatorio_Notas_Faltantes_XML_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF de XMLs faltantes:', e);
      alert('Erro ao gerar relatório de XMLs faltantes em PDF.');
    }
  };

  const handleExportMissingXmlCSV = () => {
    const headers = ['Tipo_Inconsistência', 'Numero_Doc', 'Serie', 'Data', 'Chave_NFe', 'CNPJ_Emitente', 'Razao_Social', 'Valor_Total'];
    const rows1 = missingXmlDocs.map(d => [
      '"SPED_SEM_XML"',
      `"${d.numDoc || ''}"`,
      `"${d.serie || ''}"`,
      `"${d.dtDoc || ''}"`,
      `"${d.chvNfe || ''}"`,
      `"${d.cnpjEmit || ''}"`,
      `"${((d as any).nomeEmit || '').replace(/"/g, '""')}"`,
      (d.vlDoc || 0).toFixed(2)
    ]);
    const rows2 = omissaXmls.map(x => [
      '"XML_SEM_SPED_OMISSA"',
      `"${x.nNF || ''}"`,
      `"${x.serie || ''}"`,
      `"${x.dhEmi || ''}"`,
      `"${x.chvNfe || ''}"`,
      `"${x.emitCnpj || ''}"`,
      `"${(x.emitNome || '').replace(/"/g, '""')}"`,
      (x.vNF || 0).toFixed(2)
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows1.map(r => r.join(';')), ...rows2.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lista_Notas_e_XMLs_Faltantes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const handleExportCsv = () => {
    const headers = ['Documento', 'Data', 'Emitente', 'Item', 'Código', 'Descrição', 'NCM SPED', 'NCM XML', 'NCM Matriz', 'CFOP SPED', 'CST SPED', 'Valor Item', 'Aliq ICMS SPED', 'Status', 'Motivo'];
    const rows = filteredItems.map(({ doc, item, status, reason, xmlItem, matrizRule }) => [
      doc.numDoc,
      doc.dtDoc || '',
      doc.cnpjEmit,
      item.numItem,
      item.codItem,
      `"${(item.descrItem || '').replace(/"/g, '""')}"`,
      item.ncm || '',
      xmlItem?.ncm || '',
      matrizRule?.ncmPrefix || '',
      item.cfop || '',
      item.cstIcms || '',
      typeof item.vlItem === 'number' ? item.vlItem.toFixed(2).replace('.', ',') : (item.vlItem || ''),
      typeof item.aliqIcms === 'number' ? item.aliqIcms.toFixed(2).replace('.', ',') : (item.aliqIcms || 0),
      status,
      `"${reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `atlas_itens_comparativo_sped_xml_matriz.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Editing modal active xml & matriz data
  const editingXmlItem = useMemo(() => {
    if (!editingItemData || !spedData) return null;
    const doc = spedData.documents.find(d => d.id === editingItemData.docId);
    if (!doc) return null;
    const idx = doc.items.findIndex(i => i.numItem === editingItemData.item.numItem);
    return getXmlItemForSped(doc, editingItemData.item, idx >= 0 ? idx : 0);
  }, [editingItemData, spedData, xmlItemMap]);

  const editingMatrizRule = useMemo(() => {
    if (!editingItemData || stateTaxRules.length === 0) return null;
    const ncmClean = (editNcm || editingItemData.item.ncm || '').trim();
    const companyUf = (spedData?.header.uf || 'SP').trim().toUpperCase();
    return stateTaxRules.find(r => {
      const prefix = (r.ncmPrefix || '').trim();
      const match = prefix ? ncmClean.startsWith(prefix) : false;
      const uf = (r.uf || 'ALL').trim().toUpperCase();
      return match && (uf === 'ALL' || uf === companyUf);
    });
  }, [editingItemData, editNcm, stateTaxRules, spedData]);

  const applyXmlToModal = () => {
    if (!editingXmlItem) return;
    if (editingXmlItem.cst) setEditCst(editingXmlItem.cst);
    if (editingXmlItem.cfop) {
      const isEntry = editingItemData
        ? (editingItemData.item.cfop.startsWith('1') || editingItemData.item.cfop.startsWith('2'))
        : true;
      setEditCfop(mapXmlCfopToEntryCfop(editingXmlItem.cfop, isEntry));
    }
    if (editingXmlItem.vProd !== undefined || editingXmlItem.vItem !== undefined) {
      setEditVlItem(String(editingXmlItem.vProd ?? editingXmlItem.vItem ?? 0));
    }
    if (editingXmlItem.vBc !== undefined) setEditVlBc(String(editingXmlItem.vBc));
    if (editingXmlItem.pIcms !== undefined) setEditAliq(String(editingXmlItem.pIcms));
    if (editingXmlItem.vIcms !== undefined) setEditVlIcms(String(editingXmlItem.vIcms));
  };

  const applyMatrizToModal = () => {
    if (!editingMatrizRule) return;
    if (editingMatrizRule.ncmPrefix) setEditNcm(editingMatrizRule.ncmPrefix);
    if (editingMatrizRule.expectedCst) setEditCst(editingMatrizRule.expectedCst);
    if (editingMatrizRule.expectedAliqIcms !== undefined && editingMatrizRule.expectedAliqIcms !== null) {
      setEditAliq(String(editingMatrizRule.expectedAliqIcms));
      const bc = parseFloat(editVlBc.replace(',', '.')) || editingItemData?.item.vlBcIcms || 0;
      const calculatedIcms = (bc * editingMatrizRule.expectedAliqIcms) / 100;
      setEditVlIcms(calculatedIcms.toFixed(2));
    }
    if (Array.isArray(editingMatrizRule.expectedCfop) && editingMatrizRule.expectedCfop.length > 0) {
      setEditCfop(editingMatrizRule.expectedCfop[0]);
    }
  };

  const handleRunRobotC170Correction = () => {
    if (!onBulkUpdateItems || stateTaxRules.length === 0) {
      alert('Para executar o robô C170, é necessário ter regras cadastradas na Matriz Tributária Estadual.');
      return;
    }

    const divergentItems = enrichedItems.filter(i => {
      if (!i.matrizRule) return false;
      const rule = i.matrizRule;
      const expCst = rule.expectedCst ? rule.expectedCst.padStart(3, '0') : '';
      const curCst = (i.item.cstIcms || '').padStart(3, '0');
      const isCstDiff = expCst ? curCst !== expCst : false;
      const expCfops = Array.isArray(rule.expectedCfop) ? rule.expectedCfop : [];
      const isCfopDiff = expCfops.length > 0 && !expCfops.includes(i.item.cfop);
      return isCstDiff || isCfopDiff;
    });

    if (divergentItems.length === 0) {
      alert('Nenhum item divergente de CST ou CFOP em relação à Matriz Tributária foi encontrado para correção automática pelo robô.');
      return;
    }

    const confirmRun = window.confirm(
      `🤖 Robô C170: O robô identificou ${divergentItems.length} item(ns) com divergência de CST e/ou CFOP em relação à Matriz Tributária. Deseja realizar a correção automática e registrar na base de aprendizagem constante?`
    );

    if (confirmRun) {
      const targets = divergentItems.map(i => ({
        docId: i.doc.id,
        itemNum: i.item.numItem
      }));

      onBulkUpdateItems(targets, {
        applyMatriz: true,
        correctedByRobot: true,
        robotCorrectionReason: 'Corrigido pelo Robô C170: CST e/ou CFOP ajustados conforme Matriz Tributária Estadual com Aprendizagem Contínua'
      });

      const newCount = learnedPatternsCount + divergentItems.length;
      setLearnedPatternsCount(newCount);
      localStorage.setItem('atlas_learned_patterns_count', String(newCount));

      alert(`✅ Robô C170 executado com sucesso!\n- ${divergentItems.length} itens corrigidos (CST e CFOP).\n- Aprendizagem Constante: Padrões tributários assimilados e memorizados (${newCount} regras ativas na IA).`);
    }
  };

  const handleToggleAnalystConfirm = (docId: string, itemNum: string, currentStatus?: boolean) => {
    if (!onUpdateItem) return;
    const itemRow = enrichedItems.find(i => i.doc.id === docId && i.item.numItem === itemNum);
    if (!itemRow) return;
    const nextStatus = !currentStatus;

    onUpdateItem(
      docId,
      itemNum,
      itemRow.item.cstIcms,
      itemRow.item.cfop,
      itemRow.item.vlBcIcms,
      itemRow.item.aliqIcms,
      itemRow.item.vlIcms,
      itemRow.item.ncm,
      itemRow.item.vlItem,
      itemRow.item.correctedByRobot,
      itemRow.item.robotCorrectionReason,
      nextStatus
    );
  };

  const handleBulkAnalystConfirm = (confirm: boolean) => {
    if (!onBulkUpdateItems || selectedKeys.size === 0) return;
    const targets = Array.from(selectedKeys).map(k => {
      const lastUnderscore = k.lastIndexOf('_');
      return {
        docId: k.substring(0, lastUnderscore),
        itemNum: k.substring(lastUnderscore + 1)
      };
    });

    onBulkUpdateItems(targets, {
      analystConfirmed: confirm
    });
    setSelectedKeys(new Set());
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-lg p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Layers className="w-6 h-6 text-[#1e3a5f]" />
            <h1 className="text-xl font-extrabold text-[#1e3a5f] tracking-tight">
              Todos os Itens & Comparativo SPED vs XML vs Matriz Fiscal
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Confronto minucioso entre o SPED EFD (C170), os arquivos XML das notas e o Banco de Dados de Regras Tributárias estaduais.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasHistory && onUndoChanges && (
            <button
              onClick={onUndoChanges}
              className="px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <span>Desfazer Alterações</span>
            </button>
          )}

          <button
            onClick={handleFixIcmsBaseAll}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs"
            title="Ajustar automaticamente todas as diferenças de base e valor de ICMS com base nos arquivos XML"
          >
            <RefreshCw className="w-4 h-4 text-white" />
            <span>Ajustar Bases ICMS pelo XML</span>
          </button>

          {onExportSped && (
            <button
              onClick={onExportSped}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
            >
              <FileText className="w-4 h-4" />
              <span>Exportar SPED Ajustado TXT</span>
            </button>
          )}

          {onRecalculateStructure && (
            <button
              onClick={onRecalculateStructure}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs"
              title="Sincronizar Estrutura C100/C190: Força o recálculo dos totais dos blocos C190 baseados nos itens atuais do SPED, corrigindo eventuais duplicidades de registros órfãos"
            >
              <RefreshCw className="w-4 h-4 text-white" />
              <span>Sincronizar Estrutura C100/C190</span>
            </button>
          )}

          <button
            onClick={handleRunRobotC170Correction}
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-sm"
            title="Atuação do Robô C170: Corrige automaticamente CST e CFOP divergentes com base na Matriz Tributária e Aprendizagem Constante"
          >
            <RefreshCw className="w-4 h-4 text-white animate-spin-slow" />
            <span>🤖 Executar Robô C170 (CST/CFOP)</span>
          </button>

          <button
            onClick={handleExportMissingXmlPDF}
            className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs"
            title="Exportar relatório em PDF das notas fiscais e XMLs faltantes/omissos"
          >
            <FileText className="w-4 h-4 text-white" />
            <span>Exportar Notas Faltantes</span>
            {totalMissingXmlCount > 0 && (
              <span className="bg-[#1e3a5f] text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ml-1">
                {totalMissingXmlCount}
              </span>
            )}
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-xs"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Lembrete Discreto: XMLs Faltantes ou Omissos */}
      {totalMissingXmlCount > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5 min-w-0">
            <span className="inline-flex items-center justify-center p-1 bg-amber-100 text-amber-800 rounded-md shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-700" />
            </span>
            <div className="flex items-center space-x-2 flex-wrap text-slate-800">
              <span className="font-bold text-amber-950">Notas Faltantes:</span>
              <span className="bg-amber-200/80 text-amber-950 font-extrabold px-2 py-0.5 rounded-md text-[11px] border border-amber-300/50">
                {totalMissingXmlCount} pendência(s)
              </span>
              <span className="text-slate-600 hidden md:inline">
                ({missingXmlDocs.length} SPED sem XML | {omissaXmls.length} XMLs sem SPED)
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={() => setMissingXmlModalOpen(true)}
              className="px-2.5 py-1 bg-white hover:bg-amber-100/60 text-amber-900 border border-amber-300/80 rounded-lg font-bold text-[11px] transition-colors flex items-center space-x-1 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-700" />
              <span>Ver Detalhes</span>
            </button>

            <button
              onClick={handleExportMissingXmlPDF}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
              title="Baixar relatório PDF das notas faltantes"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Faltantes</span>
            </button>

            <button
              onClick={handleExportMissingXmlCSV}
              className="px-2.5 py-1 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-lg font-bold text-[11px] transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
              title="Baixar planilha CSV das notas faltantes"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      )}

      {/* Aprendizagem Constante & Status Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-[#1e3a5f] to-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 border border-purple-800/50">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm">
            <RefreshCw className="w-6 h-6 text-purple-300 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2">
              <span>Módulo Robô C170 & Aprendizagem Constante Ativa</span>
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">IA Ativa</span>
            </h2>
            <p className="text-xs text-purple-200 mt-0.5">
              O robô atua no painel C170 validando e corrigindo autonomamente divergências de **CST e CFOP** com confirmação da Matriz. Cada conferência e ajuste alimenta o motor de **aprendizagem constante** para auditorias futuras.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/10 px-5 py-2.5 rounded-xl backdrop-blur-sm text-xs font-mono shrink-0 border border-white/10">
          <div>
            <span className="block text-[10px] text-purple-300 uppercase tracking-wider">Padrões Aprendidos:</span>
            <span className="font-bold text-white text-sm">{learnedPatternsCount} regras</span>
          </div>
          <div className="border-l border-white/20 pl-4">
            <span className="block text-[10px] text-purple-300 uppercase tracking-wider">Conferência Analista:</span>
            <span className="font-bold text-emerald-300 text-sm">
              {enrichedItems.filter(i => i.item.analystConfirmed).length} / {counts.total} conferidos
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Totalizers (Recalculated automatically on filter changes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Valor Total dos Produtos / Itens */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-4 h-4 text-blue-600" />
              <span>Valor Total dos Produtos (vlItem)</span>
              <FiscalTooltip
                title="Valor Total dos Produtos (Registro C170 / XML)"
                description="Totalização dos valores brutos dos itens escriturados no Registro C170 do SPED e confrontados com a soma da tag <vProd> dos XMLs de NFe vinculados."
                lawRef="Guia Prático EFD ICMS/IPI - Registro C170, Campo 07"
                badge="C170 vs XML"
              />
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {totals.itemCount} item(ns)
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">SPED (C170):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.spedVlItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">XML (Notas):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.xmlVlItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Diferença SPED - XML:</span>
              <span className={`font-bold font-mono px-2 py-0.5 rounded-md text-xs ${
                Math.abs(totals.diffVlItem) <= 0.05
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {totals.diffVlItem.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Base de Cálculo do ICMS */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-indigo-600" />
              <span>Base de Cálculo ICMS (vlBcIcms)</span>
              <FiscalTooltip
                title="Base de Cálculo do ICMS (Regra de Entrada/Saída)"
                description="Valor sobre o qual incide a alíquota. Nas entradas de ativo/uso consumo, a BC deve conferir com a nota do fornecedor. Em operações com isenção ou redução, a BC é menor que o valor total do item."
                lawRef="Art. 13 da Lei Complementar nº 87/1996"
                badge="LC 87/96"
              />
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
              {totals.itemsWithXmlCount} c/ XML
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">SPED (C170):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.spedVlBcIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">XML (Notas):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.xmlVlBcIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Diferença SPED - XML:</span>
              <span className={`font-bold font-mono px-2 py-0.5 rounded-md text-xs ${
                Math.abs(totals.diffVlBcIcms) <= 0.05
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {totals.diffVlBcIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Valor do ICMS */}
        <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Valor do ICMS (vlIcms)</span>
              <FiscalTooltip
                title="Imposto Debitado ou Creditado"
                description="O crédito de ICMS em entradas só é permitido quando a mercadoria se destina a comercialização, industrialização ou insumos tributados na saída. Imobilizado possui apropriação via CIAP (1/48 avos)."
                lawRef="Art. 19 e 20 da Lei Complementar nº 87/1996"
                badge="Crédito / Débito"
              />
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s)` : 'Todos os registros'}
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">SPED (C170):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.spedVlIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-600 font-medium">XML (Notas):</span>
              <span className="font-bold font-mono text-slate-900 text-sm">
                {totals.xmlVlIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-semibold">Diferença SPED - XML:</span>
              <span className={`font-bold font-mono px-2 py-0.5 rounded-md text-xs ${
                Math.abs(totals.diffVlIcms) <= 0.05
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {totals.diffVlIcms.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        {/* Filters and Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col space-y-3">
          {/* Row 1: Status pills & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => { setStatusFilter(new Set(['ALL'])); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter.has('ALL') ? 'bg-[#1e3a5f] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Todos ({counts.total})
              </button>
              <button
                onClick={() => { setStatusFilter(new Set(['OK'])); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter.has('OK') ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                Conformes ({counts.ok})
              </button>
              <button
                onClick={() => { setStatusFilter(new Set(['DIVERGENT'])); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter.has('DIVERGENT') ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                Divergentes ({counts.divergent})
              </button>
              <button
                onClick={() => { setStatusFilter(new Set(['CANCELLED'])); setCurrentPage(1); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  statusFilter.has('CANCELLED') ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                Cancelados ({counts.cancelledCount})
              </button>

              {stateTaxRules.length > 0 && (
                <button
                  onClick={() => { setStatusFilter(new Set(['MATRIZ_DIFF'])); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1 ${
                    statusFilter.has('MATRIZ_DIFF') ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Divergência Matriz/Banco ({counts.matrizDiffCount})</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar item, NCM, doc, CNPJ, chave..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1e3a5f] bg-white shadow-2xs"
              />
            </div>
          </div>

          {/* Row 2: Precision Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 text-xs">
            <div className="flex items-center text-slate-500 font-semibold text-[11px] mr-1">
              <Filter className="w-3.5 h-3.5 mr-1" />
              <span>Filtros Precisos:</span>
            </div>

            {/* Operation Type Filter */}
            <MultiSelectDropdown
              label="Operação"
              options={[
                { value: 'ENTRY', label: `Entradas [0] (${counts.entries})` },
                { value: 'EXIT', label: `Saídas [1] (${counts.exits})` }
              ]}
              selectedValues={operFilter}
              onChange={(val) => { setOperFilter(val); setCurrentPage(1); }}
            />

            {/* XML Link Filter */}
            <MultiSelectDropdown
              label="Vínculo XML"
              options={[
                { value: 'HAS_XML', label: `Com XML Vinculado (${counts.withXml})` },
                { value: 'MISSING_XML', label: `Sem XML / Omissos (${counts.missingXml})` }
              ]}
              selectedValues={xmlFilter}
              onChange={(val) => { setXmlFilter(val); setCurrentPage(1); }}
            />

            {/* Analyst Check Filter */}
            <MultiSelectDropdown
              label="Analista"
              options={[
                { value: 'CONFIRMED', label: '✅ Conferido pelo Analista' },
                { value: 'PENDING', label: '⏳ Pendente de Conferência' }
              ]}
              selectedValues={analystFilter}
              onChange={(val) => { setAnalystFilter(val); setCurrentPage(1); }}
            />

            {/* Robot Correction Filter */}
            <MultiSelectDropdown
              label="Robô C170"
              options={[
                { value: 'ROBOT_CORRECTED', label: '🤖 Corrigido pelo Robô' }
              ]}
              selectedValues={robotFilter}
              onChange={(val) => { setRobotFilter(val); setCurrentPage(1); }}
            />

            {/* Modified Status Filter */}
            <MultiSelectDropdown
              label="Status de Alteração"
              options={[
                { value: 'MODIFIED', label: 'Itens Modificados / Alterados' },
                { value: 'UNMODIFIED', label: 'Itens Não Alterados' }
              ]}
              selectedValues={modifiedFilter}
              onChange={(val) => { setModifiedFilter(val); setCurrentPage(1); }}
            />

            {/* Divergence Type Filter */}
            <MultiSelectDropdown
              label="Tipo de Divergência"
              options={[
                { value: 'CST_DIF', label: 'Divergência de CST' },
                { value: 'CFOP_DIF', label: 'Divergência de CFOP' },
                { value: 'ALIQ_DIF', label: 'Divergência de Alíquota ICMS' },
                { value: 'VALUE_DIF', label: 'Divergência de Valor' },
                { value: 'SEQUENCE_MISMATCH', label: 'Desalinhamento de Sequência (SPED x XML)' }
              ]}
              selectedValues={divergenceTypeFilter}
              onChange={(val) => { setDivergenceTypeFilter(val); setCurrentPage(1); }}
            />

            {/* CFOP SPED Filter */}
            <MultiSelectDropdown
              label="CFOP SPED"
              options={uniqueCfops.map(cfop => ({ value: cfop, label: `CFOP ${cfop}` }))}
              selectedValues={cfopFilter}
              onChange={(val) => { setCfopFilter(val); setCurrentPage(1); }}
            />

            {/* CST SPED Filter */}
            <MultiSelectDropdown
              label="CST SPED"
              options={uniqueCsts.map(cst => ({ value: cst, label: `CST ${cst}` }))}
              selectedValues={cstFilter}
              onChange={(val) => { setCstFilter(val); setCurrentPage(1); }}
            />

            {/* CFOP XML Filter */}
            <MultiSelectDropdown
              label="CFOP XML"
              options={uniqueXmlCfops.map(cfop => ({ value: cfop, label: `CFOP XML ${cfop}` }))}
              selectedValues={xmlCfopFilter}
              onChange={(val) => { setXmlCfopFilter(val); setCurrentPage(1); }}
            />

            {/* CST XML Filter */}
            <MultiSelectDropdown
              label="CST XML"
              options={uniqueXmlCsts.map(cst => ({ value: cst, label: `CST XML ${cst}` }))}
              selectedValues={xmlCstFilter}
              onChange={(val) => { setXmlCstFilter(val); setCurrentPage(1); }}
            />

            {/* NCM Filter */}
            <MultiSelectDropdown
              label="NCM"
              options={uniqueNcms.map(ncm => ({ value: ncm, label: `NCM ${ncm}` }))}
              selectedValues={ncmFilter}
              onChange={(val) => { setNcmFilter(val); setCurrentPage(1); }}
            />

            {/* Product Filter */}
            <MultiSelectDropdown
              label="Produto"
              options={uniqueProducts.map(p => ({ value: p.code, label: p.label }))}
              selectedValues={productFilter}
              onChange={(val) => { setProductFilter(val); setCurrentPage(1); }}
            />

            {/* Clear All Filters Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={resetAllFilters}
                className="ml-auto px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-semibold flex items-center space-x-1 transition-colors"
                title="Redefinir todos os filtros de pesquisa"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Filtros ({activeFiltersCount})</span>
              </button>
            )}
          </div>

          {/* Active Filters Badges Indicator Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2.5 mt-2.5 border-t border-slate-200/80 text-xs bg-indigo-50/60 p-2.5 rounded-xl">
              <div className="flex items-center text-indigo-900 font-bold text-[11px] mr-1">
                <Filter className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                <span>Filtros Ativos ({activeFiltersCount}):</span>
              </div>

              {searchTerm.trim() !== '' && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  Busca: "{searchTerm}"
                  <button onClick={() => { setSearchTerm(''); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!operFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  Operação: {Array.from(operFilter).join(', ')}
                  <button onClick={() => { setOperFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!statusFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  Status: {Array.from(statusFilter).join(', ')}
                  <button onClick={() => { setStatusFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!xmlFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  Vínculo XML
                  <button onClick={() => { setXmlFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!cfopFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  CFOP: {Array.from(cfopFilter).join(', ')}
                  <button onClick={() => { setCfopFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!cstFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  CST: {Array.from(cstFilter).join(', ')}
                  <button onClick={() => { setCstFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!ncmFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  NCM: {Array.from(ncmFilter).join(', ')}
                  <button onClick={() => { setNcmFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {!divergenceTypeFilter.has('ALL') && (
                <span className="inline-flex items-center px-2 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-900 text-[11px] font-medium shadow-2xs">
                  Divergência
                  <button onClick={() => { setDivergenceTypeFilter(new Set(['ALL'])); setCurrentPage(1); }} className="ml-1 text-slate-400 hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              <button
                onClick={resetAllFilters}
                className="ml-auto px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-[11px] flex items-center space-x-1 shadow-2xs transition-colors"
                title="Limpar todos os filtros ativados com 1 clique"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpar Filtros</span>
              </button>
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="p-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-700">
                    {selectedKeys.size > 0 && selectedKeys.size === filteredItems.length ? (
                      <CheckSquare className="w-4 h-4 text-[#1e3a5f]" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="p-3">Status</th>
                <th className="p-3">Doc / Série</th>
                <th className="p-3">Item (C170)</th>
                <th className="p-3">
                  <div className="flex items-center space-x-1">
                    <span>NCM (SPED / XML / Matriz)</span>
                    <FiscalTooltip
                      title="Nomenclatura Comum do Mercosul (NCM)"
                      description="Código fiscal de 8 dígitos. Define enquadramento em substituição tributária (ICMS-ST), alíquota de IPI e tributação de PIS/COFINS (monofásico/alíquota zero)."
                      lawRef="Decreto nº 11.158/2022 (TIPI)"
                      badge="Mercosul"
                    />
                  </div>
                </th>
                <th className="p-3">
                  <div className="flex items-center space-x-1">
                    <span>CFOP (SPED / XML)</span>
                    <FiscalTooltip
                      title="Código Fiscal de Operações e Prestações (CFOP)"
                      description="Identifica a natureza da circulação da mercadoria. O sistema valida o de-para entre a nota emitida pelo fornecedor (5.xxx/6.xxx) e a escrituração de entrada na empresa (1.xxx/2.xxx)."
                      lawRef="Ajuste SINIEF 07/1971"
                      badge="SINIEF"
                    />
                  </div>
                </th>
                <th className="p-3">
                  <div className="flex items-center space-x-1">
                    <span>CST (SPED / XML / Matriz)</span>
                    <FiscalTooltip
                      title="Código de Situação Tributária (CST ICMS)"
                      description="Composto por 3 dígitos: 1º Dígito = Origem da Mercadoria (0 = Nacional, 1/2 = Importada); 2º e 3º Dígitos = Regra de Tributação (00 = Tributado, 60 = ST, 40 = Isento)."
                      lawRef="Convênio s/nº de 15/12/1970 - Tabela B"
                      badge="Regra CST"
                    />
                  </div>
                </th>
                <th className="p-3 text-right">Valor Item</th>
                <th className="p-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <span>Tributação ICMS</span>
                    <FiscalTooltip
                      title="Destaque de ICMS & Base de Cálculo"
                      description="Confronta a Base de Cálculo e o Valor do ICMS informados no SPED com a nota fiscal XML e com a matriz de alíquotas da UF."
                      lawRef="Regulamento do ICMS (RICMS)"
                    />
                  </div>
                </th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-500">
                    Nenhum item encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                paginatedItems.map(({ doc, item, status, reason, xmlItem, fuzzyMatch, matrizRule, matrizDiff, matrizDiffReason }) => {
                  const key = `${doc.id}_${item.numItem}`;
                  const isSelected = selectedKeys.has(key);
                  const rowBg = isSelected
                    ? 'bg-blue-50/70'
                    : status === 'MALFORMED'
                    ? 'bg-red-50/60 hover:bg-red-100/60'
                    : status === 'DIVERGENT' || matrizDiff
                    ? 'bg-amber-50/60 hover:bg-amber-100/60'
                    : 'hover:bg-slate-50';

                  const ncmDiff = xmlItem && xmlItem.ncm && xmlItem.ncm !== item.ncm;
                  const cstDiff = xmlItem && xmlItem.cst && xmlItem.cst !== item.cstIcms;
                  const cfopDiff = xmlItem && xmlItem.cfop && xmlItem.cfop !== item.cfop;
                  const valDiff = xmlItem && Math.abs(xmlItem.vProd - item.vlItem) > 0.05;

                  const expCst = matrizRule?.expectedCst ? matrizRule.expectedCst.padStart(3, '0') : '';
                  const expAliq = matrizRule?.expectedAliqIcms;
                  const curCst = (item.cstIcms || '').padStart(3, '0');
                  const curAliq = item.aliqIcms || 0;

                  const isMatrizCstDiff = expCst ? curCst !== expCst : false;
                  const isMatrizAliqDiff = expAliq !== undefined && expAliq !== null ? Math.abs(curAliq - expAliq) > 0.01 : false;

                  return (
                    <tr key={key} className={`transition-colors ${rowBg}`}>
                      <td className="p-3 text-center">
                        <button onClick={() => toggleSelectItem(doc.id, item.numItem)} className="text-slate-500 hover:text-slate-700">
                          {isSelected ? <CheckSquare className="w-4 h-4 text-[#1e3a5f]" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </button>
                      </td>
                      <td className="p-3 whitespace-nowrap space-y-1">
                        <div className="flex items-center gap-1.5">
                          {status === 'OK' && !matrizDiff && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              OK
                            </span>
                          )}
                          {status === 'MALFORMED' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 cursor-help" title={reason}>
                              Malformado
                            </span>
                          )}
                          {(status === 'DIVERGENT' || matrizDiff) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 cursor-help" title={`${reason} ${matrizDiffReason || ''}`}>
                              Divergente
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-1">
                          {(item.isModified || item.correctedByRobot) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-200" title="Este produto/item já foi alterado ou corrigido. Evite alterar novamente por engano.">
                              Item Alterado
                            </span>
                          )}
                          {item.correctedByRobot && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200" title={item.robotCorrectionReason || 'Corrigido pelo Robô com base na Matriz'}>
                              🤖 Corrigido pelo Robô
                            </span>
                          )}
                          <button
                            onClick={() => handleToggleAnalystConfirm(doc.id, item.numItem, item.analystConfirmed)}
                            className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                              item.analystConfirmed
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                            title="Clique para alternar o status de conferência do analista fiscal"
                          >
                            {item.analystConfirmed ? '✅ Conferido' : '⏳ Pendente'}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReportItem({
                                docNum: doc.numDoc,
                                itemNum: item.numItem,
                                descrItem: item.descrItem,
                                ncm: item.ncm,
                                cstIcms: item.cstIcms,
                                cfop: item.cfop
                              });
                              setReportModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-colors mt-0.5"
                            title="Reportar equívoco do Agente AI para refinamento do prompt"
                          >
                            ⚠️ Reportar Erro Agente
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-slate-800 font-medium whitespace-nowrap">
                        <div>Doc: {doc.numDoc} <span className="text-[10px] text-slate-500">(Sér. {doc.serie || '0'})</span></div>
                        <div className="text-[10px] font-mono text-slate-400 truncate max-w-[120px]">{doc.cnpjEmit}</div>
                        {['02', '03', '04', '05'].includes(doc.codSit) && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title={`Documento Cancelado no SPED (COD_SIT ${doc.codSit})`}>
                              🚫 Cancelado SPED ({doc.codSit})
                            </span>
                          </div>
                        )}
                        {xmlItem && xmlItem.isCancelada && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white shadow-xs" title={xmlItem.xMotivo || 'XML consta como CANCELADO na SEFAZ'}>
                              🚨 XML Cancelado SEFAZ
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">#{item.numItem} - {item.codItem}</div>
                        <div className="text-[11px] text-slate-500 max-w-xs truncate" title={item.descrItem}>{item.descrItem}</div>
                        {fuzzyMatch && fuzzyMatch.isSequenceMismatch && (
                          <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200" title={`Desalinhamento de Sequência: Mapeado para o item ${fuzzyMatch.xmlNItem} do XML (cProd: ${fuzzyMatch.xmlItem?.cProd || 'N/A'}) com ${fuzzyMatch.score}% de similaridade`}>
                            <span>🔄 Item XML #{fuzzyMatch.xmlNItem}</span>
                            <span className="text-[9px] bg-amber-200/80 px-1 rounded font-bold">{fuzzyMatch.score}% match</span>
                          </div>
                        )}
                        {fuzzyMatch && !fuzzyMatch.isSequenceMismatch && fuzzyMatch.score >= 40 && (
                          <div className="mt-0.5 inline-flex items-center gap-1 text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100" title={`Fuzzy match: ${fuzzyMatch.reasons.join(', ')}`}>
                            <span>Fuzzy Match XML #{fuzzyMatch.xmlNItem} ({fuzzyMatch.score}%)</span>
                          </div>
                        )}
                      </td>
                      
                      {/* NCM Column */}
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        <div className="text-slate-800 font-semibold" title="NCM cadastrado no arquivo SPED">SPED: {item.ncm || '-'}</div>
                        {xmlItem ? (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded inline-block text-[10px] ${ncmDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-100 text-slate-700'}`} title="NCM na Nota Fiscal XML">
                            XML: {xmlItem.ncm || '-'} {ncmDiff && '⚠️'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">XML não vinculado</div>
                        )}
                        {matrizRule ? (
                          <div className="mt-0.5 text-[10px] font-sans text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded block truncate max-w-[160px]" title={`Regra Matriz NCM ${matrizRule.ncmPrefix}: ${matrizRule.description || ''}`}>
                            Matriz: {matrizRule.ncmPrefix}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">Sem cadastro na matriz</div>
                        )}
                      </td>

                      {/* CFOP Column */}
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        {inlineEditingKey === key ? (
                          <div>
                            <input
                              type="text"
                              value={inlineCfop}
                              onChange={(e) => setInlineCfop(e.target.value)}
                              className="w-20 px-1.5 py-1 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                              placeholder="CFOP"
                            />
                          </div>
                        ) : (
                          <div className="text-slate-800 font-semibold">SPED: {item.cfop || '-'}</div>
                        )}
                        {xmlItem ? (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded inline-block text-[10px] ${cfopDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                            XML: {xmlItem.cfop || '-'} {cfopDiff && '⚠️'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">XML não vinculado</div>
                        )}
                      </td>

                      {/* CST Column */}
                      <td className="p-3 font-mono text-[11px] whitespace-nowrap">
                        {inlineEditingKey === key ? (
                          <div>
                            <input
                              type="text"
                              value={inlineCst}
                              onChange={(e) => setInlineCst(e.target.value)}
                              className="w-16 px-1.5 py-1 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500/20"
                              placeholder="CST"
                            />
                          </div>
                        ) : (
                          <div className="text-slate-800 font-semibold">SPED: {item.cstIcms ? item.cstIcms.padStart(3, '0') : '-'}</div>
                        )}
                        {xmlItem && (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded inline-block text-[10px] ${cstDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                            XML: {xmlItem.cst ? xmlItem.cst.padStart(3, '0') : '-'} {cstDiff && '⚠️'}
                          </div>
                        )}
                        {matrizRule?.expectedCst && (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded block text-[10px] font-sans ${isMatrizCstDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-emerald-50 text-emerald-800'}`} title="CST esperado no Banco de Dados Cadastrado">
                            Matriz: {matrizRule.expectedCst} {isMatrizCstDiff && '⚠️'}
                          </div>
                        )}
                      </td>

                      {/* Valor Item Column */}
                      <td className="p-3 text-right whitespace-nowrap font-mono text-[11px]">
                        {inlineEditingKey === key ? (
                          <div className="flex justify-end">
                            <input
                              type="text"
                              value={inlineVlItem}
                              onChange={(e) => setInlineVlItem(e.target.value)}
                              className="w-24 px-1.5 py-1 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none text-right"
                              placeholder="0.00"
                            />
                          </div>
                        ) : (
                          <div className="text-slate-800 font-semibold">SPED: R$ {item.vlItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        )}
                        {xmlItem ? (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded inline-block text-[10px] ${valDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-100 text-slate-700'}`}>
                            XML: R$ {(xmlItem.vProd || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} {valDiff && '⚠️'}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic mt-0.5">XML não vinculado</div>
                        )}
                      </td>

                      {/* ICMS Column */}
                      <td className="p-3 text-right whitespace-nowrap font-mono text-[11px]">
                        {inlineEditingKey === key ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500">BC:</span>
                              <input
                                type="text"
                                value={inlineVlBc}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInlineVlBc(val);
                                  const bc = parseFloat(val.replace(',', '.')) || 0;
                                  const a = parseFloat(inlineAliq.replace(',', '.')) || 0;
                                  setInlineVlIcms(((bc * a) / 100).toFixed(2));
                                }}
                                className="w-16 px-1 py-0.5 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none"
                                placeholder="BC"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500">Alíq%:</span>
                              <input
                                type="text"
                                value={inlineAliq}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setInlineAliq(val);
                                  const a = parseFloat(val.replace(',', '.')) || 0;
                                  const bc = parseFloat(inlineVlBc.replace(',', '.')) || item.vlItem || 0;
                                  setInlineVlIcms(((bc * a) / 100).toFixed(2));
                                }}
                                className="w-14 px-1 py-0.5 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none"
                                placeholder="%"
                              />
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-500">VlIcms:</span>
                              <input
                                type="text"
                                value={inlineVlIcms}
                                onChange={(e) => setInlineVlIcms(e.target.value)}
                                className="w-16 px-1 py-0.5 border border-indigo-400 rounded text-xs font-mono bg-white text-slate-900 outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-800 font-semibold" title="Base de Cálculo, Alíquota e Valor do ICMS no SPED">
                            SPED: BC R$ {(item.vlBcIcms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | {item.aliqIcms}% | R$ {(item.vlIcms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        {xmlItem && (
                          <div className="text-[10px] text-slate-600 mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded inline-block" title="Base de Cálculo, Alíquota e Valor do ICMS no XML">
                            XML: BC R$ {((xmlItem.vBc ?? xmlItem.vBC ?? 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | {xmlItem.pIcms ?? 0}% | R$ {(xmlItem.vIcms || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        {matrizRule?.expectedAliqIcms !== undefined && (
                          <div className={`mt-0.5 px-1.5 py-0.5 rounded inline-block text-[10px] font-sans ${isMatrizAliqDiff ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-emerald-50 text-emerald-800'}`} title="Alíquota cadastrada no Banco de Dados">
                            Matriz: {matrizRule.expectedAliqIcms}% {isMatrizAliqDiff && '⚠️'}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center whitespace-nowrap">
                        {inlineEditingKey === key ? (
                          <div className="flex items-center justify-center gap-1">
                            {xmlItem && (
                              <button
                                onClick={() => copyFromXmlForInline(doc.id, item)}
                                className="px-1.5 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded text-[10px] font-bold"
                                title="Copiar valores e tributos do XML"
                              >
                                Xml
                              </button>
                            )}
                            <button
                              onClick={() => saveInlineEdit(doc.id, item)}
                              className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
                              title="Salvar Alterações Inline"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={cancelInlineEdit}
                              className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition"
                              title="Cancelar Edição Inline"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => startInlineEdit(doc.id, item)}
                              className={`p-1.5 rounded-lg transition ${item.analystConfirmed ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                              title={item.analystConfirmed ? 'Item conferido. Desmarque a conferência para editar.' : 'Edição Rápida Inline (CST, CFOP, Alíquota)'}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => startEditing(doc.id, item)}
                              className={`px-2.5 py-1.5 border rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors shadow-2xs ${item.analystConfirmed ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-200 text-[#1e3a5f] hover:bg-[#1e3a5f]/5'}`}
                              title={item.analystConfirmed ? 'Item conferido. Desmarque a conferência para editar.' : 'Editar Tributação e NCM Completa (Modal)'}
                            >
                              <span>Modal</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50">
          <div className="text-xs text-slate-500">
            Mostrando <span className="font-semibold text-slate-700">{filteredItems.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> a{' '}
            <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> de{' '}
            <span className="font-semibold text-slate-700">{filteredItems.length}</span> itens filtrados (Total geral: {counts.total})
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
            <span className="text-xs text-slate-600 px-2">
              Página {currentPage} de {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
            >
              <span>Próxima</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#1e3a5f] text-white px-6 py-4 rounded-lg shadow-sm flex flex-wrap items-center space-x-4 z-50 border border-slate-700 animate-fade-in">
          <div className="flex items-center space-x-2">
            <span className="bg-white text-[#1e3a5f] font-bold text-xs px-2.5 py-1 rounded-full">{selectedKeys.size}</span>
            <span className="text-xs font-semibold">itens selecionados</span>
          </div>

          <div className="h-6 w-px bg-slate-600 hidden sm:block"></div>

          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <input
              type="text"
              placeholder="Novo NCM"
              value={bulkNcmInput}
              onChange={(e) => setBulkNcmInput(e.target.value)}
              className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <input
              type="text"
              placeholder="Novo CST"
              value={bulkCstInput}
              onChange={(e) => setBulkCstInput(e.target.value)}
              className="w-20 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <input
              type="text"
              placeholder="Novo CFOP"
              value={bulkCfopInput}
              onChange={(e) => setBulkCfopInput(e.target.value)}
              className="w-20 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
            />
            <input
              type="text"
              placeholder="Base ICMS (R$)"
              value={bulkVlBcInput}
              onChange={(e) => setBulkVlBcInput(e.target.value)}
              className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              title="Nova Base de Cálculo de ICMS para os itens selecionados"
            />
            <input
              type="text"
              placeholder="Alíq. ICMS (%)"
              value={bulkAliqInput}
              onChange={(e) => setBulkAliqInput(e.target.value)}
              className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              title="Nova Alíquota de ICMS para os itens selecionados"
            />
            <input
              type="text"
              placeholder="Val. ICMS (R$)"
              value={bulkVlIcmsInput}
              onChange={(e) => setBulkVlIcmsInput(e.target.value)}
              className="w-24 px-2.5 py-1.5 bg-slate-800 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              title="Novo Valor de ICMS para os itens selecionados"
            />

            <button
              onClick={() => handleBulkApply('manual')}
              className="px-3.5 py-1.5 bg-white text-[#1e3a5f] hover:bg-slate-100 text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center space-x-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aplicar Manual</span>
            </button>

            {stateTaxRules.length > 0 && (
              <button
                onClick={() => handleBulkApply('matriz')}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5"
                title="Aplica NCM, CST e Alíquota cadastrados no Banco de Dados para os NCMs selecionados"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Aplicar Banco / Matriz</span>
              </button>
            )}

            <button
              onClick={() => handleBulkApply('xml')}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5"
              title="Preenche NCM, CST e CFOP com os dados do XML da Nota"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Aplicar Dados XML</span>
            </button>

            <button
              onClick={() => handleBulkAnalystConfirm(true)}
              className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center space-x-1.5"
              title="Confirmar conferência para todos os itens selecionados"
            >
              <Check className="w-3.5 h-3.5" />
              <span>✅ Confirmar Conferência</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-600 hidden sm:block"></div>

          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-slate-300 hover:text-white text-xs font-medium underline"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Manual Editing Overlay Modal */}
      {editingItemData && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-sm max-w-2xl w-full border border-slate-200 overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-[#1e3a5f]">Editar Tributação & NCM do Item</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-mono">
                  Item #{editingItemData.item.numItem} • Cód. {editingItemData.item.codItem}
                </p>
              </div>
              <button
                onClick={cancelEditing}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Product description */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs text-slate-700">
                <span className="font-bold text-[#1e3a5f]">Descrição do Item:</span> {editingItemData.item.descrItem}
              </div>

              {/* Cross-Reference Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* XML Reference Card */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      Dados no XML da Nota
                    </span>
                    {editingXmlItem && (
                      <button
                        type="button"
                        onClick={applyXmlToModal}
                        className="text-[11px] text-amber-700 hover:text-amber-900 font-bold underline flex items-center gap-1"
                      >
                        Copiar XML <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {editingXmlItem ? (
                    <div className="space-y-1 font-mono text-[11px] text-slate-600">
                      <div>NCM: <strong className="text-slate-800">{editingXmlItem.ncm || '-'}</strong></div>
                      <div>CST: <strong className="text-slate-800">{editingXmlItem.cst || '-'}</strong></div>
                      <div>CFOP: <strong className="text-slate-800">{editingXmlItem.cfop || '-'}</strong></div>
                      <div>Alíq ICMS: <strong className="text-slate-800">{editingXmlItem.pIcms ?? 0}%</strong></div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">XML não vinculado a este documento.</p>
                  )}
                </div>

                {/* Matriz Reference Card */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-indigo-900 flex items-center gap-1">
                      <Database className="w-3.5 h-3.5 text-indigo-700" />
                      Banco de Dados / Matriz
                    </span>
                    {editingMatrizRule && (
                      <button
                        type="button"
                        onClick={applyMatrizToModal}
                        className="text-[11px] text-indigo-800 hover:text-indigo-950 font-bold underline flex items-center gap-1"
                      >
                        Copiar Matriz <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {editingMatrizRule ? (
                    <div className="space-y-1 font-mono text-[11px] text-indigo-900">
                      <div>Prefixo NCM: <strong>{editingMatrizRule.ncmPrefix}</strong></div>
                      <div>CST Esperado: <strong>{editingMatrizRule.expectedCst || '-'}</strong></div>
                      <div>Alíq. Esperada: <strong>{editingMatrizRule.expectedAliqIcms ?? '-'}%</strong></div>
                      <div className="font-sans text-[10px] text-indigo-700 truncate">{editingMatrizRule.description}</div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-indigo-400 italic">Nenhuma regra cadastrada na matriz para este NCM/UF.</p>
                  )}
                </div>
              </div>

              {/* Edit Form Inputs */}
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">CST ICMS</label>
                      <FiscalTooltip
                        title="Regras de CST para Entradas e Saídas"
                        description="Para mercadorias tributadas integralmente use 000 (nacional) ou 100/200 (estrangeira). Para mercadorias com ICMS-ST cobrado anteriormente pelo fornecedor, use CST 060."
                        lawRef="Tabela B do Convênio SINIEF s/nº de 1970"
                        examples={[
                          'CST 000: Tributada integralmente',
                          'CST 060: ICMS cobrado por substituição tributária',
                          'CST 040: Isenta de ICMS'
                        ]}
                        badge="Regras de CST"
                      />
                    </div>
                    <input
                      type="text"
                      value={editCst}
                      onChange={(e) => setEditCst(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="Ex: 000, 060"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">CFOP</label>
                      <FiscalTooltip
                        title="Correspondência de CFOP de Entrada"
                        description="Na escrituração de compras (entradas), o CFOP 5.102 da nota fiscal do fornecedor deve ser escriturado como 1.102 (compra para comercialização) ou 1.556 (uso/consumo)."
                        lawRef="Tabela de CFOP do Convênio SINIEF"
                      />
                    </div>
                    <input
                      type="text"
                      value={editCfop}
                      onChange={(e) => setEditCfop(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="Ex: 5102, 1403"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Valor do Item (R$) (vlItem)</label>
                      <FiscalTooltip
                        title="Valor Total do Item"
                        description="Valor bruto do item escriturado no SPED C170. Ajuste caso haja divergência com o XML."
                      />
                    </div>
                    <input
                      type="text"
                      value={editVlItem}
                      onChange={(e) => setEditVlItem(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Base de Cálculo ICMS (R$)</label>
                      <FiscalTooltip
                        title="Validação da Base do ICMS"
                        description="Certifique-se de que a Base de Cálculo reflete corretamente o valor do produto acrescido de frete/despesas e reduzido de eventuais isenções ou reduções de base."
                        lawRef="Art. 13 da LC 87/96"
                      />
                    </div>
                    <input
                      type="text"
                      value={editVlBc}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditVlBc(val);
                        const bc = parseFloat(val.replace(',', '.')) || 0;
                        const aliq = parseFloat(editAliq.replace(',', '.')) || 0;
                        if (bc >= 0 && aliq >= 0) {
                          setEditVlIcms(((bc * aliq) / 100).toFixed(2));
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Alíquota ICMS (%)</label>
                      <FiscalTooltip
                        title="Alíquota Interna ou Interestadual"
                        description="Verifique a alíquota interna do estado de destino para a mercadoria ou a alíquota interestadual (4%, 7% ou 12%)."
                      />
                    </div>
                    <input
                      type="text"
                      value={editAliq}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditAliq(val);
                        const bc = parseFloat(editVlBc.replace(',', '.')) || 0;
                        const aliq = parseFloat(val.replace(',', '.')) || 0;
                        if (bc >= 0 && aliq >= 0) {
                          setEditVlIcms(((bc * aliq) / 100).toFixed(2));
                        }
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">Valor ICMS (R$)</label>
                      <FiscalTooltip
                        title="Cálculo do Valor do ICMS"
                        description="O valor do ICMS é a multiplicação da Base de Cálculo pela Alíquota. (VlIcms = VlBcIcms * AliqIcms / 100)."
                      />
                    </div>
                    <input
                      type="text"
                      value={editVlIcms}
                      onChange={(e) => setEditVlIcms(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-900 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/15 outline-none"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={cancelEditing}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveEditing}
                className="px-5 py-2 bg-[#1e3a5f] hover:bg-[#162b47] text-white rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Error Report Modal */}
      <AgentErrorReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        itemData={selectedReportItem}
      />

      {/* Modal de Detalhamento e Exportação de XMLs Faltantes */}
      {missingXmlModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#1e3a5f] text-white p-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-lg font-bold">Relatório de Notas Faltantes & XMLs Omissos</h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Empresa: {spedData?.header?.nome || 'SPED Importado'} — CNPJ: {spedData?.header?.cnpj || 'N/I'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMissingXmlModalOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Tabs */}
            <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3">
              <button
                onClick={() => setMissingXmlModalTab('sped_no_xml')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 cursor-pointer ${
                  missingXmlModalTab === 'sped_no_xml'
                    ? 'border-[#1e3a5f] text-[#1e3a5f] bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Notas SPED sem XML ({missingXmlDocs.length})</span>
              </button>
              <button
                onClick={() => setMissingXmlModalTab('xml_no_sped')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center space-x-2 cursor-pointer ${
                  missingXmlModalTab === 'xml_no_sped'
                    ? 'border-[#1e3a5f] text-[#1e3a5f] bg-white rounded-t-lg'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>XMLs Omissos sem SPED ({omissaXmls.length})</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4">
              {missingXmlModalTab === 'sped_no_xml' ? (
                missingXmlDocs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <span>Excelente! Todas as notas escrituradas no SPED possuem seus respectivos XMLs na base.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Nº Doc</th>
                          <th className="px-3 py-2">Série</th>
                          <th className="px-3 py-2">Data Doc</th>
                          <th className="px-3 py-2">Chave de Acesso NFe</th>
                          <th className="px-3 py-2">Fornecedor / Emitente</th>
                          <th className="px-3 py-2 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {missingXmlDocs.map((doc, idx) => (
                          <tr key={doc.id || idx} className="hover:bg-amber-50/40">
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{doc.numDoc || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{doc.serie || '1'}</td>
                            <td className="px-3 py-2 text-slate-600">{doc.dtDoc || '-'}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={doc.chvNfe}>
                              {doc.chvNfe || 'Sem Chave Informada'}
                            </td>
                            <td className="px-3 py-2 text-slate-700 font-medium">
                              {(doc as any).nomeEmit || doc.cnpjEmit || 'Não identificado'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {(doc.vlDoc || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                omissaXmls.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <span>Nenhum XML de terceiro pendente de escrituração encontrado.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left text-slate-700">
                      <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Nº NF</th>
                          <th className="px-3 py-2">Série</th>
                          <th className="px-3 py-2">Data Emissão</th>
                          <th className="px-3 py-2">Chave de Acesso XML</th>
                          <th className="px-3 py-2">Emitente</th>
                          <th className="px-3 py-2 text-right">Valor Total XML</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {omissaXmls.map((xml, idx) => (
                          <tr key={xml.chvNfe || idx} className="hover:bg-rose-50/40">
                            <td className="px-3 py-2 font-mono font-bold text-slate-900">{xml.nNF || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{xml.serie || '1'}</td>
                            <td className="px-3 py-2 text-slate-600">{xml.dhEmi ? xml.dhEmi.substring(0, 10) : '-'}</td>
                            <td className="px-3 py-2 font-mono text-[11px] text-slate-700 truncate max-w-[200px]" title={xml.chvNfe}>
                              {xml.chvNfe || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-700 font-medium">
                              {xml.emitNome || xml.emitCnpj || 'Não informado'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                              {(xml.vNF || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-xs text-slate-500">
                Total de {totalMissingXmlCount} item(ns) identificados nesta conferência.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleExportMissingXmlPDF}
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Exportar PDF</span>
                </button>
                <button
                  onClick={handleExportMissingXmlCSV}
                  className="px-4 py-2 bg-[#1e3a5f] hover:bg-[#142c47] text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar Excel (CSV)</span>
                </button>
                <button
                  onClick={() => setMissingXmlModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
