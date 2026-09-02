import { findBestFuzzyXmlItemMatch } from './fuzzyMatcher';

export * from './fuzzyMatcher';

/**
 * Mapeamento e conversão inteligente de CFOPs do XML de fornecedor (saída 5xxx/6xxx)
 * para escrituração fiscal de entrada no SPED C170 do comprador (1xxx/2xxx).
 */
export function mapXmlCfopToEntryCfop(xmlCfop: string, isEntryDoc: boolean = true): string {
  if (!xmlCfop) return '';
  const clean = xmlCfop.trim();
  if (!isEntryDoc) return clean; // Se for documento de saída da própria empresa, mantém o CFOP de saída original

  // Se já for um CFOP de entrada (começa com 1, 2 ou 3), retorna sem alterar
  if (['1', '2', '3'].includes(clean.charAt(0))) {
    return clean;
  }

  const prefix = clean.charAt(0);
  const isInterstate = prefix === '6';
  const entradaPrefix = isInterstate ? '2' : '1';

  // 1. Substituição Tributária (ST)
  if (['5405', '5403', '5401', '5402', '5409', '6405', '6403', '6401', '6402', '6409'].includes(clean)) {
    return `${entradaPrefix}403`;
  }

  // 2. Venda tributada normal para comercialização
  if (['5102', '5101', '5103', '5104', '5105', '5106', '6102', '6101', '6103', '6104', '6105', '6106'].includes(clean)) {
    return `${entradaPrefix}102`;
  }

  // 3. Uso e Consumo
  if (['5556', '6556', '5407', '6407'].includes(clean)) {
    return `${entradaPrefix}556`;
  }

  // 4. Ativo Imobilizado
  if (['5551', '6551'].includes(clean)) {
    return `${entradaPrefix}551`;
  }

  // Regra padrão genérica para demais operações: trocar 5 -> 1 (estadual) ou 6 -> 2 (interestadual)
  if (prefix === '5') return `1${clean.slice(1)}`;
  if (prefix === '6') return `2${clean.slice(1)}`;

  return clean;
}

/**
 * Robustly matches a SPED item with an XML item using Fuzzy Matching:
 * 1. Product code match (cProd === codItem)
 * 2. Description similarity (Levenshtein + Token Jaccard)
 * 3. NCM match
 * 4. Value and Quantity match
 * 5. Item sequence/number match (nItem === numItem)
 */
export function findMatchingXmlItem(
  xmlItems: any[],
  item: {
    codItem?: string;
    descrCompleta?: string;
    descrItem?: string;
    numItem?: string;
    vlItem?: number;
    qtd?: number;
    ncm?: string;
  },
  index: number
): any {
  if (!xmlItems || xmlItems.length === 0) return null;

  const fuzzyResult = findBestFuzzyXmlItemMatch(xmlItems, item, index);
  if (fuzzyResult && fuzzyResult.xmlItem) {
    return fuzzyResult.xmlItem;
  }

  return xmlItems[index] || xmlItems[0] || null;
}

