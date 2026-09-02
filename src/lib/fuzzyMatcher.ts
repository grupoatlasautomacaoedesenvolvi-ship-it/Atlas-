/**
 * Algoritmo de Similaridade e Comparador Fuzzy para Itens de Nota Fiscal (SPED C170 vs XML NF-e).
 * Compara cProd, xProd/Descrição, NCM, Valores e Sequência (nItem/numItem).
 */

/**
 * Remove acentos, pontuação e converte para maiúsculas para comparação padronizada.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distância Levenshtein entre duas strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // Substituição
          matrix[i][j - 1] + 1,     // Inserção
          matrix[i - 1][j] + 1      // Deleção
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Similaridade de Levenshtein normalizada (0.0 a 1.0).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const distance = levenshteinDistance(normA, normB);
  const maxLength = Math.max(normA.length, normB.length);
  if (maxLength === 0) return 1.0;

  return Math.max(0, 1 - distance / maxLength);
}

/**
 * Similaridade Token Jaccard (para ordem das palavras diferente, ex: "OLEO DIESEL S10" vs "DIESEL S10 OLEO").
 */
export function tokenJaccardSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (!normA && !normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = new Set(normA.split(' ').filter(t => t.length > 0));
  const tokensB = new Set(normB.split(' ').filter(t => t.length > 0));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  tokensA.forEach(token => {
    if (tokensB.has(token)) {
      intersectionCount++;
    } else {
      // Checa pequenas variações em palavras chave
      for (const tB of tokensB) {
        if (tB.length >= 4 && token.length >= 4 && levenshteinSimilarity(token, tB) >= 0.8) {
          intersectionCount += 0.8;
          break;
        }
      }
    }
  });

  const unionSize = tokensA.size + tokensB.size - intersectionCount;
  return unionSize > 0 ? Math.min(1, intersectionCount / unionSize) : 0;
}

/**
 * Similaridade composta de descrição de produto (Levenshtein + Token Jaccard).
 */
export function calculateDescriptionSimilarity(desc1: string, desc2: string): number {
  const levSim = levenshteinSimilarity(desc1, desc2);
  const jacSim = tokenJaccardSimilarity(desc1, desc2);

  // Média ponderada (60% Token Jaccard, 40% Levenshtein)
  return Math.min(1, jacSim * 0.6 + levSim * 0.4);
}

export interface ItemMatchDetails {
  xmlItem: any;
  score: number; // 0 a 100
  confidence: 'EXACT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  reasons: string[];
  codeMatchScore: number;
  descriptionMatchScore: number;
  ncmMatchScore: number;
  valueMatchScore: number;
  isSequenceMismatch: boolean;
  spedNumItem: string;
  xmlNItem: string;
  spedIndex: number;
  xmlIndex: number;
}

/**
 * Calcula a pontuação e métricas de similaridade entre um item do SPED (C170) e um item do XML (NF-e).
 */
export function calculateItemMatchScore(
  spedItem: {
    codItem?: string;
    descrCompleta?: string;
    descrItem?: string;
    ncm?: string;
    vlItem?: number;
    qtd?: number;
    numItem?: string;
  },
  xmlItem: any,
  spedIndex: number = 0,
  xmlIndex: number = 0
): ItemMatchDetails {
  const reasons: string[] = [];

  const spedCod = String(spedItem.codItem || '').trim();
  const xmlCod = String(xmlItem.cProd || '').trim();

  const spedDesc = String(spedItem.descrCompleta || spedItem.descrItem || '').trim();
  const xmlDesc = String(xmlItem.xProd || xmlItem.xprod || '').trim();

  const spedNcm = String(spedItem.ncm || '').replace(/\D/g, '');
  const xmlNcm = String(xmlItem.ncm || '').replace(/\D/g, '');

  const spedVal = spedItem.vlItem ?? 0;
  const xmlVal = xmlItem.vProd ?? xmlItem.vItem ?? 0;

  const spedNumItem = String(spedItem.numItem || spedIndex + 1).trim();
  const xmlNItem = String(xmlItem.nItem || xmlIndex + 1).trim();

  // 1. Pontuação por Código do Produto (Até 40 pontos)
  let codeMatchScore = 0;
  if (spedCod && xmlCod) {
    if (spedCod.toLowerCase() === xmlCod.toLowerCase()) {
      codeMatchScore = 1.0;
      reasons.push(`Código cProd idêntico (${xmlCod})`);
    } else {
      // Remove zeros à esquerda para comparar (ex: "00123" vs "123")
      const cleanSpedCod = spedCod.replace(/^0+/, '');
      const cleanXmlCod = xmlCod.replace(/^0+/, '');
      if (cleanSpedCod && cleanSpedCod === cleanXmlCod) {
        codeMatchScore = 0.95;
        reasons.push(`Código idêntico (sem zeros à esquerda: ${cleanXmlCod})`);
      } else if (spedCod.includes(xmlCod) || xmlCod.includes(spedCod)) {
        codeMatchScore = 0.7;
        reasons.push(`Código contido em parte (${xmlCod})`);
      } else {
        const lev = levenshteinSimilarity(spedCod, xmlCod);
        codeMatchScore = lev * 0.5;
      }
    }
  }

  // 2. Pontuação por Descrição / Texto (Até 35 pontos)
  let descriptionMatchScore = 0;
  if (spedDesc && xmlDesc) {
    descriptionMatchScore = calculateDescriptionSimilarity(spedDesc, xmlDesc);
    const percent = Math.round(descriptionMatchScore * 100);
    if (percent >= 70) {
      reasons.push(`Descrição similar (${percent}%): "${xmlDesc}"`);
    }
  }

  // 3. Pontuação por NCM (Até 15 pontos)
  let ncmMatchScore = 0;
  if (spedNcm && xmlNcm) {
    if (spedNcm === xmlNcm) {
      ncmMatchScore = 1.0;
      reasons.push(`NCM exato (${xmlNcm})`);
    } else if (spedNcm.slice(0, 4) === xmlNcm.slice(0, 4)) {
      ncmMatchScore = 0.6;
      reasons.push(`NCM do mesmo capítulo (${xmlNcm.slice(0, 4)})`);
    }
  }

  // 4. Pontuação por Valor e Quantidade (Até 10 pontos)
  let valueMatchScore = 0;
  if (spedVal > 0 && xmlVal > 0) {
    const valDiff = Math.abs(spedVal - xmlVal);
    if (valDiff <= 0.02) {
      valueMatchScore = 1.0;
      reasons.push(`Valor exato (R$ ${xmlVal.toFixed(2)})`);
    } else if (valDiff <= 0.5) {
      valueMatchScore = 0.8;
      reasons.push(`Valor muito próximo (R$ ${xmlVal.toFixed(2)})`);
    } else if (valDiff / Math.max(spedVal, xmlVal) <= 0.05) {
      valueMatchScore = 0.6;
      reasons.push(`Valor dentro da margem de 5%`);
    }
  }

  // Bônus por Sequência Exata
  let sequenceBonus = 0;
  const sameNumItem = spedNumItem === xmlNItem || parseInt(spedNumItem, 10) === parseInt(xmlNItem, 10);
  if (sameNumItem) {
    sequenceBonus = 5;
  }

  // Cálculo da pontuação total ponderada (0 a 100)
  // Pesos: Código (35%), Descrição (35%), NCM (15%), Valor (15%) + Bônus Sequência (5%)
  let totalScore = Math.round(
    codeMatchScore * 35 +
    descriptionMatchScore * 35 +
    ncmMatchScore * 15 +
    valueMatchScore * 15 +
    sequenceBonus
  );

  totalScore = Math.min(100, Math.max(0, totalScore));

  // Determinar Inconsistência de Sequência
  // Se o item tem pontuação suficiente para ser o mesmo produto, mas nItem !== numItem ou índice difere
  const isSequenceMismatch = !sameNumItem && totalScore >= 40;

  if (isSequenceMismatch) {
    reasons.push(`Inconsistência de Sequência: SPED item ${spedNumItem} (índice ${spedIndex + 1}) mapeado para XML nItem ${xmlNItem} (índice ${xmlIndex + 1})`);
  }

  let confidence: ItemMatchDetails['confidence'] = 'NONE';
  if (totalScore >= 85) confidence = 'EXACT';
  else if (totalScore >= 65) confidence = 'HIGH';
  else if (totalScore >= 40) confidence = 'MEDIUM';
  else if (totalScore >= 20) confidence = 'LOW';

  return {
    xmlItem,
    score: totalScore,
    confidence,
    reasons,
    codeMatchScore,
    descriptionMatchScore,
    ncmMatchScore,
    valueMatchScore,
    isSequenceMismatch,
    spedNumItem,
    xmlNItem,
    spedIndex,
    xmlIndex
  };
}

/**
 * Encontra o melhor item do XML correspondente a um item do SPED usando Fuzzy Matching.
 */
export function findBestFuzzyXmlItemMatch(
  xmlItems: any[],
  spedItem: {
    codItem?: string;
    descrCompleta?: string;
    descrItem?: string;
    ncm?: string;
    vlItem?: number;
    qtd?: number;
    numItem?: string;
  },
  spedIndex: number = 0
): ItemMatchDetails | null {
  if (!xmlItems || xmlItems.length === 0) return null;

  let bestMatch: ItemMatchDetails | null = null;

  for (let xmlIndex = 0; xmlIndex < xmlItems.length; xmlIndex++) {
    const xmlItem = xmlItems[xmlIndex];
    const match = calculateItemMatchScore(spedItem, xmlItem, spedIndex, xmlIndex);

    if (!bestMatch || match.score > bestMatch.score) {
      bestMatch = match;
    }
  }

  // Se a pontuação do melhor item for aceitável (>= 20) ou se for o único item
  if (bestMatch && (bestMatch.score >= 20 || xmlItems.length === 1)) {
    return bestMatch;
  }

  // Fallback se nada atingiu pontuação mínima
  if (xmlItems[spedIndex]) {
    return calculateItemMatchScore(spedItem, xmlItems[spedIndex], spedIndex, spedIndex);
  }

  return bestMatch || null;
}

/**
 * Mapeia recursivamente/otimizadamente todos os itens de uma nota SPED com os itens do XML correspondente,
 * garantindo alocação 1-para-1 com priorização de melhores scores e detecção global de desalinhamento de sequência.
 */
export function matchAllSpedAndXmlItemsFuzzy(
  spedItems: any[],
  xmlItems: any[]
): Map<number, ItemMatchDetails> {
  const resultMap = new Map<number, ItemMatchDetails>();
  if (!spedItems || !xmlItems || xmlItems.length === 0) return resultMap;

  // Matriz de todas as combinações
  const allCandidates: { spedIdx: number; xmlIdx: number; details: ItemMatchDetails }[] = [];

  for (let sIdx = 0; sIdx < spedItems.length; sIdx++) {
    for (let xIdx = 0; xIdx < xmlItems.length; xIdx++) {
      const details = calculateItemMatchScore(spedItems[sIdx], xmlItems[xIdx], sIdx, xIdx);
      allCandidates.push({ spedIdx: sIdx, xmlIdx: xIdx, details });
    }
  }

  // Ordena candidaturas por maior pontuação
  allCandidates.sort((a, b) => b.details.score - a.details.score);

  const usedSped = new Set<number>();
  const usedXml = new Set<number>();

  for (const cand of allCandidates) {
    if (!usedSped.has(cand.spedIdx) && !usedXml.has(cand.xmlIdx) && cand.details.score >= 20) {
      usedSped.add(cand.spedIdx);
      usedXml.add(cand.xmlIdx);
      resultMap.set(cand.spedIdx, cand.details);
    }
  }

  // Para itens do SPED que sobrou sem pares, preenche com o melhor disponível ou por índice
  for (let sIdx = 0; sIdx < spedItems.length; sIdx++) {
    if (!resultMap.has(sIdx)) {
      const best = findBestFuzzyXmlItemMatch(xmlItems, spedItems[sIdx], sIdx);
      if (best) {
        resultMap.set(sIdx, best);
      }
    }
  }

  return resultMap;
}
