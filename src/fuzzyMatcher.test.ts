import { describe, it, expect } from 'vitest';
import { matchAllSpedAndXmlItemsFuzzy } from './lib/fuzzyMatcher';

describe('matchAllSpedAndXmlItemsFuzzy (1-para-1 exclusivo)', () => {
  it('impede que dois itens do SPED sejam correlacionados ao mesmo item do XML', () => {
    // Dois itens no SPED idênticos ou muito similares ao mesmo item único do XML
    const spedItems = [
      { codItem: 'PROD01', descrCompleta: 'PARAFUSO SEXTAVADO 10MM', vlItem: 100, numItem: '1' },
      { codItem: 'PROD01', descrCompleta: 'PARAFUSO SEXTAVADO 10MM', vlItem: 100, numItem: '2' }
    ];

    const xmlItems = [
      { cProd: 'PROD01', xProd: 'PARAFUSO SEXTAVADO 10MM', vProd: 100, nItem: '1' },
      { cProd: 'PROD02', xProd: 'PORCA SEXTAVADA 10MM', vProd: 20, nItem: '2' }
    ];

    const result = matchAllSpedAndXmlItemsFuzzy(spedItems, xmlItems);

    const matchSped0 = result.get(0);
    const matchSped1 = result.get(1);

    expect(matchSped0).toBeDefined();
    expect(matchSped1).toBeDefined();

    // Garante que ambos os itens do SPED não apontaram para o mesmo item do XML (xmlItem cProd 'PROD01')
    expect(matchSped0?.xmlItem.cProd).not.toEqual(matchSped1?.xmlItem.cProd);

    // O primeiro ficou com PROD01 (score mais alto / primeiro)
    expect(matchSped0?.xmlItem.cProd).toBe('PROD01');
    // O segundo caiu no outro candidato disponível (PROD02)
    expect(matchSped1?.xmlItem.cProd).toBe('PROD02');
  });
});
