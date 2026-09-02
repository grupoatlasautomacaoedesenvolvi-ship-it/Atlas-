import { describe, it, expect } from 'vitest';
import { calcularQuebrasDeSequencia } from './components/SequenceGapView';
import { SpedData, XmlRecord } from './types';

function createMockSpedDoc(numDoc: string, indOper: '0' | '1', serie: string = '1', codMod: string = '55') {
  return {
    id: `doc_${numDoc}_${indOper}`,
    indOper, // '1' = Saída (Emissão Própria), '0' = Entrada (Terceiros)
    codMod,
    codSit: '00',
    numDoc,
    serie,
    chvNfe: `3524080000000000000055001${numDoc.padStart(9, '0')}1000000001`,
    dtDoc: '2024-08-01',
    vlDoc: 100,
    emitenteOrDest: 'Empresa Teste',
    cnpjEmit: '00000000000000',
    chaveValida: true,
    items: [],
    numeroLinhaOriginal: 1
  };
}

function createMockXml(nNF: string, isTerceiros: boolean = false, serie: string = '1', mod: string = '55') {
  return {
    id: `xml_${nNF}_${isTerceiros ? 'terc' : 'prop'}`,
    chvNfe: `3524080000000000000055001${nNF.padStart(9, '0')}1000000001`,
    mod,
    tpNF: isTerceiros ? '0' : '1',
    nNF,
    serie,
    dhEmi: '2024-08-01',
    emitCnpj: '00000000000000',
    emitNome: 'Emitente Teste',
    destCnpj: '11111111111111',
    destNome: 'Destinatário Teste',
    vNF: 100,
    vProd: 100,
    vICMS: 0,
    itensCount: 0,
    isTerceiros,
    items: []
  } as XmlRecord;
}

describe('Ajuste de Quebra de Sequência (Apenas dentro da sequência)', () => {
  it('1. Deve identificar quebras APENAS entre o menor e o maior número de saída, e NADA pra frente do último', () => {
    // Exemplo: Notas de saída SPED do número 10 ao 20, com furos no 14 e no 17
    const spedDocs = [
      createMockSpedDoc('10', '1'),
      createMockSpedDoc('11', '1'),
      createMockSpedDoc('12', '1'),
      createMockSpedDoc('13', '1'),
      // 14 faltando
      createMockSpedDoc('15', '1'),
      createMockSpedDoc('16', '1'),
      // 17 faltando
      createMockSpedDoc('18', '1'),
      createMockSpedDoc('19', '1'),
      createMockSpedDoc('20', '1'), // ÚLTIMA nota da sequência
    ];

    const spedData: SpedData = {
      header: { cnpj: '00000000000000', nome: 'Empresa Teste', uf: 'SP', dtIni: '01082024', dtFin: '31082024' },
      documents: spedDocs,
      reconciliation: [],
      apuracao: null
    };

    const result = calcularQuebrasDeSequencia(spedData, []);
    expect(result.length).toBe(1);

    const grupo = result[0];
    expect(grupo.minNum).toBe(10);
    expect(grupo.maxNum).toBe(20); // Deve parar exatamente no 20!
    expect(grupo.totalEsperado).toBe(11); // 10 a 20 = 11 números

    // Itens resultantes do loop 10..20
    const numbersInResult = grupo.items.map(it => it.numDoc);
    expect(numbersInResult).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

    // As notas 14 e 17 devem ser marcadas como GAP_NO_XML
    const gaps = grupo.items.filter(it => it.status === 'GAP_NO_XML');
    expect(gaps.map(g => g.numDoc)).toEqual([14, 17]);

    // NENHUMA nota acima de 20 deve ser listada como quebra
    expect(grupo.items.some(it => it.numDoc > 20)).toBe(false);
  });

  it('2. Deve IGNORAR notas de entrada/fornecedores no SPED (indOper === "0") para não corromper o limite superior', () => {
    // Exemplo: Saídas de 1 a 5, mas o SPED contém uma nota de ENTRADA do fornecedor número 85000
    const spedDocs = [
      createMockSpedDoc('1', '1'),
      createMockSpedDoc('2', '1'),
      createMockSpedDoc('3', '1'),
      createMockSpedDoc('5', '1'), // Saída 4 faltando
      createMockSpedDoc('85000', '0') // Compra de fornecedor (Entrada) com número alto
    ];

    const spedData: SpedData = {
      header: { cnpj: '00000000000000', nome: 'Empresa Teste', uf: 'SP', dtIni: '01082024', dtFin: '31082024' },
      documents: spedDocs,
      reconciliation: [],
      apuracao: null
    };

    const result = calcularQuebrasDeSequencia(spedData, []);
    expect(result.length).toBe(1);

    const grupo = result[0];
    // maxNum deve ser 5 (da última saída), e NÃO 85000!
    expect(grupo.minNum).toBe(1);
    expect(grupo.maxNum).toBe(5);
    expect(grupo.totalEsperado).toBe(5);

    // O resultado não pode conter milhares de quebras falsas até 85000
    expect(grupo.items.length).toBe(5);
    expect(grupo.items.map(i => i.numDoc)).toEqual([1, 2, 3, 4, 5]);
  });

  it('3. Deve IGNORAR XMLs de terceiros (isTerceiros === true) para não inflar a sequência de saídas', () => {
    const spedDocs = [
      createMockSpedDoc('100', '1'),
      createMockSpedDoc('101', '1'),
      createMockSpedDoc('102', '1')
    ];

    const xmlTerceiros = [
      createMockXml('98500', true) // XML de fornecedor com número 98500
    ];

    const spedData: SpedData = {
      header: { cnpj: '00000000000000', nome: 'Empresa Teste', uf: 'SP', dtIni: '01082024', dtFin: '31082024' },
      documents: spedDocs,
      reconciliation: [],
      apuracao: null
    };

    const result = calcularQuebrasDeSequencia(spedData, xmlTerceiros);
    expect(result.length).toBe(1);

    const grupo = result[0];
    expect(grupo.minNum).toBe(100);
    expect(grupo.maxNum).toBe(102); // Não considera o 98500 de terceiros
    expect(grupo.totalSemXml).toBe(0);
  });

  it('4. Ao encontrar um salto grande (ex: nota 10 a 12 e depois nota 100), registra APENAS a nota 11 e para a verificação contínua do intervalo', () => {
    const spedDocs = [
      createMockSpedDoc('10', '1'),
      createMockSpedDoc('11', '1'),
      createMockSpedDoc('12', '1'),
      // Salto imenso na sequência para a nota 100
      createMockSpedDoc('100', '1'),
      createMockSpedDoc('101', '1')
    ];

    const spedData: SpedData = {
      header: { cnpj: '00000000000000', nome: 'Empresa Teste', uf: 'SP', dtIni: '01082024', dtFin: '31082024' },
      documents: spedDocs,
      reconciliation: [],
      apuracao: null
    };

    const result = calcularQuebrasDeSequencia(spedData, []);
    expect(result.length).toBe(1);

    const grupo = result[0];
    expect(grupo.minNum).toBe(10);
    expect(grupo.maxNum).toBe(101);

    // Registra apenas a nota 13 como a faltante imediatamente subsequente para indicar a quebra
    const gapItems = grupo.items.filter(it => it.status === 'GAP_NO_XML');
    expect(gapItems.length).toBe(1);
    expect(gapItems[0].numDoc).toBe(13);

    // Os números 14 a 99 NÃO devem ser marcados como faltantes
    expect(grupo.items.map(it => it.numDoc)).toEqual([10, 11, 12, 13, 100, 101]);
  });
});
