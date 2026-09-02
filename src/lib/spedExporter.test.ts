import { describe, it, expect } from 'vitest';
import { exportSped } from './spedExporter';
import { SpedData } from '../types';

describe('spedExporter', () => {
  it('deve exportar SPED preservando linhas não modificadas e calculando Bloco 9', () => {
    const rawLines = [
      '|0000|014|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|3550308|||A|1|',
      '|0990|2|',
      '|C001|0|',
      '|C100|0|0|101|55|00|1|1001|12345678901234567890123456789012345678901234|01012026|01012026|100,00|0|0,00|0,00|100,00|0|0,00|0,00|0,00|100,00|18,00|0,00|0,00|0,00|0,00|0,00|0,00|0,00|',
      '|C170|1|101|PRODUTO A|1,000|UN|100,00|||000|1102||100,00|18,00|18,00|||||||||||||||||||||',
      '|C190|000|1102|18,00|100,00|100,00|18,00|0,00|0,00|0,00|0,00||',
      '|C990|4|',
      '|9001|0|',
      '|9900|0000|1|',
      '|9900|0990|1|',
      '|9900|C001|1|',
      '|9900|C100|1|',
      '|9900|C170|1|',
      '|9900|C190|1|',
      '|9900|C990|1|',
      '|9900|9001|1|',
      '|9900|9900|10|',
      '|9900|9990|1|',
      '|9900|9999|1|',
      '|9990|13|',
      '|9999|19|'
    ].map(content => ({ reg: (content.split('|')[1] || ''), content }));

    const mockSpedData: SpedData = {
      header: {
        nome: 'EMPRESA TESTE',
        cnpj: '12345678000199',
        uf: 'SP',
        dtIni: '01012026',
        dtFin: '31012026'
      },
      reconciliation: [],
      apuracao: null,
      documents: [
        {
          id: 'doc-1',
          numeroLinhaOriginal: 3,
          indOper: '0',
          numDoc: '1001',
          serie: '1',
          chvNfe: '12345678901234567890123456789012345678901234',
          dtDoc: '01012026',
          vlDoc: 100,
          vlBcIcms: 100,
          vlIcms: 18,
          emitenteOrDest: 'TESTE',
          cnpjEmit: '12345678000199',
          chaveValida: true,
          codSit: '00',
          codMod: '55',
          items: [
            {
              docId: 'doc-1',
              numItem: '1',
              numeroLinhaOriginal: 4,
              codItem: '101',
              descrItem: 'PRODUTO A',
              ncm: '12345678',
              qtd: 1,
              unid: 'UN',
              vlItem: 100,
              cstIcms: '000',
              cfop: '1102',
              vlBcIcms: 100,
              aliqIcms: 18,
              vlIcms: 18
            }
          ]
        }
      ],
      rawLines
    };

    const result = exportSped(mockSpedData, []);
    expect(result.erros).toHaveLength(0);
    expect(result.textoCorrigido).toContain('|0000|014|0|01012026|31012026|EMPRESA TESTE|12345678000199||SP|123456789|3550308|||A|1|');
    expect(result.textoCorrigido).toContain('|9990|14|'); // 1 (9001) + 11 (9900s) + 1 (9990) + 1 (9999) = 14
    expect(result.textoCorrigido).toContain('|9999|21|'); // 7 (nonBlock9) + 14 (block9) = 21
  });
});
