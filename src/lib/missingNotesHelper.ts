import { XmlRecord, SpedDocument, SpedItem, SpedData } from '../types';
import { mapXmlCfopToEntryCfop } from './cfopUtils';

function formatDateToSped(dateString?: string): string {
  if (!dateString) return '01012026';
  // Parse YYYY-MM-DD or ISO
  const clean = dateString.split('T')[0];
  const parts = clean.split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DDMMYYYY
      return `${parts[2].padStart(2, '0')}${parts[1].padStart(2, '0')}${parts[0]}`;
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY -> DDMMYYYY
      return `${parts[0].padStart(2, '0')}${parts[1].padStart(2, '0')}${parts[2]}`;
    }
  }
  return dateString.replace(/\D/g, '').padEnd(8, '0').substring(0, 8);
}

export function convertXmlToSpedDocument(xml: XmlRecord, companyCnpj?: string): SpedDocument {
  const isSaida = companyCnpj && xml.emitCnpj && xml.emitCnpj.replace(/\D/g, '') === companyCnpj.replace(/\D/g, '');
  const indOper = isSaida ? '1' : '0';
  const docId = xml.chvNfe ? xml.chvNfe.replace(/\D/g, '') : `DOC-${xml.nNF}-${Math.random().toString(36).substring(7)}`;

  const items: SpedItem[] = (xml.items || []).map((item, idx) => {
    const isEntryDoc = indOper === '0';
    const mappedCfop = item.cfop ? mapXmlCfopToEntryCfop(item.cfop, isEntryDoc) : (isEntryDoc ? '1102' : '5102');

    return {
      docId,
      numItem: String(item.nItem || idx + 1),
      codItem: item.cProd || `PROD-${idx + 1}`,
      descrItem: item.xProd || 'PRODUTO CONVERTIDO DO XML',
      ncm: item.ncm || '00000000',
      cfop: mappedCfop,
      cstIcms: item.cst || '000',
      qtd: item.qtd || 1,
      unid: item.unid || 'UN',
      vlItem: item.vProd || 0,
      vlBcIcms: item.vBc !== undefined ? item.vBc : (item.vProd || 0),
      aliqIcms: item.pIcms || 0,
      vlIcms: item.vIcms || 0,
      numeroLinhaOriginal: -1
    };
  });

  return {
    id: docId,
    indOper,
    numDoc: xml.nNF || '0',
    serie: xml.serie || '1',
    chvNfe: xml.chvNfe || '',
    dtDoc: formatDateToSped(xml.dhEmi),
    vlDoc: xml.vNF || items.reduce((a, i) => a + i.vlItem, 0),
    vlBcIcms: items.reduce((a, i) => a + i.vlBcIcms, 0),
    vlIcms: items.reduce((a, i) => a + i.vlIcms, 0),
    emitenteOrDest: xml.emitNome || 'FORNECEDOR / EMITENTE XML',
    cnpjEmit: xml.emitCnpj || '',
    chaveValida: true,
    codSit: '00',
    codMod: xml.mod || '55',
    items,
    numeroLinhaOriginal: -1
  };
}
