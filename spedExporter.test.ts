import { describe, it, expect } from 'vitest';
import { exportSped } from './src/lib/spedExporter';
import { SpedData, Achado } from './src/types';

describe('exportSped', () => {
  it('deve preservar VL_ICMS_ST e VL_IPI do C100 e C190', () => {
    const c100Fields = Array(30).fill('0');
    c100Fields[0] = '';
    c100Fields[1] = 'C100';
    c100Fields[8] = '123';
    c100Fields[23] = '100,00';
    c100Fields[24] = '15,00';
    c100Fields[25] = '20,00';
    
    const c170Fields = Array(38).fill('0');
    c170Fields[0] = '';
    c170Fields[1] = 'C170';

    const c190Fields = Array(13).fill('0');
    c190Fields[0] = '';
    c190Fields[1] = 'C190';
    c190Fields[2] = '000';
    c190Fields[3] = '5102';
    c190Fields[8] = '100,00';
    c190Fields[9] = '15,00';
    c190Fields[10] = '0,00';
    c190Fields[11] = '20,00';

    const spedData: SpedData = {
      header: { cnpj: '123', nome: 'Teste', uf: 'SP', dtIni: '', dtFin: '' },
      apuracao: null,
      rawLines: [
        { reg: 'C100', content: c100Fields.join('|') },
        { reg: 'C170', content: c170Fields.join('|') },
        { reg: 'C190', content: c190Fields.join('|') }
      ],
      documents: [
        {
          id: 'doc1', indOper: '0', numDoc: '123', serie: '1', chvNfe: '', dtDoc: '',
          vlDoc: 100, emitenteOrDest: '', cnpjEmit: '', chaveValida: true, codSit: '', codMod: '',
          numeroLinhaOriginal: 0,
          items: [
            { docId: 'doc1', numItem: '1', codItem: '1', descrItem: '', ncm: '', cfop: '5102', cstIcms: '000', qtd: 1, unid: 'UN', vlItem: 100, vlBcIcms: 100, aliqIcms: 18, vlIcms: 18, numeroLinhaOriginal: 1 }
          ]
        }
      ],
      reconciliation: [
        { docId: 'doc1', cstIcms: '000', cfop: '5102', somaItens: 100, vlOprC190: 100, status: 'CONCILIADO', diff: 0, numeroLinhaOriginal: 2 }
      ]
    };

    const achados: Achado[] = [
      { id: '1', docId: 'doc1', numItem: '1', statusRevisao: 'aprovado', correcaoSugerida: [{ campo: 'vlIcms', valorSugerido: 18, valorDeclarado: 0, origemSugestao: '' }], tipo: 'CST_CFOP_INCOMPATIVEL', severidade: 'baixa', titulo: '', descricao: '', numDoc: '123', serie: '1' }
    ];

    const result = exportSped(spedData, achados);
    console.log("Errors: ", result.erros);
    expect(result.erros).toHaveLength(0);

    const linhas = result.textoCorrigido.split('\r\n');
    const newC100 = linhas[0].split('|');
    const newC190 = linhas[2].split('|');
    
    expect(newC100.length).toBe(30);
    expect(newC100[24]).toBe('15,00'); // VL_ICMS_ST
    expect(newC100[25]).toBe('20,00'); // VL_IPI

    expect(newC190[9]).toBe('15,00'); // VL_ICMS_ST
    expect(newC190[11]).toBe('20,00'); // VL_IPI
  });
});
