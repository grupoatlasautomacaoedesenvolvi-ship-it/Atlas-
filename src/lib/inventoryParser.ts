import { Sped0200Item, SpedH010Item, SpedData, SpedBlocoH } from '../types';
import { parseSpedContent } from './clientParser';

export interface InventoryParseResult {
  items0200: Sped0200Item[];
  itemsH010: SpedH010Item[];
  vlTotalInv: number;
  headerName?: string;
  isFullSped?: boolean;
  parsedSped?: SpedData;
}

/**
 * Smartly parses a file uploaded in the Stock module.
 * Supports:
 * 1. Full SPED Fiscal files (.txt with |0000|...)
 * 2. CSV / TXT tabular inventory files (separated by ;, ,, \t, or |)
 */
export async function parseInventoryOrSpedFile(content: string, fileName: string): Promise<InventoryParseResult> {
  const trimmed = content.trim();

  // 1. If it looks like a SPED Fiscal file (|0000| or line starting with pipe)
  if (trimmed.startsWith('|') || trimmed.includes('|0000|') || trimmed.includes('|0200|') || trimmed.includes('|H010|')) {
    try {
      const parsedSped = await parseSpedContent(content);
      const items0200 = parsedSped.items0200 || [];
      const itemsH010 = parsedSped.blocoH?.items || [];
      const vlTotalInv = parsedSped.blocoH?.vlInv || itemsH010.reduce((acc, i) => acc + i.vlItem, 0);

      return {
        items0200,
        itemsH010,
        vlTotalInv,
        headerName: parsedSped.header.nome,
        isFullSped: true,
        parsedSped
      };
    } catch (e) {
      console.warn('Attempted SPED parse failed, falling back to CSV parser', e);
    }
  }

  // 2. Parse as CSV / Tabular Inventory File
  const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { items0200: [], itemsH010: [], vlTotalInv: 0 };
  }

  // Detect delimiter: ;, tab, comma, pipe
  const firstLine = lines[0];
  let delimiter = ';';
  if (firstLine.includes(';')) delimiter = ';';
  else if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes('|')) delimiter = '|';
  else if (firstLine.includes(',')) delimiter = ',';

  // Helper to normalize strings
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  const headers = firstLine.split(delimiter).map(h => normalize(h.trim()));

  let idxCode = headers.findIndex(h => h.includes('cod') || h.includes('sku') || h.includes('item') || h.includes('cprod'));
  let idxDescr = headers.findIndex(h => h.includes('desc') || h.includes('nome') || h.includes('prod') || h.includes('xprod'));
  let idxNcm = headers.findIndex(h => h.includes('ncm') || h.includes('posicao'));
  let idxUnid = headers.findIndex(h => h.includes('unid') || h === 'un' || h.includes('medida') || h.includes('ucom'));
  let idxQtd = headers.findIndex(h => h.includes('qtd') || h.includes('quant') || h.includes('est') || h.includes('saldo') || h.includes('qcom'));
  let idxVlUnit = headers.findIndex(h => h.includes('unit') || h.includes('prec') || h.includes('punit') || h.includes('custo') || h.includes('vuncom'));
  let idxVlTot = headers.findIndex(h => h.includes('tot') || h.includes('vprod') || h === 'valor');

  const hasHeader = idxCode !== -1 || idxDescr !== -1 || idxQtd !== -1;
  const startRowIndex = hasHeader ? 1 : 0;

  // Fallbacks if no header detected
  if (!hasHeader) {
    idxCode = 0;
    idxDescr = 1;
    idxNcm = 2;
    idxUnid = 3;
    idxQtd = 4;
    idxVlUnit = 5;
  }

  const items0200Map = new Map<string, Sped0200Item>();
  const itemsH010List: SpedH010Item[] = [];

  for (let i = startRowIndex; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, ''));
    if (row.length < 2) continue;

    const rawCode = idxCode !== -1 && row[idxCode] ? row[idxCode] : `ITEM_${i}`;
    const rawDescr = idxDescr !== -1 && row[idxDescr] ? row[idxDescr] : `Produto ${rawCode}`;
    const rawNcm = idxNcm !== -1 && row[idxNcm] ? row[idxNcm].replace(/\D/g, '') : '';
    const rawUnid = idxUnid !== -1 && row[idxUnid] ? row[idxUnid].toUpperCase() : 'UN';

    // Parse numeric fields (handles Brazilian '1.234,56' or standard '1234.56')
    const parseNum = (strVal?: string) => {
      if (!strVal) return 0;
      let clean = strVal.replace(/[^\d.,-]/g, '');
      if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
      } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
      }
      return parseFloat(clean) || 0;
    };

    const qtd = idxQtd !== -1 ? parseNum(row[idxQtd]) : 0;
    let vlUnit = idxVlUnit !== -1 ? parseNum(row[idxVlUnit]) : 0;
    let vlTot = idxVlTot !== -1 ? parseNum(row[idxVlTot]) : 0;

    if (vlUnit === 0 && vlTot > 0 && qtd > 0) {
      vlUnit = Math.round((vlTot / qtd) * 100) / 100;
    } else if (vlTot === 0 && vlUnit > 0 && qtd > 0) {
      vlTot = Math.round((qtd * vlUnit) * 100) / 100;
    }

    if (!items0200Map.has(rawCode)) {
      items0200Map.set(rawCode, {
        codItem: rawCode,
        descrItem: rawDescr,
        ncm: rawNcm || '00000000',
        unid: rawUnid || 'UN',
        tipoItem: '00',
        aliqIcms: 18
      });
    }

    if (qtd > 0 || vlUnit > 0 || vlTot > 0) {
      itemsH010List.push({
        codItem: rawCode,
        unid: rawUnid || 'UN',
        qtd: qtd || 1,
        vlUnit: vlUnit || 0,
        vlItem: vlTot || (qtd * vlUnit) || 0,
        indProp: '0'
      });
    }
  }

  const items0200 = Array.from(items0200Map.values());
  const vlTotalInv = itemsH010List.reduce((acc, item) => acc + item.vlItem, 0);

  return {
    items0200,
    itemsH010: itemsH010List,
    vlTotalInv,
    headerName: fileName.replace(/\.[^/.]+$/, ''),
    isFullSped: false
  };
}

/**
 * Sample Stock / Inventory Data for quick demonstration in Stock Engineering View
 */
export const SAMPLE_STOCK_SPED_DATA: SpedData = {
  header: {
    cnpj: '00.123.456/0001-99',
    nome: 'DISTRIBUIDORA DE PRODUTOS E ESTOQUE LTDA',
    uf: 'SP',
    dtIni: '01012024',
    dtFin: '31012024'
  },
  items0200: [
    { codItem: 'EST-001', descrItem: 'OLEO DIESEL S10 DIESEL PRO', ncm: '27101921', unid: 'L', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '060' },
    { codItem: 'EST-002', descrItem: 'GASOLINA ADITIVADA GRID', ncm: '27101259', unid: 'L', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '060' },
    { codItem: 'EST-003', descrItem: 'ETANOL HIDRATADO COMUM', ncm: '22071000', unid: 'L', tipoItem: '00', aliqIcms: 12, cstIcmsPadrao: '000' },
    { codItem: 'EST-004', descrItem: 'LUBRIFICANTE SINTETICO 5W30', ncm: '27101911', unid: 'CX', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '060' },
    { codItem: 'EST-005', descrItem: 'FILTRO DE OLEO AUTOMOTIVO', ncm: '84212300', unid: 'UN', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '000' },
    { codItem: 'EST-006', descrItem: 'ARLA 32 RECIPIENTE 20L', ncm: '31021010', unid: 'GAL', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '000' },
    { codItem: 'EST-007', descrItem: 'FLUIDO DE FREIO DOT 4', ncm: '38190000', unid: 'UN', tipoItem: '00', aliqIcms: 18, cstIcmsPadrao: '000' }
  ],
  blocoH: {
    dtInv: '31012024',
    vlInv: 324550.00,
    motInv: '01',
    items: [
      { codItem: 'EST-001', unid: 'L', qtd: 25000, vlUnit: 4.85, vlItem: 121250.00, indProp: '0' },
      { codItem: 'EST-002', unid: 'L', qtd: 18000, vlUnit: 5.60, vlItem: 100800.00, indProp: '0' },
      { codItem: 'EST-003', unid: 'L', qtd: 15000, vlUnit: 3.45, vlItem: 51750.00, indProp: '0' },
      { codItem: 'EST-004', unid: 'CX', qtd: 450, vlUnit: 82.00, vlItem: 36900.00, indProp: '0' },
      { codItem: 'EST-005', unid: 'UN', qtd: 320, vlUnit: 21.50, vlItem: 6880.00, indProp: '0' },
      { codItem: 'EST-006', unid: 'GAL', qtd: 120, vlUnit: 45.00, vlItem: 5400.00, indProp: '0' },
      { codItem: 'EST-007', unid: 'UN', qtd: 90, vlUnit: 17.44, vlItem: 1570.00, indProp: '0' }
    ]
  },
  documents: [],
  reconciliation: [],
  apuracao: null
};
