import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Boxes, 
  PackageCheck, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  Plus, 
  Trash2, 
  Download, 
  Search, 
  Sparkles, 
  Calculator, 
  Database,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  X,
  FileSpreadsheet,
  Upload,
  FileText,
  FileCode,
  ArrowUpRight,
  Layers,
  PieChart,
  Check,
  RotateCcw,
  History,
  Undo2,
  Sun,
  Moon
} from 'lucide-react';
import { SpedData, Sped0200Item, SpedH010Item, SpedH020Item, SpedBlocoH, StateTaxRule } from '../types';
import { fetchGlobalStateTaxMatrix, saveGlobalStateTaxMatrix } from '../lib/matrizService';
import { exportSped } from '../lib/spedExporter';
import { parseInventoryOrSpedFile, SAMPLE_STOCK_SPED_DATA } from '../lib/inventoryParser';

interface StockEngineeringViewProps {
  spedData: SpedData | null;
  onUpdateSpedData: (newSpedData: SpedData) => void;
  onSpedLoaded: (newSpedData: SpedData) => void;
  addNotification: (title: string, message: string, type: 'system' | 'edit' | 'import' | 'audit' | 'export' | 'rule') => void;
  escritorioId?: string;
}

export function StockEngineeringView({ 
  spedData, 
  onUpdateSpedData, 
  onSpedLoaded, 
  addNotification,
  escritorioId
}: StockEngineeringViewProps) {
  const effectiveEscritorioId = escritorioId || 'escritorio-default';
  // Theme state: defaults to Light Mode (isDarkTheme = false) so users get a clean, high-contrast light background screen
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    const saved = localStorage.getItem('atlas_stock_theme_dark');
    return saved === 'true'; // Default is Light Theme (false)
  });

  const toggleTheme = () => {
    setIsDarkTheme(prev => {
      const next = !prev;
      localStorage.setItem('atlas_stock_theme_dark', String(next));
      return next;
    });
  };

  const theme = useMemo(() => {
    if (isDarkTheme) {
      return {
        isDark: true,
        mainBg: 'bg-slate-900 text-slate-100',
        headerBg: 'bg-slate-950 border-slate-800',
        subtabBg: 'border-slate-800 bg-slate-950',
        cardBg: 'bg-slate-950 border-slate-800',
        cardSubBg: 'bg-slate-900/90 border-slate-800',
        cardHighlight: 'bg-slate-900/80 border-slate-800',
        inputBg: 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500',
        selectBg: 'bg-slate-900 border-slate-800 text-slate-200',
        tableContainer: 'bg-slate-950 border-slate-800',
        tableTopBar: 'bg-slate-900/80 border-slate-800 text-slate-400',
        tableHeaderBg: 'bg-slate-900 text-slate-400 border-slate-800',
        tableRowBorder: 'divide-slate-800/80',
        tableRowHover: 'hover:bg-slate-900/50',
        textTitle: 'text-slate-100',
        textMuted: 'text-slate-400',
        textSub: 'text-slate-500',
        badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
        btnSecondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
        modalBackdrop: 'bg-slate-950/80',
        modalCard: 'bg-slate-900 border-slate-800 text-slate-100 shadow-sm',
        modalInput: 'bg-slate-950 border-slate-800 text-white focus:border-indigo-500',
        alertBanner: 'bg-sky-950/40 border-sky-500/30 text-sky-200',
        proofCard: 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300',
        subtabActiveAudit: 'border-indigo-500 text-white bg-slate-900/90 rounded-t-xl',
        subtabActiveBlocoH: 'border-emerald-500 text-white bg-slate-900/90 rounded-t-xl',
        subtabActiveAltered: 'border-sky-500 text-white bg-slate-900/90 rounded-t-xl',
        subtabActiveOverview: 'border-amber-500 text-white bg-slate-900/90 rounded-t-xl',
        subtabInactive: 'border-transparent text-slate-400 hover:text-slate-200',
      };
    } else {
      return {
        isDark: false,
        mainBg: 'bg-slate-100/70 text-slate-800',
        headerBg: 'bg-white border-slate-200 shadow-2xs',
        subtabBg: 'border-slate-200 bg-white',
        cardBg: 'bg-white border-slate-200/90 shadow-xs',
        cardSubBg: 'bg-slate-50 border-slate-200/90',
        cardHighlight: 'bg-slate-50/90 border-slate-200 shadow-2xs',
        inputBg: 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white',
        selectBg: 'bg-white border-slate-300 text-slate-800 focus:border-indigo-500',
        tableContainer: 'bg-white border-slate-200 shadow-xs',
        tableTopBar: 'bg-slate-50 border-slate-200 text-slate-600',
        tableHeaderBg: 'bg-slate-100/90 text-slate-600 border-slate-200 font-semibold',
        tableRowBorder: 'divide-slate-200',
        tableRowHover: 'hover:bg-slate-50/80',
        textTitle: 'text-slate-900',
        textMuted: 'text-slate-600',
        textSub: 'text-slate-500',
        badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
        btnSecondary: 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs',
        modalBackdrop: 'bg-slate-900/40 backdrop-blur-xs',
        modalCard: 'bg-white border-slate-200 text-slate-800 shadow-sm',
        modalInput: 'bg-slate-50 border-slate-300 text-slate-800 focus:bg-white focus:border-indigo-500',
        alertBanner: 'bg-sky-50/90 border-sky-200 text-sky-900 shadow-2xs',
        proofCard: 'bg-emerald-50/90 border-emerald-200 text-emerald-950 shadow-2xs',
        subtabActiveAudit: 'border-indigo-600 text-indigo-950 bg-indigo-50/60 rounded-t-xl font-extrabold',
        subtabActiveBlocoH: 'border-emerald-600 text-emerald-950 bg-emerald-50/60 rounded-t-xl font-extrabold',
        subtabActiveAltered: 'border-sky-600 text-sky-950 bg-sky-50/60 rounded-t-xl font-extrabold',
        subtabActiveOverview: 'border-amber-600 text-amber-950 bg-amber-50/60 rounded-t-xl font-extrabold',
        subtabInactive: 'border-transparent text-slate-600 hover:text-slate-900',
      };
    }
  }, [isDarkTheme]);

  const [activeSubTab, setActiveSubTab] = useState<'audit0200' | 'blocoH' | 'altered' | 'overview'>('audit0200');
  
  // State for tracking altered products baseline
  const [initialH010Map, setInitialH010Map] = useState<Map<string, {
    qtd: number;
    vlUnit: number;
    vlItem: number;
    h020Cst?: string;
    h020Bc?: number;
    h020Icms?: number;
  }>>(new Map());
  const loadedFileKeyRef = useRef<string>('');

  // Filters for Altered Products view
  const [searchAltered, setSearchAltered] = useState('');
  const [filterAlteredStatus, setFilterAlteredStatus] = useState<'all' | 'modified' | 'added' | 'removed'>('all');
  
  // State for tax matrix rules
  const [taxMatrix, setTaxMatrix] = useState<StateTaxRule[]>([]);
  const [, setLoadingMatrix] = useState(false);

  // Filters for 0200
  const [search0200, setSearch0200] = useState('');
  const [filterStatus0200, setFilterStatus0200] = useState<'all' | 'divergent' | 'ok' | 'no_rule'>('all');

  // Search for Bloco H
  const [searchH010, setSearchH010] = useState('');

  // Bulk adjustment state for Bloco H
  const [bulkFactor, setBulkFactor] = useState<string>('1.00');
  const [targetStockValue, setTargetStockValue] = useState<string>('');
  const [targetMode, setTargetMode] = useState<'qtd' | 'vlUnit'>('qtd');
  const [bulkH020Cst, setBulkH020Cst] = useState<string>('000');
  const [selectedNcmFilter, setSelectedNcmFilter] = useState<string>('');

  // Recalculation proof summary state
  const [lastRecalcSummary, setLastRecalcSummary] = useState<{
    originalTotal: number;
    newTotal: number;
    targetRequested: number;
    diff: number;
    percentChange: number;
    ratio: number;
    mode: 'qtd' | 'vlUnit';
    itemCount: number;
    timestamp: string;
  } | null>(null);

  // Helper for PT-BR number parsing (supports 50.000,00 / 50000,00 / R$ 50.000 / 10,5 / 15k)
  const parsePtBrNumber = (valStr: string | number): number => {
    if (typeof valStr === 'number') return isNaN(valStr) ? 0 : valStr;
    if (!valStr) return 0;
    let clean = String(valStr).replace(/R\$\s?/gi, '').trim();
    if (clean.toLowerCase().endsWith('k')) {
      clean = clean.slice(0, -1).trim();
      const num = parseFloat(clean.replace(',', '.'));
      return isNaN(num) ? 0 : num * 1000;
    }
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(clean)) {
      clean = clean.replace(/\./g, '');
    }
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };
  
  // Add item modal state
  const [is0200PickerOpen, setIs0200PickerOpen] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selected0200Codes, setSelected0200Codes] = useState<Set<string>>(new Set());
  const [importDefaultPrice, setImportDefaultPrice] = useState<number>(10.00);

  // File import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importingFile, setImportingFile] = useState(false);

  // Delete / Clear stock modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Manual Add Item Modal state
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemDescr, setNewItemDescr] = useState('');
  const [newItemNcm, setNewItemNcm] = useState('');
  const [newItemUnid, setNewItemUnid] = useState('UN');
  const [newItemQtd, setNewItemQtd] = useState<number>(10);
  const [newItemVlUnit, setNewItemVlUnit] = useState<number>(15.00);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch matrix on load
  React.useEffect(() => {
    let isMounted = true;
    setLoadingMatrix(true);
    fetchGlobalStateTaxMatrix(effectiveEscritorioId)
      .then(rules => {
        if (isMounted) setTaxMatrix(rules || []);
      })
      .finally(() => {
        if (isMounted) setLoadingMatrix(false);
      });
    return () => { isMounted = false; };
  }, []);

  // Ensure items0200 exists
  const items0200 = useMemo(() => {
    if (!spedData) return [];
    return spedData.items0200 || [];
  }, [spedData]);

  // Ensure blocoH exists
  const blocoH = useMemo<SpedBlocoH>(() => {
    if (!spedData) {
      return { dtInv: '', vlInv: 0, motInv: '01', items: [] };
    }
    if (spedData.blocoH) return spedData.blocoH;
    return {
      dtInv: spedData.header?.dtFin || '',
      vlInv: 0,
      motInv: '01',
      items: []
    };
  }, [spedData]);

  const totalQtdInStock = useMemo(() => {
    return blocoH.items.reduce((acc, i) => acc + (i.qtd || 0), 0);
  }, [blocoH]);

  const totalH020Count = useMemo(() => {
    return blocoH.items.filter(i => i.h020 || (i.h020List && i.h020List.length > 0)).length;
  }, [blocoH]);

  const avgPriceInStock = useMemo(() => {
    return blocoH.items.length > 0 ? (blocoH.vlInv || 0) / blocoH.items.length : 0;
  }, [blocoH]);

  // Create lookup map for NCM rules in tax matrix
  const matrixRulesByNcm = useMemo(() => {
    const map = new Map<string, StateTaxRule>();
    const ufSped = spedData?.header.uf || 'SP';
    taxMatrix.forEach(rule => {
      if (rule.uf === ufSped || rule.uf === 'TODOS') {
        map.set(rule.ncmPrefix.trim(), rule);
      }
    });
    return map;
  }, [taxMatrix, spedData?.header.uf]);

  // Enriched 0200 list with tax status
  const enriched0200 = useMemo(() => {
    return items0200.map(item => {
      const cleanNcm = (item.ncm || '').replace(/\D/g, '');
      
      let matchedRule: StateTaxRule | undefined = undefined;
      for (const [prefix, rule] of matrixRulesByNcm.entries()) {
        const cleanPrefix = prefix.replace(/\D/g, '');
        if (cleanNcm.startsWith(cleanPrefix)) {
          matchedRule = rule;
          break;
        }
      }

      let status: 'ok' | 'divergent' | 'no_rule' = 'no_rule';
      if (matchedRule) {
        const cstExpected = matchedRule.expectedCst ? matchedRule.expectedCst.trim().padStart(3, '0') : '';
        const aliqExpected = matchedRule.expectedAliqIcms;

        const currentAliq = item.aliqIcms || 0;
        const currentCst = item.cstIcmsPadrao || '';

        const cstDiff = Boolean(cstExpected && currentCst && currentCst !== cstExpected);
        const aliqDiff = Boolean(aliqExpected !== undefined && Math.abs(currentAliq - aliqExpected) > 0.01);

        if (cstDiff || aliqDiff) {
          status = 'divergent';
        } else {
          status = 'ok';
        }
      }

      return {
        item,
        matchedRule,
        status
      };
    });
  }, [items0200, matrixRulesByNcm]);

  // List of distinct NCMs available in imported stock products
  const availableNcms = useMemo(() => {
    const map = new Map<string, number>();
    items0200.forEach(i => {
      const ncm = (i.ncm || 'Sem NCM').trim();
      if (ncm) map.set(ncm, (map.get(ncm) || 0) + 1);
    });
    return Array.from(map.entries()).map(([ncm, count]) => ({ ncm, count }));
  }, [items0200]);

  // Helper to resolve NCM tax data for a given codItem
  const getNcmTaxDataForCodItem = (codItem: string) => {
    const ref = enriched0200.find(e => e.item.codItem === codItem);
    if (!ref) {
      return {
        ncm: 'N/D',
        cstIcms: '000',
        aliqIcms: 18,
        source: 'Padrão'
      };
    }

    const ncm = ref.item.ncm || 'N/D';
    const cstIcms = ref.matchedRule?.expectedCst
      ? ref.matchedRule.expectedCst.trim().padStart(3, '0')
      : ref.item.cstIcmsPadrao || '000';

    const aliqIcms = ref.matchedRule?.expectedAliqIcms !== undefined
      ? ref.matchedRule.expectedAliqIcms
      : (ref.item.aliqIcms ?? (cstIcms === '000' || cstIcms === '020' ? 18 : 0));

    return {
      ncm,
      cstIcms,
      aliqIcms,
      ruleDesc: ref.matchedRule?.descricao || ref.matchedRule?.description,
      source: ref.matchedRule ? 'Matriz Tributária (NCM)' : 'Cadastro 0200'
    };
  };

  // Helper to compute SpedH020Item according to NCM rules
  const computeH020ForCodItem = (codItem: string, vlItem: number, overrideCst?: string): SpedH020Item => {
    const taxData = getNcmTaxDataForCodItem(codItem);
    const cstIcms = overrideCst || taxData.cstIcms || '000';

    let vlBcIcms = vlItem;
    if (cstIcms === '040' || cstIcms === '041' || cstIcms === '060') {
      vlBcIcms = cstIcms === '060' ? vlItem : 0;
    }

    let vlIcms = 0;
    if (taxData.aliqIcms > 0 && vlBcIcms > 0 && (cstIcms === '000' || cstIcms === '020' || cstIcms === '090')) {
      vlIcms = Math.round((vlBcIcms * (taxData.aliqIcms / 100)) * 100) / 100;
    }

    return {
      cstIcms,
      vlBcIcms,
      vlIcms
    };
  };

  // Baseline snapshot sync when SPED file loads
  useEffect(() => {
    if (!spedData) {
      setInitialH010Map(new Map());
      loadedFileKeyRef.current = '';
      return;
    }
    const fileKey = `${spedData.header?.cnpj || ''}-${spedData.header?.dtIni || ''}-${spedData.header?.dtFin || ''}-${blocoH.items.length}`;
    if (loadedFileKeyRef.current !== fileKey) {
      loadedFileKeyRef.current = fileKey;
      const map = new Map<string, {
        qtd: number;
        vlUnit: number;
        vlItem: number;
        h020Cst?: string;
        h020Bc?: number;
        h020Icms?: number;
      }>();
      blocoH.items.forEach(item => {
        const activeH020 = item.h020 || (item.h020List && item.h020List[0]);
        map.set(item.codItem, {
          qtd: item.qtd,
          vlUnit: item.vlUnit,
          vlItem: item.vlItem,
          h020Cst: activeH020?.cstIcms,
          h020Bc: activeH020?.vlBcIcms,
          h020Icms: activeH020?.vlIcms
        });
      });
      setInitialH010Map(map);
    }
  }, [spedData]);

  // Summary of Altered Products (Resumo dos produtos que foram alterados)
  const alteredProducts = useMemo(() => {
    if (!spedData || initialH010Map.size === 0) return [];

    const map0200 = new Map<string, Sped0200Item>();
    items0200.forEach(i => map0200.set(i.codItem, i));

    const list: {
      codItem: string;
      descrItem: string;
      ncm: string;
      unid: string;
      status: 'modified' | 'added' | 'removed';
      oldQtd?: number;
      newQtd?: number;
      oldVlUnit?: number;
      newVlUnit?: number;
      oldVlItem?: number;
      newVlItem?: number;
      oldH020Cst?: string;
      newH020Cst?: string;
      oldH020Bc?: number;
      newH020Bc?: number;
      oldH020Icms?: number;
      newH020Icms?: number;
      changes: string[];
    }[] = [];

    const currentCodes = new Set<string>();

    blocoH.items.forEach(item => {
      currentCodes.add(item.codItem);
      const initial = initialH010Map.get(item.codItem);
      const item0200 = map0200.get(item.codItem);
      const descrItem = item0200?.descrItem || item.codItem;
      const ncm = item0200?.ncm || 'N/D';
      const unid = item.unid || item0200?.unid || 'UN';

      const activeH020 = item.h020 || (item.h020List && item.h020List[0]);
      const currentCst = activeH020?.cstIcms;
      const currentBc = activeH020?.vlBcIcms;
      const currentIcms = activeH020?.vlIcms;

      if (!initial) {
        list.push({
          codItem: item.codItem,
          descrItem,
          ncm,
          unid,
          status: 'added',
          newQtd: item.qtd,
          newVlUnit: item.vlUnit,
          newVlItem: item.vlItem,
          newH020Cst: currentCst,
          newH020Bc: currentBc,
          newH020Icms: currentIcms,
          changes: ['Item Novo Adicionado']
        });
      } else {
        const changes: string[] = [];
        if (Math.abs(initial.qtd - item.qtd) > 0.0001) {
          changes.push(`Qtd: ${initial.qtd} → ${item.qtd}`);
        }
        if (Math.abs(initial.vlUnit - item.vlUnit) > 0.001) {
          changes.push(`Preço: R$ ${initial.vlUnit.toFixed(2)} → R$ ${item.vlUnit.toFixed(2)}`);
        }
        if (Math.abs(initial.vlItem - item.vlItem) > 0.01) {
          changes.push(`Total: R$ ${initial.vlItem.toFixed(2)} → R$ ${item.vlItem.toFixed(2)}`);
        }
        if (initial.h020Cst !== currentCst) {
          changes.push(`H020 CST: ${initial.h020Cst || 'Sem H020'} → ${currentCst || 'Sem H020'}`);
        } else if (
          (initial.h020Bc !== undefined || currentBc !== undefined) &&
          Math.abs((initial.h020Bc || 0) - (currentBc || 0)) > 0.01
        ) {
          changes.push(`H020 BC: R$ ${(initial.h020Bc || 0).toFixed(2)} → R$ ${(currentBc || 0).toFixed(2)}`);
        }

        if (changes.length > 0) {
          list.push({
            codItem: item.codItem,
            descrItem,
            ncm,
            unid,
            status: 'modified',
            oldQtd: initial.qtd,
            newQtd: item.qtd,
            oldVlUnit: initial.vlUnit,
            newVlUnit: item.vlUnit,
            oldVlItem: initial.vlItem,
            newVlItem: item.vlItem,
            oldH020Cst: initial.h020Cst,
            newH020Cst: currentCst,
            oldH020Bc: initial.h020Bc,
            newH020Bc: currentBc,
            oldH020Icms: initial.h020Icms,
            newH020Icms: currentIcms,
            changes
          });
        }
      }
    });

    initialH010Map.forEach((initial, codItem) => {
      if (!currentCodes.has(codItem)) {
        const item0200 = map0200.get(codItem);
        list.push({
          codItem,
          descrItem: item0200?.descrItem || codItem,
          ncm: item0200?.ncm || 'N/D',
          unid: item0200?.unid || 'UN',
          status: 'removed',
          oldQtd: initial.qtd,
          oldVlUnit: initial.vlUnit,
          oldVlItem: initial.vlItem,
          oldH020Cst: initial.h020Cst,
          oldH020Bc: initial.h020Bc,
          oldH020Icms: initial.h020Icms,
          changes: ['Item Removido']
        });
      }
    });

    return list;
  }, [spedData, initialH010Map, items0200, blocoH.items]);

  // Restore item to original baseline values
  const handleRestoreItem = (codItem: string) => {
    if (!spedData) return;
    const initial = initialH010Map.get(codItem);
    if (!initial) return;

    const itemExists = blocoH.items.some(i => i.codItem === codItem);
    let updatedItems: SpedH010Item[];

    if (itemExists) {
      updatedItems = blocoH.items.map(i => {
        if (i.codItem === codItem) {
          let h020Obj: SpedH020Item | undefined = undefined;
          if (initial.h020Cst) {
            h020Obj = {
              cstIcms: initial.h020Cst,
              vlBcIcms: initial.h020Bc || initial.vlItem,
              vlIcms: initial.h020Icms || 0
            };
          }
          return {
            ...i,
            qtd: initial.qtd,
            vlUnit: initial.vlUnit,
            vlItem: initial.vlItem,
            ...(h020Obj ? { h020: h020Obj, h020List: [h020Obj] } : { h020: undefined, h020List: undefined })
          };
        }
        return i;
      });
    } else {
      let h020Obj: SpedH020Item | undefined = undefined;
      if (initial.h020Cst) {
        h020Obj = {
          cstIcms: initial.h020Cst,
          vlBcIcms: initial.h020Bc || initial.vlItem,
          vlIcms: initial.h020Icms || 0
        };
      }
      const item0200 = items0200.find(i => i.codItem === codItem);
      const restoredItem: SpedH010Item = {
        codItem,
        unid: item0200?.unid || 'UN',
        qtd: initial.qtd,
        vlUnit: initial.vlUnit,
        vlItem: initial.vlItem,
        indProp: '0',
        ...(h020Obj ? { h020: h020Obj, h020List: [h020Obj] } : {})
      };
      updatedItems = [...blocoH.items, restoredItem];
    }

    const newTotInv = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        vlInv: newTotInv,
        items: updatedItems
      }
    });

    addNotification('Produto Restaurado', `O item ${codItem} foi restaurado para os valores originais do arquivo.`, 'edit');
  };

  // Filtered altered products
  const filteredAlteredProducts = useMemo(() => {
    return alteredProducts.filter(item => {
      if (filterAlteredStatus !== 'all' && item.status !== filterAlteredStatus) return false;
      if (!searchAltered.trim()) return true;
      const term = searchAltered.toLowerCase();
      return (
        item.codItem.toLowerCase().includes(term) ||
        item.descrItem.toLowerCase().includes(term) ||
        item.ncm.toLowerCase().includes(term) ||
        item.changes.some(c => c.toLowerCase().includes(term))
      );
    });
  }, [alteredProducts, searchAltered, filterAlteredStatus]);

  // Filtered 0200 items
  const filtered0200 = useMemo(() => {
    return enriched0200.filter(i => {
      const matchSearch = !search0200 || 
        i.item.codItem.toLowerCase().includes(search0200.toLowerCase()) ||
        i.item.descrItem.toLowerCase().includes(search0200.toLowerCase()) ||
        i.item.ncm.includes(search0200);

      const matchStatus = filterStatus0200 === 'all' ||
        (filterStatus0200 === 'divergent' && i.status === 'divergent') ||
        (filterStatus0200 === 'ok' && i.status === 'ok') ||
        (filterStatus0200 === 'no_rule' && i.status === 'no_rule');

      return matchSearch && matchStatus;
    });
  }, [enriched0200, search0200, filterStatus0200]);

  // Filtered Bloco H items
  const filteredH010 = useMemo(() => {
    if (!searchH010) return blocoH.items;
    const term = searchH010.toLowerCase();
    return blocoH.items.filter(item => {
      const ref0200 = items0200.find(i => i.codItem === item.codItem);
      const descr = ref0200?.descrItem || '';
      return item.codItem.toLowerCase().includes(term) || descr.toLowerCase().includes(term);
    });
  }, [blocoH.items, items0200, searchH010]);

  // Counts for 0200 Audit
  const auditStats = useMemo(() => {
    let total = enriched0200.length;
    let ok = 0;
    let divergent = 0;
    let noRule = 0;

    enriched0200.forEach(i => {
      if (i.status === 'ok') ok++;
      else if (i.status === 'divergent') divergent++;
      else noRule++;
    });

    return { total, ok, divergent, noRule };
  }, [enriched0200]);

  // File Upload Handler (SPED or CSV/TXT)
  const handleFileUpload = async (file: File) => {
    setImportingFile(true);
    try {
      const content = await file.text();
      const parsed = await parseInventoryOrSpedFile(content, file.name);

      if (parsed.isFullSped && parsed.parsedSped) {
        onSpedLoaded(parsed.parsedSped);
        const count0200 = parsed.parsedSped.items0200 ? parsed.parsedSped.items0200.length : 0;
        addNotification(
          'Arquivo SPED Fiscal Carregado',
          `SPED de ${parsed.parsedSped.header.nome} (${count0200} produtos em catálogo) importado com sucesso.`,
          'import'
        );
      } else if (spedData) {
        // Merge into existing SPED
        const existing0200Map = new Map(items0200.map(i => [i.codItem, i]));
        let new0200Count = 0;

        parsed.items0200.forEach(newItem => {
          if (!existing0200Map.has(newItem.codItem)) {
            existing0200Map.set(newItem.codItem, newItem);
            new0200Count++;
          }
        });

        const merged0200 = Array.from(existing0200Map.values());

        // Merge into Bloco H
        const existingHMap = new Map(blocoH.items.map(i => [i.codItem, i]));
        let newHCount = 0;

        parsed.itemsH010.forEach(newItem => {
          existingHMap.set(newItem.codItem, newItem);
          newHCount++;
        });

        const mergedHItems = Array.from(existingHMap.values());
        const newTotInv = mergedHItems.reduce((acc, i) => acc + i.vlItem, 0);

        onUpdateSpedData({
          ...spedData,
          items0200: merged0200,
          blocoH: {
            ...blocoH,
            vlInv: newTotInv,
            items: mergedHItems
          }
        });

        addNotification(
          'Planilha de Estoque Importada',
          `Sucesso! ${newHCount} itens de estoque e ${new0200Count} novos cadastros foram integrados.`,
          'import'
        );
      } else {
        // Create new SpedData structure from scratch
        const newSped: SpedData = {
          header: {
            cnpj: '00.000.000/0001-99',
            nome: parsed.headerName || 'EMPRESA COM ESTOQUE IMPORTADO',
            uf: 'SP',
            dtIni: '01012024',
            dtFin: '31122024'
          },
          items0200: parsed.items0200,
          blocoH: {
            dtInv: '31122024',
            vlInv: parsed.vlTotalInv,
            motInv: '01',
            items: parsed.itemsH010
          },
          documents: [],
          reconciliation: [],
          apuracao: null
        };

        onSpedLoaded(newSped);
        addNotification(
          'Estoque Inicial Criado',
          `Arquivo de estoque processado (${parsed.itemsH010.length} itens, Total R$ ${parsed.vlTotalInv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`,
          'import'
        );
      }

      setIsImportModalOpen(false);
    } catch (err) {
      console.error('Error importing file:', err);
      alert('Erro ao processar o arquivo. Verifique o formato e tente novamente.');
    } finally {
      setImportingFile(false);
    }
  };

  // Delete/Clear imported stock data
  const handleClearStockData = (option: 'blocoH' | 'all') => {
    if (!spedData) return;

    if (option === 'blocoH') {
      onUpdateSpedData({
        ...spedData,
        blocoH: {
          ...blocoH,
          vlInv: 0,
          items: []
        }
      });
      addNotification(
        'Inventário (Bloco H) Limpo',
        'Todos os itens de estoque H010/H020 foram removidos. O cadastro de produtos (0200) foi preservado.',
        'edit'
      );
    } else if (option === 'all') {
      if (spedData.documents && spedData.documents.length > 0) {
        onUpdateSpedData({
          ...spedData,
          items0200: [],
          blocoH: {
            dtInv: '31122024',
            vlInv: 0,
            motInv: '01',
            items: []
          }
        });
      } else {
        onSpedLoaded(null as unknown as SpedData);
      }
      addNotification(
        'Arquivo de Estoque Excluído',
        'Todos os registros de estoque e catálogo de produtos importados foram zerados.',
        'edit'
      );
    }
    setIsDeleteModalOpen(false);
  };

  // Load sample dataset
  const handleLoadSample = () => {
    onSpedLoaded(SAMPLE_STOCK_SPED_DATA);
    addNotification(
      'Demonstração de Estoque Carregada',
      'Estrutura de estoque com Bloco 0200 e Bloco H pronta para testes e auditoria.',
      'import'
    );
  };

  // Edit 0200 fields
  const handleEdit0200Item = (codItem: string, field: 'ncm' | 'aliqIcms' | 'descrItem', value: unknown) => {
    if (!spedData) return;
    const updatedList = items0200.map(i => {
      if (i.codItem === codItem) {
        return { ...i, [field]: value };
      }
      return i;
    });

    onUpdateSpedData({
      ...spedData,
      items0200: updatedList
    });
  };

  // Sync 0200 updates to Matriz Tributária
  const handleSync0200ToMatrix = async () => {
    if (!spedData) return;
    try {
      const newRules: StateTaxRule[] = [...taxMatrix];
      let added = 0;
      let updated = 0;

      items0200.forEach(item => {
        if (!item.ncm) return;
        const cleanNcm = item.ncm.trim();
        const existingIdx = newRules.findIndex(r => r.ncmPrefix.trim() === cleanNcm && (r.uf === spedData.header.uf || r.uf === 'TODOS'));

        if (existingIdx >= 0) {
          if (item.aliqIcms !== undefined) {
            newRules[existingIdx].expectedAliqIcms = item.aliqIcms;
            updated++;
          }
        } else {
          newRules.push({
            id: `rule-0200-${cleanNcm}-${Date.now()}`,
            uf: spedData.header.uf || 'SP',
            ncmPrefix: cleanNcm,
            expectedCst: item.cstIcmsPadrao || '000',
            expectedCfop: ['1102', '2102'],
            descricao: `Regra via 0200: ${item.descrItem}`,
            expectedAliqIcms: item.aliqIcms || 18
          });
          added++;
        }
      });

      await saveGlobalStateTaxMatrix(newRules, effectiveEscritorioId);
      setTaxMatrix(newRules);
      addNotification(
        'Matriz Tributária Atualizada',
        `Matriz atualizada com sucesso (${added} novas regras, ${updated} alteradas).`,
        'rule'
      );
    } catch (e) {
      console.error('Erro ao sincronizar matriz:', e);
      alert('Erro ao salvar na Matriz Tributária.');
    }
  };

  // Apply matrix recommendations to 0200
  const handleApplyMatrixTo0200 = () => {
    if (!spedData) return;
    let correctedCount = 0;
    const updatedList = items0200.map(item => {
      const cleanNcm = (item.ncm || '').replace(/\D/g, '');
      let matchedRule: StateTaxRule | undefined = undefined;

      for (const [prefix, rule] of matrixRulesByNcm.entries()) {
        const cleanPrefix = prefix.replace(/\D/g, '');
        if (cleanNcm.startsWith(cleanPrefix)) {
          matchedRule = rule;
          break;
        }
      }

      if (matchedRule) {
        correctedCount++;
        return {
          ...item,
          aliqIcms: matchedRule.expectedAliqIcms !== undefined ? matchedRule.expectedAliqIcms : item.aliqIcms,
          cstIcmsPadrao: matchedRule.expectedCst ? matchedRule.expectedCst.padStart(3, '0') : item.cstIcmsPadrao
        };
      }
      return item;
    });

    onUpdateSpedData({
      ...spedData,
      items0200: updatedList
    });

    addNotification(
      'Bloco 0200 Atualizado',
      `Tributação de ${correctedCount} produtos ajustada com base nas regras da Matriz.`,
      'edit'
    );
  };

  // Sync 0200 tax info to all C170 document items
  const handleCopy0200ToC170 = () => {
    if (!spedData) return;
    let itemsUpdated = 0;
    const map0200 = new Map<string, Sped0200Item>();
    items0200.forEach(i => map0200.set(i.codItem, i));

    const updatedDocuments = spedData.documents.map(doc => {
      const newItems = doc.items.map(item => {
        const item0200 = map0200.get(item.codItem);
        if (item0200) {
          itemsUpdated++;
          return {
            ...item,
            ncm: item0200.ncm || item.ncm,
            aliqIcms: item0200.aliqIcms !== undefined ? item0200.aliqIcms : item.aliqIcms,
            descrItem: item0200.descrItem || item.descrItem
          };
        }
        return item;
      });
      return { ...doc, items: newItems };
    });

    onUpdateSpedData({
      ...spedData,
      documents: updatedDocuments
    });

    addNotification(
      'Documentos C170 Sincronizados',
      `${itemsUpdated} itens das NFe/C170 foram atualizados com o cadastro 0200.`,
      'edit'
    );
  };

  // Bloco H Handlers
  // Helper to scale H020 records proportionally when H010 item value changes
  const adjustH020Proportionally = (item: SpedH010Item, newVlItem: number): { h020?: SpedH020Item; h020List?: SpedH020Item[] } => {
    const itemRatio = item.vlItem > 0 ? newVlItem / item.vlItem : 1;
    let newH020: SpedH020Item | undefined = undefined;
    let newH020List: SpedH020Item[] | undefined = undefined;

    if (item.h020List && item.h020List.length > 0) {
      newH020List = item.h020List.map(h => ({
        ...h,
        vlBcIcms: Math.round((h.vlBcIcms * itemRatio) * 100) / 100,
        vlIcms: Math.round((h.vlIcms * itemRatio) * 100) / 100
      }));
      newH020 = newH020List[0];
    } else if (item.h020) {
      newH020 = {
        ...item.h020,
        vlBcIcms: Math.round((item.h020.vlBcIcms * itemRatio) * 100) / 100,
        vlIcms: Math.round((item.h020.vlIcms * itemRatio) * 100) / 100
      };
      newH020List = [newH020];
    }

    return { h020: newH020, h020List: newH020List };
  };

  const handleUpdateH010Item = (codItem: string, field: 'qtd' | 'vlUnit' | 'indProp' | 'unid', value: unknown) => {
    if (!spedData) return;
    const updatedItems = blocoH.items.map(item => {
      if (item.codItem === codItem) {
        let newQtd = item.qtd;
        let newVlUnit = item.vlUnit;
        if (field === 'qtd') {
          newQtd = parsePtBrNumber(value as string);
        } else if (field === 'vlUnit') {
          newVlUnit = parsePtBrNumber(value as string);
        }
        const newVlItem = Math.round((newQtd * newVlUnit) * 100) / 100;
        const { h020, h020List } = adjustH020Proportionally(item, newVlItem);
        return {
          ...item,
          [field]: value,
          qtd: newQtd,
          vlUnit: newVlUnit,
          vlItem: newVlItem,
          ...(h020 ? { h020 } : {}),
          ...(h020List ? { h020List } : {})
        };
      }
      return item;
    });

    const newTotInv = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        vlInv: newTotInv,
        items: updatedItems
      }
    });
  };

  const handleRemoveH010Item = (codItem: string) => {
    if (!spedData) return;
    const updatedItems = blocoH.items.filter(i => i.codItem !== codItem);
    const newTotInv = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        vlInv: newTotInv,
        items: updatedItems
      }
    });
  };

  // Individual H020 handlers (NCM-aware)
  const handleAddH020 = (codItem: string, overrideCst?: string) => {
    if (!spedData) return;
    const updatedItems = blocoH.items.map(item => {
      if (item.codItem === codItem) {
        const h020Obj = computeH020ForCodItem(codItem, item.vlItem, overrideCst);
        return {
          ...item,
          h020: h020Obj,
          h020List: [h020Obj]
        };
      }
      return item;
    });

    const taxData = getNcmTaxDataForCodItem(codItem);

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });
    addNotification('Registro H020 Adicionado', `Registro H020 (CST ${overrideCst || taxData.cstIcms}) adicionado conforme NCM ${taxData.ncm} para o item ${codItem}.`, 'edit');
  };

  const handleRemoveH020 = (codItem: string) => {
    if (!spedData) return;
    const updatedItems = blocoH.items.map(item => {
      if (item.codItem === codItem) {
        const newItem = { ...item };
        delete newItem.h020;
        delete newItem.h020List;
        return newItem;
      }
      return item;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });
    addNotification('Registro H020 Removido', `Registro H020 removido do item ${codItem}.`, 'edit');
  };

  const handleUpdateH020Field = (codItem: string, field: 'cstIcms' | 'vlBcIcms' | 'vlIcms', value: unknown) => {
    if (!spedData) return;
    const updatedItems = blocoH.items.map(item => {
      if (item.codItem === codItem) {
        const currentH020 = item.h020 || (item.h020List && item.h020List[0]) || computeH020ForCodItem(codItem, item.vlItem);
        const updatedH020: SpedH020Item = {
          ...currentH020,
          [field]: field === 'cstIcms' ? String(value) : parsePtBrNumber(value as string)
        };
        return {
          ...item,
          h020: updatedH020,
          h020List: [updatedH020]
        };
      }
      return item;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });
  };

  // Bulk H020 handlers: Auto NCM Tax Injection & Filtered NCM Injection
  const handleInjectH020AutoNcm = () => {
    if (!spedData || blocoH.items.length === 0) return;
    let countInjected = 0;

    const updatedItems = blocoH.items.map(item => {
      const h020Obj = computeH020ForCodItem(item.codItem, item.vlItem);
      countInjected++;
      return {
        ...item,
        h020: h020Obj,
        h020List: [h020Obj]
      };
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });

    addNotification(
      'H020 Injetado por NCM',
      `Informações do H020 geradas com sucesso para ${countInjected} itens do estoque com base no NCM (0200 / Matriz Tributária).`,
      'edit'
    );
  };

  const handleBulkAddH020Filtered = (cstToApply: string, ncmFilter: string) => {
    if (!spedData || blocoH.items.length === 0) return;
    let updatedCount = 0;

    const updatedItems = blocoH.items.map(item => {
      const taxData = getNcmTaxDataForCodItem(item.codItem);
      if (!ncmFilter || taxData.ncm === ncmFilter) {
        const h020Obj = computeH020ForCodItem(item.codItem, item.vlItem, cstToApply);
        updatedCount++;
        return {
          ...item,
          h020: h020Obj,
          h020List: [h020Obj]
        };
      }
      return item;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });

    addNotification(
      'Injeção H020 por NCM',
      `Registro H020 (CST ${cstToApply}) aplicado a ${updatedCount} itens ${ncmFilter ? `da NCM ${ncmFilter}` : 'do estoque'}.`,
      'edit'
    );
  };

  // Restore individual H020 to original file state
  const handleRestoreH020ToOriginal = (codItem: string) => {
    if (!spedData) return;
    const initial = initialH010Map.get(codItem);
    
    const updatedItems = blocoH.items.map(item => {
      if (item.codItem === codItem) {
        const newItem = { ...item };
        if (initial && initial.h020Cst) {
          const h020Obj: SpedH020Item = {
            cstIcms: initial.h020Cst,
            vlBcIcms: initial.h020Bc !== undefined ? initial.h020Bc : item.vlItem,
            vlIcms: initial.h020Icms !== undefined ? initial.h020Icms : 0
          };
          newItem.h020 = h020Obj;
          newItem.h020List = [h020Obj];
        } else {
          delete newItem.h020;
          delete newItem.h020List;
        }
        return newItem;
      }
      return item;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });

    addNotification('H020 Mantido Conforme Arquivo', `Registro H020 do item ${codItem} restaurado para o estado original do arquivo SPED.`, 'edit');
  };

  // Restore ALL H020 records to original SPED file baseline
  const handleRestoreAllH020ToOriginal = () => {
    if (!spedData || blocoH.items.length === 0) return;
    let countRestored = 0;

    const updatedItems = blocoH.items.map(item => {
      const initial = initialH010Map.get(item.codItem);
      const newItem = { ...item };
      if (initial && initial.h020Cst) {
        const h020Obj: SpedH020Item = {
          cstIcms: initial.h020Cst,
          vlBcIcms: initial.h020Bc !== undefined ? initial.h020Bc : item.vlItem,
          vlIcms: initial.h020Icms !== undefined ? initial.h020Icms : 0
        };
        newItem.h020 = h020Obj;
        newItem.h020List = [h020Obj];
        countRestored++;
      } else {
        delete newItem.h020;
        delete newItem.h020List;
      }
      return newItem;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });

    addNotification(
      'H020 Mantido Conforme Arquivo',
      `Todos os registros H020 do inventário foram restaurados para o arquivo SPED de origem (${countRestored} com H020 mantido).`,
      'edit'
    );
  };

  const handleBulkRemoveH020 = () => {
    if (!spedData || blocoH.items.length === 0) return;
    const updatedItems = blocoH.items.map(item => {
      const newItem = { ...item };
      delete newItem.h020;
      delete newItem.h020List;
      return newItem;
    });

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        items: updatedItems
      }
    });
    addNotification('Remoção H020 em Massa', `Registro H020 removido de todos os ${updatedItems.length} itens do inventário.`, 'edit');
  };

  // Bulk factor adjustment
  const handleApplyBulkFactor = () => {
    const factor = parsePtBrNumber(bulkFactor);
    if (isNaN(factor) || factor <= 0) {
      alert('Informe um fator válido (ex: 1,05 para +5%, 0,90 para -10%).');
      return;
    }

    if (!spedData || !blocoH.items || blocoH.items.length === 0) {
      alert('Inventário Bloco H está vazio. Adicione itens antes de aplicar o fator.');
      return;
    }

    const updatedItems = blocoH.items.map(i => {
      const newQtd = Math.round((i.qtd * factor) * 1000) / 1000;
      const newVlItem = Math.round((newQtd * i.vlUnit) * 100) / 100;
      const { h020, h020List } = adjustH020Proportionally(i, newVlItem);
      return {
        ...i,
        qtd: newQtd,
        vlItem: newVlItem,
        ...(h020 ? { h020 } : {}),
        ...(h020List ? { h020List } : {})
      };
    });

    const newTotInv = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        vlInv: newTotInv,
        items: updatedItems
      }
    });

    addNotification(
      'Reajuste por Fator',
      `Fator ${factor} aplicado a ${updatedItems.length} itens do inventário. Novo total: R$ ${newTotInv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      'edit'
    );
  };

  // Core Target Stock Value Solver Engine
  const runTargetStockValue = (target: number, inputDisplayStr?: string) => {
    if (isNaN(target) || target <= 0) {
      alert('Informe um valor total de inventário válido maior que zero (ex: 15.000,00 ou 15000).');
      return;
    }

    const baseSped: SpedData = spedData || {
      header: { cnpj: '00.000.000/0001-99', nome: 'ESTOQUE MANUAL CADASTRADO', uf: 'SP', dtIni: '01012024', dtFin: '31122024' },
      items0200: [],
      blocoH: { dtInv: '31122024', vlInv: 0, motInv: '01', items: [] },
      documents: [],
      reconciliation: [],
      apuracao: null
    };

    const currentBlocoH = baseSped.blocoH || { dtInv: '31122024', vlInv: 0, motInv: '01', items: [] };

    let itemsToProcess = currentBlocoH.items ? [...currentBlocoH.items] : [];
    
    // Auto-create items if inventory is empty
    if (itemsToProcess.length === 0) {
      if (baseSped.items0200 && baseSped.items0200.length > 0) {
        itemsToProcess = baseSped.items0200.map(i0200 => ({
          codItem: i0200.codItem,
          unid: i0200.unid || 'UN',
          qtd: 10,
          vlUnit: 10.00,
          vlItem: 100.00,
          indProp: '0'
        }));
      } else {
        itemsToProcess = [
          { codItem: 'PRD001', unid: 'UN', qtd: 10, vlUnit: 100.00, vlItem: 1000.00, indProp: '0' },
          { codItem: 'PRD002', unid: 'UN', qtd: 20, vlUnit: 150.00, vlItem: 3000.00, indProp: '0' },
          { codItem: 'PRD003', unid: 'UN', qtd: 10, vlUnit: 100.00, vlItem: 1000.00, indProp: '0' }
        ];
      }
    }

    // Ensure baseline items don't have 0 quantities
    itemsToProcess = itemsToProcess.map(i => {
      const q = i.qtd <= 0 ? 1 : i.qtd;
      const v = i.vlUnit <= 0 ? 10 : i.vlUnit;
      return {
        ...i,
        qtd: q,
        vlUnit: v,
        vlItem: Math.round(q * v * 100) / 100
      };
    });

    const currentTotal = itemsToProcess.reduce((acc, i) => acc + i.vlItem, 0);
    const ratio = target / currentTotal;

    // Stock adjustments must strictly modify QUANTITY only, keeping unit prices (vlUnit) fixed from SPED/0200 catalog
    const updatedItems: SpedH010Item[] = itemsToProcess.map(i => {
      const newQtd = Math.max(0.001, Math.round((i.qtd * ratio) * 1000) / 1000);
      const newVlItem = Math.round((newQtd * i.vlUnit) * 100) / 100;
      const { h020, h020List } = adjustH020Proportionally(i, newVlItem);
      return {
        ...i,
        qtd: newQtd,
        vlItem: newVlItem,
        ...(h020 ? { h020 } : {}),
        ...(h020List ? { h020List } : {})
      };
    });

    // Cent-exact adjustment to force exact target matching by adjusting item quantity (never unit price)
    let calculatedSum = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;
    const diff = Math.round((target - calculatedSum) * 100) / 100;

    if (diff !== 0 && updatedItems.length > 0) {
      let maxIdx = 0;
      let maxVal = updatedItems[0].vlItem;
      for (let idx = 1; idx < updatedItems.length; idx++) {
        if (updatedItems[idx].vlItem > maxVal) {
          maxVal = updatedItems[idx].vlItem;
          maxIdx = idx;
        }
      }
      const itemToAdjust = updatedItems[maxIdx];
      const adjustedVlItem = Math.round((itemToAdjust.vlItem + diff) * 100) / 100;
      const adjustedQtd = itemToAdjust.vlUnit > 0 
        ? Math.round((adjustedVlItem / itemToAdjust.vlUnit) * 1000) / 1000 
        : itemToAdjust.qtd;
      const finalVlItem = Math.round((adjustedQtd * itemToAdjust.vlUnit) * 100) / 100;
      const { h020, h020List } = adjustH020Proportionally(itemToAdjust, finalVlItem);
      updatedItems[maxIdx] = {
        ...itemToAdjust,
        qtd: adjustedQtd,
        vlItem: finalVlItem,
        ...(h020 ? { h020 } : {}),
        ...(h020List ? { h020List } : {})
      };
      calculatedSum = Math.round(updatedItems.reduce((acc, i) => acc + i.vlItem, 0) * 100) / 100;
    }

    const diffFromOriginal = Math.round((calculatedSum - currentTotal) * 100) / 100;
    const percentChange = currentTotal > 0 ? (diffFromOriginal / currentTotal) * 100 : 0;

    const summaryData = {
      originalTotal: currentTotal,
      newTotal: calculatedSum,
      targetRequested: target,
      diff: diffFromOriginal,
      percentChange,
      ratio,
      mode: targetMode,
      itemCount: updatedItems.length,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setLastRecalcSummary(summaryData);

    const newSpedData: SpedData = {
      ...baseSped,
      blocoH: {
        ...currentBlocoH,
        vlInv: calculatedSum,
        items: updatedItems
      }
    };

    if (spedData) {
      onUpdateSpedData(newSpedData);
    } else {
      onSpedLoaded(newSpedData);
    }

    addNotification(
      'Reajuste de Alvo do Estoque',
      `Inventário do Bloco H recalculado com sucesso de R$ ${currentTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} para exatamente R$ ${calculatedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`,
      'edit'
    );
  };

  // Target Stock Value recalculation handler
  const handleApplyTargetStockValue = () => {
    let target = parsePtBrNumber(targetStockValue);
    if ((isNaN(target) || target <= 0) && !targetStockValue) {
      const userInput = prompt('Informe o valor total desejado para o recalculo do estoque (ex: 15000):', '15000');
      if (!userInput) return;
      target = parsePtBrNumber(userInput);
      setTargetStockValue(userInput);
    }
    runTargetStockValue(target, targetStockValue);
  };

  // Add Item Manually
  const handleAddManualItem = () => {
    if (!newItemCode.trim() || !newItemDescr.trim()) {
      alert('Informe ao menos o Código e a Descrição do produto.');
      return;
    }

    const code = newItemCode.trim();
    const descr = newItemDescr.trim();
    const ncm = newItemNcm.trim().replace(/\D/g, '') || '00000000';
    const unid = newItemUnid.trim().toUpperCase() || 'UN';

    const baseSped: SpedData = spedData || {
      header: { cnpj: '00.000.000/0001-99', nome: 'NOVO ESTOQUE CADASTRADO', uf: 'SP', dtIni: '01012024', dtFin: '31122024' },
      items0200: [],
      blocoH: { dtInv: '31122024', vlInv: 0, motInv: '01', items: [] },
      documents: [],
      reconciliation: [],
      apuracao: null
    };

    const current0200 = baseSped.items0200 || [];

    // Add 0200 catalog item if missing
    const existing0200 = current0200.find(i => i.codItem === code);
    const updated0200 = [...current0200];
    if (!existing0200) {
      updated0200.push({
        codItem: code,
        descrItem: descr,
        ncm,
        unid,
        tipoItem: '00',
        aliqIcms: 18
      });
    }

    // Add H010 inventory item
    const currentHItems = baseSped.blocoH?.items || [];
    const vlItem = Math.round((newItemQtd * newItemVlUnit) * 100) / 100;
    const updatedHItems = [
      ...currentHItems.filter(i => i.codItem !== code),
      {
        codItem: code,
        unid,
        qtd: newItemQtd,
        vlUnit: newItemVlUnit,
        vlItem,
        indProp: '0'
      }
    ];

    const newTotInv = updatedHItems.reduce((acc, i) => acc + i.vlItem, 0);

    const newSped: SpedData = {
      ...baseSped,
      items0200: updated0200,
      blocoH: {
        dtInv: baseSped.blocoH?.dtInv || '31122024',
        vlInv: newTotInv,
        motInv: '01',
        items: updatedHItems
      }
    };

    if (!spedData) {
      onSpedLoaded(newSped);
    } else {
      onUpdateSpedData(newSped);
    }

    setIsManualAddOpen(false);
    setNewItemCode('');
    setNewItemDescr('');
    setNewItemNcm('');

    addNotification('Item Adicionado', `Produto "${descr}" inserido no catálogo e no inventário.`, 'edit');
  };

  // Modal 0200 items filtered for picker
  const modal0200Filtered = useMemo(() => {
    if (!modalSearch) return items0200;
    const term = modalSearch.toLowerCase();
    return items0200.filter(i => 
      i.codItem.toLowerCase().includes(term) ||
      i.descrItem.toLowerCase().includes(term) ||
      i.ncm.includes(term)
    );
  }, [items0200, modalSearch]);

  // Import selected 0200 items into H010
  const handleImport0200ToH010 = () => {
    if (!spedData) return;
    const existingH010Set = new Set(blocoH.items.map(i => i.codItem));
    const newH010Items: SpedH010Item[] = [...blocoH.items];
    let importedCount = 0;

    items0200.forEach(item0200 => {
      if (selected0200Codes.has(item0200.codItem) && !existingH010Set.has(item0200.codItem)) {
        const initQtd = 10;
        const initVlUnit = importDefaultPrice || 10.00;
        const initVlItem = Math.round((initQtd * initVlUnit) * 100) / 100;

        newH010Items.push({
          codItem: item0200.codItem,
          unid: item0200.unid || 'UN',
          qtd: initQtd,
          vlUnit: initVlUnit,
          vlItem: initVlItem,
          indProp: '0'
        });
        importedCount++;
      }
    });

    const newTotInv = newH010Items.reduce((acc, i) => acc + i.vlItem, 0);

    onUpdateSpedData({
      ...spedData,
      blocoH: {
        ...blocoH,
        vlInv: newTotInv,
        items: newH010Items
      }
    });

    setIs0200PickerOpen(false);
    setSelected0200Codes(new Set());

    addNotification(
      'Produtos Adicionados ao Inventário',
      `${importedCount} novos produtos inseridos no Registro H010.`,
      'import'
    );
  };

  // Download SPED TXT
  const handleExportSpedFile = () => {
    if (!spedData) return;
    const res = exportSped(spedData, []);
    if (res.erros.length > 0) {
      alert(`Erro na geração do SPED: ${res.erros.join(', ')}`);
      return;
    }

    const blob = new Blob([res.textoCorrigido], { type: 'text/plain;charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SPED_EFD_${spedData.header.cnpj}_ESTOQUE_AJUSTADO.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addNotification(
      'Arquivo SPED Exportado',
      `SPED gerado com Bloco 0200 e Bloco H formatados com sucesso.`,
      'export'
    );
  };

  // =========================================================
  // RENDER: EMPTY / ONBOARDING STATE
  // =========================================================
  if (!spedData) {
    return (
      <div className={`flex-1 flex flex-col h-screen overflow-y-auto font-sans transition-colors duration-200 ${theme.mainBg}`}>
        {/* Hidden file input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".txt,.csv,.tsv,.xlsx"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
            e.target.value = '';
          }}
          className="hidden" 
        />

        {/* Top bar with theme switcher */}
        <div className="w-full max-w-5xl mx-auto px-6 pt-6 flex justify-end">
          <button
            onClick={toggleTheme}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              isDarkTheme
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                : 'bg-white hover:bg-slate-100 text-indigo-700 border-slate-300 shadow-2xs'
            }`}
          >
            {isDarkTheme ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span>Tema Claro</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-600" />
                <span>Tema Escuro</span>
              </>
            )}
          </button>
        </div>

        <div className="max-w-5xl mx-auto w-full px-6 py-8 flex flex-col items-center justify-center space-y-8">
          {/* Header Banner */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 mb-2">
              <Boxes className="w-8 h-8" />
            </div>
            <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${theme.textTitle}`}>
              Módulo de Gestão & Engenharia de Estoque
            </h1>
            <p className={`text-sm max-w-xl mx-auto leading-relaxed ${theme.textMuted}`}>
              Realize a auditoria tributária do cadastro de produtos (Bloco 0200) e monte, ajuste ou corrija o Livro de Inventário Físico (Bloco H) da empresa.
            </p>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
            {/* Card 1: Import File */}
            <div 
              onClick={() => fileInputRef.current?.click()}
              className={`group p-6 rounded-lg transition-all duration-200 cursor-pointer flex flex-col justify-between hover:border-emerald-500/50 ${theme.cardBg} hover:shadow-sm`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold transition-colors ${theme.textTitle} group-hover:text-emerald-600`}>
                    Importar Arquivo de Estoque
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.textMuted}`}>
                    Carregue um arquivo <span className="font-mono text-emerald-600 font-bold">.txt (SPED)</span> ou planilha <span className="font-mono text-emerald-600 font-bold">.csv / .txt</span> com produtos e inventário.
                  </p>
                </div>
              </div>
              <div className="pt-6 mt-4 border-t border-slate-200/60 flex items-center text-xs font-bold text-emerald-600">
                <span>Selecionar Arquivo</span>
                <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>

            {/* Card 2: Manual Entry */}
            <div 
              onClick={() => setIsManualAddOpen(true)}
              className={`group p-6 rounded-lg transition-all duration-200 cursor-pointer flex flex-col justify-between hover:border-indigo-500/50 ${theme.cardBg} hover:shadow-sm`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold transition-colors ${theme.textTitle} group-hover:text-indigo-600`}>
                    Criar Estoque do Zero
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.textMuted}`}>
                    Cadastre itens de estoque manualmente informe códigos, NCM, quantidades e valores para gerar o Bloco H.
                  </p>
                </div>
              </div>
              <div className="pt-6 mt-4 border-t border-slate-200/60 flex items-center text-xs font-bold text-indigo-600">
                <span>Cadastrar Item</span>
                <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>

            {/* Card 3: Load Demo */}
            <div 
              onClick={handleLoadSample}
              className={`group p-6 rounded-lg transition-all duration-200 cursor-pointer flex flex-col justify-between hover:border-amber-500/50 ${theme.cardBg} hover:shadow-sm`}
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className={`text-base font-bold transition-colors ${theme.textTitle} group-hover:text-amber-600`}>
                    Carregar Exemplo de Teste
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.textMuted}`}>
                    Carregue um conjunto demonstrativo completo com combustíveis e lubrificantes para testar as ferramentas.
                  </p>
                </div>
              </div>
              <div className="pt-6 mt-4 border-t border-slate-200/60 flex items-center text-xs font-bold text-amber-600">
                <span>Carregar Demonstração</span>
                <ArrowUpRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Info Features */}
          <div className={`rounded-lg p-6 w-full grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs ${theme.cardBg}`}>
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 mt-0.5 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className={`font-bold mb-0.5 ${theme.textTitle}`}>Auditoria 0200 x Matriz</p>
                <p className={theme.textMuted}>Verifica automaticamente se NCM e alíquotas de ICMS no catálogo estão alinhadas com a legislação tributária.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 mt-0.5 shrink-0">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <p className={`font-bold mb-0.5 ${theme.textTitle}`}>Calculadora do Bloco H</p>
                <p className={theme.textMuted}>Ajuste quantidades por multiplicador ou defina o valor total exato do estoque (R$) com recálculo proporcional.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 mt-0.5 shrink-0">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <p className={`font-bold mb-0.5 ${theme.textTitle}`}>Exportação TXT Oficial</p>
                <p className={theme.textMuted}>Gere o arquivo SPED Fiscal ajustado nos padrões da Receita Federal com registros 0200, H005 e H010 validados.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Manual Add Item */}
        {isManualAddOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Novo Produto no Estoque</span>
                </h3>
                <button onClick={() => setIsManualAddOpen(false)} className="text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Código do Item / SKU *</label>
                  <input
                    type="text"
                    value={newItemCode}
                    onChange={e => setNewItemCode(e.target.value)}
                    placeholder="Ex: PROD-1001"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Descrição do Produto *</label>
                  <input
                    type="text"
                    value={newItemDescr}
                    onChange={e => setNewItemDescr(e.target.value)}
                    placeholder="Ex: Óleo Lubrificante 1L"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">NCM (8 dígitos)</label>
                    <input
                      type="text"
                      value={newItemNcm}
                      onChange={e => setNewItemNcm(e.target.value)}
                      placeholder="Ex: 27101911"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Unidade de Medida</label>
                    <input
                      type="text"
                      value={newItemUnid}
                      onChange={e => setNewItemUnid(e.target.value)}
                      placeholder="UN, L, CX, KG"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-indigo-500 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Quantidade Física</label>
                    <input
                      type="number"
                      step="0.001"
                      value={newItemQtd}
                      onChange={e => setNewItemQtd(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono font-bold focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">Valor Unitário (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newItemVlUnit}
                      onChange={e => setNewItemVlUnit(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white font-mono focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 flex justify-between font-mono">
                  <span className="text-slate-400">Total do Item:</span>
                  <span className="font-bold text-emerald-400">
                    R$ {(newItemQtd * newItemVlUnit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setIsManualAddOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddManualItem}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  Salvar Produto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // RENDER: MAIN WORKSPACE WHEN SPED DATA IS PRESENT
  // =========================================================
  return (
    <div className={`flex-1 flex flex-col h-screen overflow-y-auto font-sans transition-colors duration-200 ${theme.mainBg}`}>
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        accept=".txt,.csv,.tsv,.xlsx"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          e.target.value = '';
        }}
        className="hidden" 
      />

      {/* Module Header Toolbar */}
      <div className={`px-6 py-4 shrink-0 transition-colors ${theme.headerBg}`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className={`text-base font-bold ${theme.textTitle}`}>Módulo de Estoque e Cadastro Fiscal</h1>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${theme.badgeBg}`}>
                  UF: {spedData.header.uf || 'SP'}
                </span>
              </div>
              <p className={`text-xs mt-0.5 font-mono ${theme.textMuted}`}>
                {spedData.header.nome} | CNPJ: {spedData.header.cnpj}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 flex-wrap">
            {/* Theme Switcher Toggle */}
            <button
              onClick={toggleTheme}
              className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                isDarkTheme
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                  : 'bg-white hover:bg-slate-100 text-indigo-700 border-slate-300 shadow-2xs'
              }`}
              title={isDarkTheme ? "Mudar para Tela Clara (Fundo Claro)" : "Mudar para Tela Escura (Fundo Escuro)"}
            >
              {isDarkTheme ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span>Fundo Claro</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-indigo-600" />
                  <span>Fundo Escuro</span>
                </>
              )}
            </button>

            {/* Explicit File Import Button */}
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-sm"
              title="Importar novo arquivo SPED ou planilha de estoque"
            >
              <Upload className="w-4 h-4" />
              <span>Importar Arquivo</span>
            </button>

            <button
              onClick={() => setIsManualAddOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all ${theme.btnSecondary}`}
            >
              <Plus className="w-4 h-4 text-emerald-600 font-bold" />
              <span>+ Novo Item</span>
            </button>

            <button
              onClick={handleExportSpedFile}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              <span>Exportar SPED (.txt)</span>
            </button>

            {/* Clear / Delete Imported Stock Button */}
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-rose-600 font-semibold text-xs transition-all border border-rose-200/80 hover:bg-rose-50/80 shadow-2xs ${
                isDarkTheme ? 'bg-slate-800 hover:bg-rose-950/80 text-rose-300 border-slate-700' : ''
              }`}
              title="Apagar dados ou limpar o arquivo do estoque importado"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
              <span>Apagar Arquivo Estoque</span>
            </button>
          </div>
        </div>

        {/* Dense Status Metrics Bar */}
        <div className={`max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-3 border-t font-mono text-xs ${isDarkTheme ? 'border-slate-800/60' : 'border-slate-200/80'}`}>
          <div className={`px-3.5 py-2 rounded-xl flex items-center justify-between ${theme.cardHighlight}`}>
            <span className={`font-sans text-[11px] ${theme.textMuted}`}>Itens no 0200:</span>
            <span className={`font-bold ${theme.textTitle}`}>{items0200.length}</span>
          </div>

          <div className={`px-3.5 py-2 rounded-xl flex items-center justify-between ${theme.cardHighlight}`}>
            <span className={`font-sans text-[11px] ${theme.textMuted}`}>Divergências Matriz:</span>
            <span className={`font-bold ${auditStats.divergent > 0 ? 'text-amber-600 font-extrabold' : theme.textTitle}`}>
              {auditStats.divergent}
            </span>
          </div>

          <div className={`px-3.5 py-2 rounded-xl flex items-center justify-between ${theme.cardHighlight}`}>
            <span className={`font-sans text-[11px] ${theme.textMuted}`}>Itens no H010:</span>
            <span className="font-bold text-emerald-600">{blocoH.items.length}</span>
          </div>

          <div className={`px-3.5 py-2 rounded-xl flex items-center justify-between ${theme.cardHighlight}`}>
            <span className={`font-sans text-[11px] ${theme.textMuted}`}>Total Inventário H005:</span>
            <span className="font-bold text-emerald-600">
              R$ {(blocoH.vlInv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Main SubTab Bar */}
      <div className={`px-6 shrink-0 border-b transition-colors ${theme.subtabBg}`}>
        <div className="max-w-7xl mx-auto flex space-x-2 pt-2">
          <button
            onClick={() => setActiveSubTab('audit0200')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'audit0200' ? theme.subtabActiveAudit : theme.subtabInactive
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Auditoria de Cadastros (Bloco 0200)</span>
            {auditStats.divergent > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 font-mono">
                {auditStats.divergent}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('blocoH')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'blocoH' ? theme.subtabActiveBlocoH : theme.subtabInactive
            }`}
          >
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span>Livro de Inventário (Bloco H - H005 / H010)</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${theme.badgeBg}`}>
              {blocoH.items.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('altered')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'altered' ? theme.subtabActiveAltered : theme.subtabInactive
            }`}
          >
            <History className="w-4 h-4 text-sky-600" />
            <span>Produtos Alterados</span>
            {alteredProducts.length > 0 ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-800 font-mono border border-sky-500/30">
                {alteredProducts.length}
              </span>
            ) : (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${theme.badgeBg}`}>
                0
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center space-x-2 ${
              activeSubTab === 'overview' ? theme.subtabActiveOverview : theme.subtabInactive
            }`}
          >
            <PieChart className="w-4 h-4 text-amber-600" />
            <span>Resumo & Diagnóstico</span>
          </button>
        </div>
      </div>

      {/* Workspace Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        
        {/* SUBTAB 1: Auditoria do Bloco 0200 */}
        {activeSubTab === 'audit0200' && (
          <div className="space-y-4">
            {/* Filter and Action Bar */}
            <div className={`p-3.5 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between gap-3 ${theme.cardBg}`}>
              <div className="flex items-center space-x-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search0200}
                    onChange={e => setSearch0200(e.target.value)}
                    placeholder="Filtrar código, descrição ou NCM..."
                    className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs focus:outline-hidden font-mono ${theme.inputBg}`}
                  />
                </div>
                <select
                  value={filterStatus0200}
                  onChange={e => setFilterStatus0200(e.target.value as unknown as 'all')}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-medium focus:outline-hidden ${theme.selectBg}`}
                >
                  <option value="all">Todos os Status</option>
                  <option value="divergent">Divergentes ({auditStats.divergent})</option>
                  <option value="ok">Conformes ({auditStats.ok})</option>
                  <option value="no_rule">Sem Regra ({auditStats.noRule})</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <button
                  onClick={handleApplyMatrixTo0200}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
                  title="Aplica alíquotas e CST esperados da Matriz nos itens 0200"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Aplicar Regras Matriz</span>
                </button>

                <button
                  onClick={handleCopy0200ToC170}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition-colors ${theme.btnSecondary}`}
                  title="Replica alterações do cadastro 0200 para todos os itens de notas C170"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Sincronizar C170</span>
                </button>

                <button
                  onClick={handleSync0200ToMatrix}
                  className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center space-x-1.5 transition-colors ${theme.btnSecondary}`}
                  title="Salva novas regras NCM na Matriz Tributária com base no 0200"
                >
                  <Database className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Alimentar Matriz</span>
                </button>
              </div>
            </div>

            {/* Table 0200 */}
            <div className={`rounded-lg overflow-hidden ${theme.tableContainer}`}>
              <div className={`p-3.5 flex items-center justify-between text-xs font-mono border-b ${theme.tableTopBar}`}>
                <span>Catálogo de Produtos - Registro 0200</span>
                <span>Exibindo {filtered0200.length} de {items0200.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`text-[11px] uppercase tracking-wider ${theme.tableHeaderBg}`}>
                    <tr>
                      <th className="p-3 font-mono">Código</th>
                      <th className="p-3">Descrição do Item</th>
                      <th className="p-3 font-mono">NCM</th>
                      <th className="p-3">Unid</th>
                      <th className="p-3 font-mono">Alíq ICMS (%)</th>
                      <th className="p-3">Regra Esperada (Matriz)</th>
                      <th className="p-3">Status Auditado</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-mono ${theme.tableRowBorder}`}>
                    {filtered0200.map(({ item, matchedRule, status }) => (
                      <tr key={item.codItem} className={`transition-colors ${theme.tableRowHover}`}>
                        <td className={`p-3 font-bold ${theme.textTitle}`}>{item.codItem}</td>
                        <td className={`p-3 font-sans max-w-sm truncate ${theme.textTitle}`} title={item.descrItem}>
                          {item.descrItem}
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={item.ncm}
                            onChange={e => handleEdit0200Item(item.codItem, 'ncm', e.target.value)}
                            className="w-24 bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs focus:border-indigo-500 font-mono"
                          />
                        </td>
                        <td className="p-3 text-slate-400">{item.unid || 'UN'}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            value={item.aliqIcms !== undefined ? item.aliqIcms : ''}
                            onChange={e => handleEdit0200Item(item.codItem, 'aliqIcms', parseFloat(e.target.value) || 0)}
                            className="w-16 bg-slate-900 border border-slate-700 text-slate-200 rounded-md px-2 py-1 text-xs focus:border-indigo-500 font-mono"
                          />
                        </td>
                        <td className="p-3 font-sans text-[11px]">
                          {matchedRule ? (
                            <div className="text-slate-300 font-mono">
                              <span>CST: {matchedRule.expectedCst || '-'}</span>
                              <span className="mx-1.5 text-slate-600">|</span>
                              <span>Alíq: {matchedRule.expectedAliqIcms !== undefined ? `${matchedRule.expectedAliqIcms}%` : '-'}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Sem regra cadastrada</span>
                          )}
                        </td>
                        <td className="p-3 font-sans">
                          {status === 'ok' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Conforme</span>
                            </span>
                          )}
                          {status === 'divergent' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Divergente</span>
                            </span>
                          )}
                          {status === 'no_rule' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                              <HelpCircle className="w-3 h-3" />
                              <span>Sem Regra</span>
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <button
                            onClick={() => {
                              setSelected0200Codes(new Set([item.codItem]));
                              setIs0200PickerOpen(true);
                            }}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg text-[11px] font-semibold transition-colors"
                          >
                            + Add Inventário
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filtered0200.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                          Nenhum produto cadastrado no Bloco 0200 encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: Bloco H - Livro de Inventário */}
        {activeSubTab === 'blocoH' && (
          <div className="space-y-4">
            {/* Banner for Altered Products */}
            {alteredProducts.length > 0 && (
              <div className="bg-sky-950/40 border border-sky-500/30 p-3 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-sky-200 font-medium">
                  <History className="w-4 h-4 text-sky-400 shrink-0" />
                  <span>
                    Você possui <strong className="text-sky-300 font-mono">{alteredProducts.length} produto(s) alterado(s)</strong> neste estoque em relação ao arquivo SPED original.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('altered')}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center space-x-1 shrink-0 shadow-xs"
                >
                  <span>Ver Resumo de Alterações</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Action Header & Bulk Calculations */}
            <div className={`p-4 rounded-lg space-y-4 ${theme.cardBg}`}>
              <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-3.5 ${isDarkTheme ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
                <div>
                  <h2 className={`text-sm font-bold flex items-center space-x-2 ${theme.textTitle}`}>
                    <PackageCheck className="w-4 h-4 text-emerald-600" />
                    <span>Livro de Inventário Físico (Registro H005 e H010)</span>
                  </h2>
                  <p className={`text-xs mt-0.5 font-mono ${theme.textMuted}`}>
                    Data do Inventário: {blocoH.dtInv || '31/12/2024'} | Valor Total: R$ {(blocoH.vlInv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchH010}
                      onChange={e => setSearchH010(e.target.value)}
                      placeholder="Buscar no inventário..."
                      className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono ${theme.inputBg}`}
                    />
                  </div>

                  <button
                    onClick={() => setIs0200PickerOpen(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition-colors shrink-0 shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Puxar do 0200</span>
                  </button>
                </div>
              </div>

              {/* Precise Tools for Inventory Value & H020 Adjustments */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 text-xs">
                {/* Tool 1: Batch Factor */}
                <div className={`p-3.5 rounded-xl space-y-2 ${theme.cardSubBg}`}>
                  <div className={`flex items-center space-x-1.5 font-bold ${theme.textTitle}`}>
                    <Calculator className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Multiplicador de Qtd em Lote</span>
                  </div>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Aplica um fator multiplicador sobre todas as quantidades atuais (ex: 1.05 = +5%, 0.90 = -10%).
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <input
                      type="text"
                      value={bulkFactor}
                      onChange={e => setBulkFactor(e.target.value)}
                      placeholder="1.05"
                      className={`w-20 rounded-lg px-2.5 py-1 text-xs font-mono font-bold ${theme.inputBg}`}
                    />
                    <button
                      onClick={handleApplyBulkFactor}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-xs transition-colors shadow-2xs"
                    >
                      Aplicar Fator
                    </button>
                  </div>
                </div>

                {/* Tool 2: Target Total Stock Solver */}
                <div className={`p-3.5 rounded-xl space-y-2 ${theme.cardSubBg}`}>
                  <div className={`flex items-center justify-between font-bold ${theme.textTitle}`}>
                    <div className="flex items-center space-x-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Reajuste por Valor Alvo (R$)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-800 border border-emerald-500/30 font-mono text-[10px] font-bold">
                      Apenas Quantidade (Qtd)
                    </span>
                  </div>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    Recalcula exclusivamente as quantidades de todos os itens do Bloco H para atingir o valor H005 exato, mantendo o preço unitário fixo conforme o SPED.
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      value={targetStockValue}
                      onChange={e => setTargetStockValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApplyTargetStockValue()}
                      placeholder="Ex: 15.000,00"
                      className={`w-28 rounded-lg px-2.5 py-1 text-xs font-mono font-bold ${theme.inputBg}`}
                    />
                    <button
                      onClick={handleApplyTargetStockValue}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-2xs"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Recalcular</span>
                    </button>
                  </div>

                  {/* Quick Preset Value Chips */}
                  <div className={`flex flex-wrap items-center gap-1 pt-1 border-t ${isDarkTheme ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
                    <span className={`text-[9px] font-bold uppercase ${theme.textSub}`}>Testes:</span>
                    {['5.000,00', '15.000,00', '50.000,00', '100.000,00'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setTargetStockValue(preset);
                          const num = parsePtBrNumber(preset);
                          if (num > 0) runTargetStockValue(num, preset);
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-all border ${
                          isDarkTheme
                            ? 'bg-slate-950 hover:bg-emerald-600 hover:text-white text-emerald-400 border-slate-800'
                            : 'bg-white hover:bg-emerald-600 hover:text-white text-emerald-700 border-slate-300 shadow-2xs'
                        }`}
                      >
                        R$ {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tool 3: H020 Manager (NCM Tax Sync) */}
                <div className={`p-3.5 rounded-xl space-y-2.5 ${theme.cardSubBg}`}>
                  <div className={`flex items-center justify-between font-bold ${theme.textTitle}`}>
                    <div className="flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                      <span>Gerenciador H020 Conforme NCM (0200)</span>
                    </div>
                    <span className="text-[10px] text-sky-600 font-mono bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">
                      Tax NCM Sync
                    </span>
                  </div>
                  <p className={`text-[11px] ${theme.textMuted}`}>
                    O Registro H020 é preenchido conforme a NCM do produto e Matriz Tributária. Injete automaticamente ou filtre por NCM.
                  </p>
                  
                  <div className="space-y-2 pt-0.5">
                    {/* Auto-Inject All, Keep Original, or Remove All Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleInjectH020AutoNcm}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg text-xs transition-colors flex items-center space-x-1 shadow-2xs"
                        title="Gerar/Injetar H020 automaticamente para todos os itens cruzando a NCM com a Matriz Tributária"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-100" />
                        <span>Injetar Auto por NCM</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRestoreAllH020ToOriginal}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1 border ${theme.btnSecondary}`}
                        title="Manter / Restaurar todos os blocos H020 conforme o arquivo SPED original importado"
                      >
                        <Undo2 className="w-3.5 h-3.5 text-sky-600" />
                        <span>Manter Conforme Arquivo</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleBulkRemoveH020}
                        className={`px-2 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                          isDarkTheme
                            ? 'bg-slate-950 hover:bg-rose-950 hover:text-rose-300 text-slate-400 border-slate-800'
                            : 'bg-white hover:bg-rose-50 text-rose-600 border-slate-300 shadow-2xs'
                        }`}
                        title="Remover H020 de todos os itens do inventário"
                      >
                        Remover Todos
                      </button>
                    </div>

                    {/* Filter & Apply by specific NCM */}
                    <div className={`flex flex-wrap items-center gap-1.5 pt-1.5 border-t ${isDarkTheme ? 'border-slate-800/80' : 'border-slate-200/80'}`}>
                      <span className={`text-[10px] font-medium ${theme.textMuted}`}>Por NCM Específico:</span>
                      <select
                        value={selectedNcmFilter}
                        onChange={e => setSelectedNcmFilter(e.target.value)}
                        className={`rounded-lg px-2 py-0.5 text-xs font-mono max-w-[150px] truncate ${theme.selectBg}`}
                      >
                        <option value="">Todas NCMs ({availableNcms.length})</option>
                        {availableNcms.map(n => (
                          <option key={n.ncm} value={n.ncm}>
                            NCM {n.ncm} ({n.count} {n.count === 1 ? 'item' : 'itens'})
                          </option>
                        ))}
                      </select>

                      <select
                        value={bulkH020Cst}
                        onChange={e => setBulkH020Cst(e.target.value)}
                        className={`rounded-lg px-2 py-0.5 text-xs font-mono ${theme.selectBg}`}
                      >
                        <option value="000">CST 000 - Trib.</option>
                        <option value="020">CST 020 - Red. BC</option>
                        <option value="040">CST 040 - Isenta</option>
                        <option value="060">CST 060 - ST</option>
                        <option value="090">CST 090 - Outras</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => handleBulkAddH020Filtered(bulkH020Cst, selectedNcmFilter)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-all ${theme.btnSecondary}`}
                      >
                        Aplicar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TOTALIZER & RECALCULATION PROOF BANNER */}
            <div className={`rounded-lg p-4 shadow-xs space-y-3 border ${theme.proofCard}`}>
              <div className={`flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 ${isDarkTheme ? 'border-slate-800/80' : 'border-emerald-200/80'}`}>
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className={`text-sm font-bold ${theme.textTitle}`}>Painel Totalizador do Estoque (H005)</h3>
                      {lastRecalcSummary && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-800 border border-emerald-500/40">
                          ✓ Recálculo Auditado
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${theme.textMuted}`}>
                      Consolidação exata em tempo real do Bloco H do SPED Fiscal EFD ICMS/IPI
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className={`text-[10px] uppercase font-sans block ${theme.textMuted}`}>Total do Inventário</span>
                  <span className="text-lg md:text-xl font-extrabold text-emerald-600">
                    R$ {(blocoH.vlInv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Live Metric Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 font-mono">
                <div className={`p-2.5 rounded-xl ${theme.cardHighlight}`}>
                  <span className={`text-[10px] font-semibold uppercase block ${theme.textMuted}`}>Total H005</span>
                  <div className="text-xs md:text-sm font-bold text-emerald-600 mt-1 truncate">
                    R$ {(blocoH.vlInv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className={`text-[9px] font-sans mt-0.5 block ${theme.textSub}`}>Soma de todos os itens</span>
                </div>

                <div className={`p-2.5 rounded-xl ${theme.cardHighlight}`}>
                  <span className={`text-[10px] font-semibold uppercase block ${theme.textMuted}`}>Qtd Total Peças</span>
                  <div className={`text-xs md:text-sm font-bold mt-1 truncate ${theme.textTitle}`}>
                    {totalQtdInStock.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
                  </div>
                  <span className={`text-[9px] font-sans mt-0.5 block ${theme.textSub}`}>{blocoH.items.length} itens no H010</span>
                </div>

                <div className={`p-2.5 rounded-xl ${theme.cardHighlight}`}>
                  <span className={`text-[10px] font-semibold uppercase block ${theme.textMuted}`}>Preço Médio / Item</span>
                  <div className="text-xs md:text-sm font-bold text-indigo-600 mt-1 truncate">
                    R$ {avgPriceInStock.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className={`text-[9px] font-sans mt-0.5 block ${theme.textSub}`}>Valor médio ponderado</span>
                </div>

                <div className={`p-2.5 rounded-xl ${theme.cardHighlight}`}>
                  <span className={`text-[10px] font-semibold uppercase block ${theme.textMuted}`}>Reg. H020 Preservados</span>
                  <div className="text-xs md:text-sm font-bold text-sky-600 mt-1 flex items-center space-x-1">
                    <span>{totalH020Count} de {blocoH.items.length}</span>
                  </div>
                  <span className={`text-[9px] font-sans mt-0.5 block ${theme.textSub}`}>Informação ICMS</span>
                </div>

                <div className={`p-2.5 rounded-xl ${theme.cardHighlight}`}>
                  <span className={`text-[10px] font-semibold uppercase block ${theme.textMuted}`}>Consistência Fiscal & Contábil</span>
                  <div className="text-xs md:text-sm font-bold text-emerald-600 mt-1 flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>100% Auditado</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-sans mt-0.5 block">Fechamento exato</span>
                </div>
              </div>

              {/* Detailed Recalculation Certificate */}
              {lastRecalcSummary && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
                    <span className="font-bold text-emerald-300 flex items-center space-x-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <span>Garantia de Recálculo Concluído ({lastRecalcSummary.timestamp})</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {lastRecalcSummary.itemCount} itens atualizados
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-400 block text-[10px]">VALOR ORIGINAL</span>
                      <span className="text-slate-300 font-bold">R$ {lastRecalcSummary.originalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">VALOR ALVO / FINAL</span>
                      <span className="text-emerald-400 font-bold text-xs">R$ {lastRecalcSummary.newTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">VARIAÇÃO NOMINAL</span>
                      <span className={`font-bold ${lastRecalcSummary.diff >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {lastRecalcSummary.diff >= 0 ? '+' : ''} R$ {lastRecalcSummary.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({lastRecalcSummary.percentChange >= 0 ? '+' : ''}{lastRecalcSummary.percentChange.toFixed(2)}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">FATOR / MODALIDADE</span>
                      <span className="text-slate-200 font-bold">
                        {lastRecalcSummary.ratio.toFixed(4)}x ({lastRecalcSummary.mode === 'qtd' ? 'Qtd' : 'Preço Unit.'})
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table H010 */}
            <div className={`rounded-lg overflow-hidden ${theme.tableContainer}`}>
              <div className={`p-3.5 flex items-center justify-between text-xs font-mono border-b ${theme.tableTopBar}`}>
                <span>Livro de Registro de Inventário - H010</span>
                <span className="font-bold text-emerald-600">
                  Total Geral: R$ {blocoH.vlInv.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`text-[11px] uppercase tracking-wider ${theme.tableHeaderBg}`}>
                    <tr>
                      <th className="p-3 font-mono">Cód Item</th>
                      <th className="p-3">Descrição</th>
                      <th className="p-3">Unid</th>
                      <th className="p-3 font-mono">Quantidade</th>
                      <th className="p-3 font-mono">Vl Unitário (R$)</th>
                      <th className="p-3 font-mono">Vl Total Item (R$)</th>
                      <th className="p-3">Inf. ICMS (H020)</th>
                      <th className="p-3">Posse / Propriedade</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y font-mono ${theme.tableRowBorder}`}>
                    {filteredH010.map(item => {
                      const ref0200 = items0200.find(i => i.codItem === item.codItem);
                      const activeH020 = item.h020 || (item.h020List && item.h020List[0]);
                      return (
                        <tr key={item.codItem} className={`transition-colors ${theme.tableRowHover}`}>
                          <td className={`p-3 font-bold ${theme.textTitle}`}>{item.codItem}</td>
                          <td className="p-3 font-sans max-w-xs">
                            <div className={`font-semibold truncate ${theme.textTitle}`}>
                              {ref0200 ? ref0200.descrItem : item.codItem}
                            </div>
                            <div className="flex items-center space-x-1 mt-0.5">
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${theme.badgeBg}`}>
                                NCM: {ref0200?.ncm || 'N/D'}
                              </span>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.unid}
                              onChange={e => handleUpdateH010Item(item.codItem, 'unid', e.target.value)}
                              className={`w-14 rounded-md px-1.5 py-1 text-xs text-center font-mono ${theme.inputBg}`}
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              step="0.001"
                              value={item.qtd}
                              onChange={e => handleUpdateH010Item(item.codItem, 'qtd', e.target.value)}
                              className={`w-24 font-bold rounded-md px-2 py-1 text-xs text-emerald-600 focus:border-emerald-500 font-mono ${theme.inputBg}`}
                            />
                          </td>
                          <td className="p-3">
                            <div className={`flex items-center space-x-1 font-mono rounded-md px-2 py-1 text-xs w-28 ${theme.badgeBg}`} title="Preço unitário fixo conforme arquivo SPED/0200">
                              <span className={`text-[10px] ${theme.textSub}`}>R$</span>
                              <span className={`font-bold ${theme.textTitle}`}>{item.vlUnit.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className="p-3 font-bold text-emerald-600">
                            R$ {item.vlItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 font-sans min-w-[210px]">
                            {activeH020 ? (
                              <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl space-y-1.5 shadow-xs">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center space-x-1">
                                    <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 text-[9px] font-mono">
                                      H020
                                    </span>
                                    <select
                                      value={activeH020.cstIcms || '000'}
                                      onChange={e => handleUpdateH020Field(item.codItem, 'cstIcms', e.target.value)}
                                      className="bg-slate-900 border border-slate-700 text-sky-300 rounded px-1 py-0.5 text-[10px] font-mono font-bold focus:border-sky-500"
                                    >
                                      <option value="000">CST 000</option>
                                      <option value="020">CST 020</option>
                                      <option value="040">CST 040</option>
                                      <option value="060">CST 060</option>
                                      <option value="090">CST 090</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center space-x-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleRestoreH020ToOriginal(item.codItem)}
                                      className="text-slate-500 hover:text-sky-300 hover:bg-sky-950/50 p-1 rounded transition-colors"
                                      title="Manter / Restaurar H020 conforme arquivo SPED original"
                                    >
                                      <Undo2 className="w-3 h-3 text-sky-400" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddH020(item.codItem)}
                                      className="text-slate-500 hover:text-amber-300 hover:bg-amber-950/50 p-1 rounded transition-colors"
                                      title="Recalcular CST/BC/ICMS com base no NCM do item"
                                    >
                                      <RotateCcw className="w-3 h-3 text-amber-400" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveH020(item.codItem)}
                                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 p-1 rounded transition-colors"
                                      title="Remover Registro H020 deste item"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                  <div>
                                    <span className="text-[9px] text-slate-500 block">BC ICMS (R$)</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={activeH020.vlBcIcms}
                                      onChange={e => handleUpdateH020Field(item.codItem, 'vlBcIcms', e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:border-sky-500 font-mono"
                                    />
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-500 block">VL ICMS (R$)</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={activeH020.vlIcms}
                                      onChange={e => handleUpdateH020Field(item.codItem, 'vlIcms', e.target.value)}
                                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded px-1.5 py-0.5 text-[10px] focus:border-sky-500 font-mono"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddH020(item.codItem)}
                                className="px-2.5 py-1 bg-slate-900 hover:bg-sky-950 hover:text-sky-300 text-slate-400 border border-slate-800 hover:border-sky-700 rounded-lg text-[10px] font-semibold transition-all flex items-center space-x-1"
                                title="Gerar Registro H020 automaticamente com base no NCM e alíquota tributária do item"
                              >
                                <Plus className="w-3 h-3 text-sky-400" />
                                <span>+ Add H020 (NCM)</span>
                              </button>
                            )}
                          </td>
                          <td className="p-3 font-sans">
                            <select
                              value={item.indProp || '0'}
                              onChange={e => handleUpdateH010Item(item.codItem, 'indProp', e.target.value)}
                              className="bg-slate-900 border border-slate-700 text-slate-300 rounded-md px-2 py-1 text-[11px]"
                            >
                              <option value="0">0 - Em poder da empresa</option>
                              <option value="1">1 - Em poder de terceiros</option>
                              <option value="2">2 - De terceiros na empresa</option>
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleRemoveH010Item(item.codItem)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                              title="Remover do Inventário"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredH010.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                          Inventário H010 está vazio. Clique em <span className="font-semibold text-emerald-400">"Puxar do 0200"</span> ou <span className="font-semibold text-emerald-400">"Importar Arquivo"</span> para incluir produtos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: Resumo dos Produtos Alterados */}
        {activeSubTab === 'altered' && (
          <div className="space-y-4">
            {/* Header & KPI Summary */}
            <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                    <History className="w-5 h-5 text-sky-400" />
                    <span>Resumo dos Produtos Alterados no Estoque</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Exibindo histórico detalhado dos itens modificados, reajustados, adicionados ou removidos em relação ao arquivo SPED original.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={searchAltered}
                      onChange={e => setSearchAltered(e.target.value)}
                      placeholder="Buscar por código, NCM ou alteração..."
                      className="w-full bg-slate-900 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono"
                    />
                  </div>

                  <select
                    value={filterAlteredStatus}
                    onChange={e => setFilterAlteredStatus(e.target.value as any)}
                    className="bg-slate-900 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono"
                  >
                    <option value="all">Todas alterações ({alteredProducts.length})</option>
                    <option value="modified">Modificados ({alteredProducts.filter(i => i.status === 'modified').length})</option>
                    <option value="added">Adicionados ({alteredProducts.filter(i => i.status === 'added').length})</option>
                    <option value="removed">Removidos ({alteredProducts.filter(i => i.status === 'removed').length})</option>
                  </select>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total Alterados</span>
                  <div className="text-lg font-bold text-sky-400 mt-0.5">
                    {alteredProducts.length} <span className="text-xs text-slate-400 font-normal">produtos</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-sans block mt-0.5">
                    {(alteredProducts.length / Math.max(1, blocoH.items.length) * 100).toFixed(1)}% do estoque total
                  </span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Modificados</span>
                  <div className="text-lg font-bold text-amber-400 mt-0.5">
                    {alteredProducts.filter(i => i.status === 'modified').length}
                  </div>
                  <span className="text-[9px] text-slate-500 font-sans block mt-0.5">Qtd, Preço ou H020 ICMS</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Novos Adicionados</span>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">
                    {alteredProducts.filter(i => i.status === 'added').length}
                  </div>
                  <span className="text-[9px] text-slate-500 font-sans block mt-0.5">Incluídos no Bloco H</span>
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Removidos</span>
                  <div className="text-lg font-bold text-rose-400 mt-0.5">
                    {alteredProducts.filter(i => i.status === 'removed').length}
                  </div>
                  <span className="text-[9px] text-slate-500 font-sans block mt-0.5">Excluídos do inventário</span>
                </div>
              </div>
            </div>

            {/* Table of Altered Products */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-xs">
              <div className="p-3.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">
                  Listagem Detalhada de Produtos Alterados ({filteredAlteredProducts.length})
                </span>
                <span className="text-[11px] text-slate-400">
                  Comparações em tempo real com o arquivo SPED de origem
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-mono tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3">Código</th>
                      <th className="p-3">Descrição & NCM</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Quantidade (Antes → Depois)</th>
                      <th className="p-3">Preço Unit. (Antes → Depois)</th>
                      <th className="p-3">Valor Total Item (Antes → Depois)</th>
                      <th className="p-3">Registro H020 ICMS</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {filteredAlteredProducts.map(item => (
                      <tr key={item.codItem} className="hover:bg-slate-900/50 transition-colors">
                        <td className="p-3 font-bold text-slate-200">{item.codItem}</td>
                        <td className="p-3 max-w-xs">
                          <div className="font-semibold text-slate-200 truncate">{item.descrItem}</div>
                          <div className="text-[10px] text-slate-500 font-sans">NCM: {item.ncm} | Unid: {item.unid}</div>
                        </td>
                        <td className="p-3">
                          {item.status === 'added' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Novo Adicionado
                            </span>
                          )}
                          {item.status === 'removed' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Removido
                            </span>
                          )}
                          {item.status === 'modified' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Modificado
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {item.status === 'added' ? (
                            <span className="text-emerald-400 font-bold">{item.newQtd?.toLocaleString('pt-BR')} {item.unid}</span>
                          ) : item.status === 'removed' ? (
                            <span className="text-rose-400 line-through">{item.oldQtd?.toLocaleString('pt-BR')} {item.unid}</span>
                          ) : (
                            <div>
                              <span className="text-slate-500 line-through mr-1">{item.oldQtd?.toLocaleString('pt-BR')}</span>
                              <span className="text-amber-300 font-bold">→ {item.newQtd?.toLocaleString('pt-BR')} {item.unid}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {item.status === 'added' ? (
                            <span className="text-emerald-400 font-bold">R$ {item.newVlUnit?.toFixed(2)}</span>
                          ) : item.status === 'removed' ? (
                            <span className="text-rose-400 line-through">R$ {item.oldVlUnit?.toFixed(2)}</span>
                          ) : (
                            <div>
                              <span className="text-slate-500 line-through mr-1">R$ {item.oldVlUnit?.toFixed(2)}</span>
                              <span className="text-amber-300 font-bold">→ R$ {item.newVlUnit?.toFixed(2)}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          {item.status === 'added' ? (
                            <span className="text-emerald-400 font-bold">R$ {item.newVlItem?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          ) : item.status === 'removed' ? (
                            <span className="text-rose-400 line-through">R$ {item.oldVlItem?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          ) : (
                            <div>
                              <div className="text-slate-500 line-through text-[10px]">R$ {item.oldVlItem?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                              <div className="text-amber-300 font-bold">→ R$ {item.newVlItem?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-[10px]">
                          {item.oldH020Cst !== item.newH020Cst ? (
                            <span className="text-sky-300 font-bold">
                              CST {item.oldH020Cst || 'Sem H020'} → {item.newH020Cst || 'Sem H020'}
                            </span>
                          ) : item.newH020Cst ? (
                            <span className="text-slate-300">CST {item.newH020Cst} (BC: R$ {(item.newH020Bc || 0).toFixed(2)})</span>
                          ) : (
                            <span className="text-slate-500 font-sans">Sem H020</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestoreItem(item.codItem)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-sky-950 hover:text-sky-300 text-slate-400 border border-slate-800 hover:border-sky-700 rounded-lg text-[10px] font-semibold transition-all flex items-center space-x-1 ml-auto"
                            title="Restaurar este item aos valores originais do arquivo SPED"
                          >
                            <RotateCcw className="w-3 h-3 text-sky-400" />
                            <span>Restaurar</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredAlteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-slate-500 font-sans">
                          {alteredProducts.length === 0 
                            ? 'Nenhum produto foi alterado ainda. Quaisquer modificações de quantidade, preço ou H020 serão listadas aqui.' 
                            : 'Nenhum produto alterado encontrado com os filtros atuais.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: Resumo & Diagnóstico Fiscal */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
                <span className="text-xs text-slate-400 font-medium">Valor Total do Inventário</span>
                <p className="text-2xl font-extrabold text-emerald-400 font-mono">
                  R$ {blocoH.vlInv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Calculado via {blocoH.items.length} registros H010
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
                <span className="text-xs text-slate-400 font-medium">Catálogo 0200 vs. Matriz Tributária</span>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-extrabold text-white font-mono">
                    {auditStats.ok} <span className="text-xs text-slate-400 font-normal">/ {auditStats.total} OK</span>
                  </p>
                  {auditStats.divergent > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {auditStats.divergent} divergentes
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  {auditStats.noRule} itens sem regra tributária mapeada
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-5 rounded-lg space-y-2">
                <span className="text-xs text-slate-400 font-medium">Situação dos Blocos SPED</span>
                <div className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Bloco 0200 (Cadastros):</span>
                    <span className="text-emerald-400 font-bold">Presente ({items0200.length})</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Bloco H005 / H010 (Inventário):</span>
                    <span className="text-emerald-400 font-bold">Presente ({blocoH.items.length})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top High-Value Inventory Items */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                <span>Maiores Valores do Inventário Físico</span>
              </h3>

              <div className="space-y-2 font-mono text-xs">
                {blocoH.items
                  .slice()
                  .sort((a, b) => b.vlItem - a.vlItem)
                  .slice(0, 5)
                  .map((item, idx) => {
                    const ref0200 = items0200.find(i => i.codItem === item.codItem);
                    const pct = blocoH.vlInv > 0 ? (item.vlItem / blocoH.vlInv) * 100 : 0;
                    return (
                      <div key={item.codItem} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-3 truncate">
                          <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-[10px]">
                            #{idx + 1}
                          </span>
                          <div className="truncate">
                            <p className="font-bold text-slate-200 truncate">{item.codItem} - {ref0200?.descrItem || 'Produto'}</p>
                            <p className="text-[11px] text-slate-500 font-sans">
                              {item.qtd} {item.unid} x R$ {item.vlUnit.toFixed(2)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-emerald-400">R$ {item.vlItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[10px] text-slate-500">{pct.toFixed(1)}% do estoque</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Import File */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Importar Arquivo de Estoque ou SPED</span>
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Dropzone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-lg p-8 text-center cursor-pointer bg-slate-950/50 hover:bg-slate-950 transition-all group"
              >
                <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                <p className="font-bold text-white mb-1">Clique para escolher o arquivo</p>
                <p className="text-slate-400 text-[11px]">
                  Aceita SPED Fiscal <span className="font-mono text-emerald-400">(.txt)</span> ou Planilha de Inventário <span className="font-mono text-emerald-400">(.csv / .txt)</span>
                </p>
              </div>

              {importingFile && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-center font-bold animate-pulse">
                  Processando arquivo...
                </div>
              )}

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5 text-slate-400">
                <p className="font-bold text-slate-300">💡 Formatos Suportados:</p>
                <p>• <strong className="text-slate-200">SPED EFD ICMS/IPI (.txt)</strong>: Extrai registros 0200, H005 e H010.</p>
                <p>• <strong className="text-slate-200">Planilha CSV/TXT de Inventário</strong>: Separada por ponto e vírgula contendo código, descrição, NCM, quantidade e valor unitário.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Select from 0200 -> H010 */}
      {is0200PickerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-2xl w-full p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Selecionar Produtos do Bloco 0200 para o Inventário</span>
              </h3>
              <button onClick={() => setIs0200PickerOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={modalSearch}
                    onChange={e => setModalSearch(e.target.value)}
                    placeholder="Buscar código ou descrição..."
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Preço Padrão R$:</span>
                  <input
                    type="number"
                    value={importDefaultPrice}
                    onChange={e => setImportDefaultPrice(parseFloat(e.target.value) || 0)}
                    className="w-20 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>{selected0200Codes.size} produto(s) selecionado(s)</span>
                <button
                  onClick={() => {
                    if (selected0200Codes.size === modal0200Filtered.length) {
                      setSelected0200Codes(new Set());
                    } else {
                      setSelected0200Codes(new Set(modal0200Filtered.map(i => i.codItem)));
                    }
                  }}
                  className="text-indigo-400 hover:underline font-medium"
                >
                  {selected0200Codes.size === modal0200Filtered.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950 divide-y divide-slate-800/60 p-1">
                {modal0200Filtered.map(item => {
                  const isChecked = selected0200Codes.has(item.codItem);
                  return (
                    <label
                      key={item.codItem}
                      className="flex items-center justify-between p-2.5 hover:bg-slate-900 rounded-lg cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newSet = new Set(selected0200Codes);
                            if (e.target.checked) newSet.add(item.codItem);
                            else newSet.delete(item.codItem);
                            setSelected0200Codes(newSet);
                          }}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                        />
                        <div>
                          <p className="font-bold text-slate-200 font-mono">{item.codItem}</p>
                          <p className="text-slate-400 text-[11px] font-sans truncate max-w-sm">{item.descrItem}</p>
                        </div>
                      </div>
                      <span className="font-mono text-slate-500 text-[11px]">NCM: {item.ncm || '-'}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIs0200PickerOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport0200ToH010}
                disabled={selected0200Codes.size === 0}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs transition-colors"
              >
                Incluir no Inventário ({selected0200Codes.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manual Add Item Modal */}
      {isManualAddOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Novo Produto no Estoque</span>
              </h3>
              <button onClick={() => setIsManualAddOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Código do Item / SKU *</label>
                <input
                  type="text"
                  value={newItemCode}
                  onChange={e => setNewItemCode(e.target.value)}
                  placeholder="Ex: PROD-1001"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Descrição do Produto *</label>
                <input
                  type="text"
                  value={newItemDescr}
                  onChange={e => setNewItemDescr(e.target.value)}
                  placeholder="Ex: Óleo Lubrificante 1L"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">NCM (8 dígitos)</label>
                  <input
                    type="text"
                    value={newItemNcm}
                    onChange={e => setNewItemNcm(e.target.value)}
                    placeholder="Ex: 27101911"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Unidade de Medida</label>
                  <input
                    type="text"
                    value={newItemUnid}
                    onChange={e => setNewItemUnid(e.target.value)}
                    placeholder="UN, L, CX, KG"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-indigo-500 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Quantidade Física</label>
                  <input
                    type="number"
                    step="0.001"
                    value={newItemQtd}
                    onChange={e => setNewItemQtd(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-mono font-bold focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Valor Unitário (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItemVlUnit}
                    onChange={e => setNewItemVlUnit(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex justify-between font-mono">
                <span className="text-slate-400">Total do Item:</span>
                <span className="font-bold text-emerald-400">
                  R$ {(newItemQtd * newItemVlUnit).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                onClick={() => setIsManualAddOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddManualItem}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                Salvar Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Apagar Dados de Estoque */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-lg w-full p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-rose-400 flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Apagar Dados de Estoque Importados</span>
              </h3>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-300">
                Escolha o nível de exclusão para o arquivo do estoque carregado no sistema:
              </p>

              <div className="grid grid-cols-1 gap-3 pt-1">
                {/* Option 1: Limpar apenas Inventário (Bloco H) */}
                <button
                  type="button"
                  onClick={() => handleClearStockData('blocoH')}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                >
                  <div className="flex items-center justify-between font-bold text-slate-200 group-hover:text-amber-300 mb-1">
                    <span className="flex items-center space-x-2">
                      <PackageCheck className="w-4 h-4 text-amber-400" />
                      <span>Limpar Apenas Inventário (Bloco H)</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      {blocoH.items.length} itens
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Zera os registros de inventário H010 e H020, mas preserva o cadastro de produtos 0200. Ideal para recarregar uma nova contagem física.
                  </p>
                </button>

                {/* Option 2: Apagar Tudo e Resetar */}
                <button
                  type="button"
                  onClick={() => handleClearStockData('all')}
                  className="p-4 rounded-xl bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-700/80 text-left transition-all group"
                >
                  <div className="flex items-center justify-between font-bold text-slate-200 group-hover:text-rose-300 mb-1">
                    <span className="flex items-center space-x-2">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>Apagar Tudo e Resetar Arquivo</span>
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      Total Reset
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Exclui completamente o cadastro 0200 importado e o Bloco H de inventário. Retorna a tela inicial para carregar outro arquivo do zero.
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2 border-t border-slate-800">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
