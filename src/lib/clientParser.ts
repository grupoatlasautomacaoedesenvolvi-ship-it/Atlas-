import { SpedData, SpedDocument, SpedItem, SpedHeader, SpedC190Reconciliation, SpedApuracao, XmlRecord, XmlItem, Sped0200Item, SpedH010Item, SpedBlocoH } from '../types';
import JSZip from 'jszip';

export function extractCnpjFromChave(chvNfe: string): { cnpjEmit: string; chaveValida: boolean } {
  if (!chvNfe) return { cnpjEmit: '', chaveValida: false };
  const digits = chvNfe.replace(/\D/g, '');
  if (digits.length !== 44) return { cnpjEmit: '', chaveValida: false };
  return { cnpjEmit: digits.substring(6, 20), chaveValida: true };
}

// Helper para ler elementos XML de forma segura
function getDescendantText(parent: Element, tags: string[]): string {
  for (const tag of tags) {
    const el = parent.getElementsByTagName(tag)[0];
    if (el && el.textContent) {
      return el.textContent.trim();
    }
  }
  return '';
}

export function parseXmlDocument(xmlText: string): XmlRecord | null {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const parserError = doc.getElementsByTagName('parsererror')[0];
    if (parserError) {
      return null;
    }

    const nfeProc = doc.getElementsByTagName('nfeProc')[0];
    const infNFe = doc.getElementsByTagName('infNFe')[0];

    if (!infNFe) {
      return null;
    }

    const chvNfe = infNFe.getAttribute('Id')?.replace('NFe', '') || '';

    // Verificar se é evento de cancelamento ou inutilização
    const procEvento = doc.getElementsByTagName('procEventoNFe')[0];
    let tpEvento = '';
    let isCancelada = false;
    if (procEvento) {
      tpEvento = getDescendantText(procEvento, ['tpEvento']);
      if (tpEvento === '110111' || tpEvento === '110112') {
        isCancelada = true;
      }
    }

    const ide = doc.getElementsByTagName('ide')[0];
    const emit = doc.getElementsByTagName('emit')[0];
    const dest = doc.getElementsByTagName('dest')[0];
    const total = doc.getElementsByTagName('total')[0];
    const icmsTot = total ? total.getElementsByTagName('ICMSTot')[0] : null;

    const mod = ide ? getDescendantText(ide, ['mod']) : '55';
    const tpNF = ide ? getDescendantText(ide, ['tpNF']) : '0';
    const nNF = ide ? getDescendantText(ide, ['nNF']) : '';
    const serie = ide ? getDescendantText(ide, ['serie']) : '';
    const dhEmi = ide ? getDescendantText(ide, ['dhEmi', 'dEmi']) : '';

    const emitCnpj = emit ? getDescendantText(emit, ['CNPJ', 'CPF']) : '';
    const emitNome = emit ? getDescendantText(emit, ['xNome']) : '';

    const destCnpj = dest ? getDescendantText(dest, ['CNPJ', 'CPF']) : '';
    const destNome = dest ? getDescendantText(dest, ['xNome']) : '';

    const vNF = icmsTot ? parseFloat(getDescendantText(icmsTot, ['vNF']).replace(',', '.')) || 0 : 0;
    const vProd = icmsTot ? parseFloat(getDescendantText(icmsTot, ['vProd']).replace(',', '.')) || 0 : 0;
    const vICMS = icmsTot ? parseFloat(getDescendantText(icmsTot, ['vICMS']).replace(',', '.')) || 0 : 0;

    const protNFe = doc.getElementsByTagName('protNFe')[0];
    const infProt = protNFe ? protNFe.getElementsByTagName('infProt')[0] : null;
    const cStat = infProt ? getDescendantText(infProt, ['cStat']) : '100';
    const xMotivo = infProt ? getDescendantText(infProt, ['xMotivo']) : 'Autorizado o uso da NF-e';

    if (cStat === '101' || cStat === '135' || cStat === '151' || cStat === '155') {
      isCancelada = true;
    }

    const detList = doc.getElementsByTagName('det');
    const xmlItems: XmlItem[] = [];

    for (let i = 0; i < detList.length; i++) {
      const det = detList[i];
      const nItem = det.getAttribute('nItem') || String(i + 1);
      const prodEl = det.getElementsByTagName('prod')[0];
      const impostoEl = det.getElementsByTagName('imposto')[0];

      const cProd = prodEl ? getDescendantText(prodEl, ['cProd']) : '';
      const xProd = prodEl ? getDescendantText(prodEl, ['xProd']) : '';
      const ncm = prodEl ? getDescendantText(prodEl, ['NCM', 'ncm']) : '';
      const cfop = prodEl ? getDescendantText(prodEl, ['CFOP', 'cfop']) : '';
      const qCom = parseFloat((prodEl ? getDescendantText(prodEl, ['qCom', 'qcom']) : '0').replace(',', '.')) || 0;
      const uCom = prodEl ? getDescendantText(prodEl, ['uCom', 'ucom']) : '';
      const vItemProd = parseFloat((prodEl ? getDescendantText(prodEl, ['vProd', 'vprod']) : '0').replace(',', '.')) || 0;

      let cst = '';
      let vBc = 0;
      let pIcms = 0;
      let vIcms = 0;

      if (impostoEl) {
        cst = getDescendantText(impostoEl, ['CST', 'CSOSN', 'cst', 'csosn']).trim().padStart(3, '0');
        vBc = parseFloat(getDescendantText(impostoEl, ['vBC', 'vbc']).replace(',', '.')) || 0;
        pIcms = parseFloat(getDescendantText(impostoEl, ['pICMS', 'picms']).replace(',', '.')) || 0;
        vIcms = parseFloat(getDescendantText(impostoEl, ['vICMS', 'vicms']).replace(',', '.')) || 0;
      }

      xmlItems.push({
        nItem,
        cProd,
        xProd,
        ncm,
        cfop,
        cst,
        qtd: qCom,
        unid: uCom,
        vProd: vItemProd,
        vBc,
        pIcms,
        vIcms
      });
    }

    return {
      id: chvNfe || crypto.randomUUID(),
      chvNfe,
      mod: mod || '55',
      tpNF: tpNF || '0',
      nNF,
      serie,
      dhEmi,
      emitCnpj,
      emitNome,
      destCnpj,
      destNome,
      vNF,
      vProd,
      vICMS,
      itensCount: xmlItems.length || 1,
      items: xmlItems,
      cStat,
      xMotivo,
      tpEvento,
      isCancelada
    };
  } catch (err) {
    console.error('Error parsing XML document:', err);
    return null;
  }
}

export async function importarArquivo(file: File): Promise<XmlRecord[]> {
  if (file.name.toLowerCase().endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    const registros: XmlRecord[] = [];
    for (const nome of Object.keys(zip.files)) {
      const entry = zip.files[nome];
      if (entry.dir || !nome.toLowerCase().endsWith('.xml')) continue;
      const texto = await entry.async('text');
      const registro = parseXmlDocument(texto);
      if (registro) registros.push(registro);
    }
    return registros;
  }

  const texto = await file.text();
  const registro = parseXmlDocument(texto);
  return registro ? [registro] : [];
}

export async function parseSpedContent(
  content: string,
  onProgress?: (progress: number, message: string) => void
): Promise<SpedData> {
  onProgress?.(5, 'Iniciando leitura assíncrona do SPED...');
  const lines = content.split(/\r?\n/);
  const totalLines = lines.length;
  
  let header: SpedHeader = { cnpj: '', nome: '', uf: 'SP', dtIni: '', dtFin: '' };
  let apuracao: SpedApuracao | null = null;
  const parseNum = (val: string) => parseFloat((val || '0').replace(',', '.')) || 0;
  
  const itemNcmMap = new Map<string, { ncm: string; descr: string }>();
  const items0200List: Sped0200Item[] = [];
  const h010ItemsList: SpedH010Item[] = [];
  let blocoHData: SpedBlocoH | undefined = undefined;

  const documentsMap = new Map<string, SpedDocument>();
  const c190RawList: { docId: string; cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBcIcms: number; vlIcms: number; numeroLinhaOriginal: number }[] = [];
  const rawLines: { reg: string; content: string }[] = [];

  let currentDocId = '';
  let rawLineIndex = 0;

  const chunkSize = 5000;
  for (let i = 0; i < totalLines; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, totalLines);
    for (let j = i; j < chunkEnd; j++) {
      const line = lines[j];
      if (!line || !line.startsWith('|')) continue;
      const fields = line.split('|');
      const reg = fields[1];
      rawLines.push({ reg, content: line });
      const currentRawIndex = rawLineIndex;
      rawLineIndex++;

      if (reg === '0000') {
        header = {
          dtIni: fields[4] || '',
          dtFin: fields[5] || '',
          nome: fields[6] || '',
          cnpj: fields[7] || '',
          uf: fields[9] || 'SP'
        };
      } else if (reg === '0200') {
        const codItem = fields[2] || '';
        const descrItem = fields[3] || '';
        const codBarra = fields[4] || '';
        const unid = fields[6] || 'UN';
        const tipoItem = fields[7] || '00';
        const ncm = fields[8] || '';
        const aliqIcms = parseNum(fields[12]);
        const cest = fields[13] || '';

        if (codItem) {
          itemNcmMap.set(codItem, { ncm, descr: descrItem });
          items0200List.push({
            codItem,
            descrItem,
            codBarra,
            unid,
            tipoItem,
            ncm,
            aliqIcms,
            cest,
            numeroLinhaOriginal: currentRawIndex
          });
        }
      } else if (reg === 'H005') {
        blocoHData = {
          dtInv: fields[2] || header.dtFin || '',
          vlInv: parseNum(fields[3]),
          motInv: fields[4] || '01',
          items: [],
          numeroLinhaOriginalH005: currentRawIndex
        };
      } else if (reg === 'H010') {
        const itemH010: SpedH010Item = {
          codItem: fields[2] || '',
          unid: fields[3] || 'UN',
          qtd: parseNum(fields[4]),
          vlUnit: parseNum(fields[5]),
          vlItem: parseNum(fields[6]),
          indProp: fields[7] || '0',
          codPart: fields[8] || '',
          txtCompl: fields[9] || '',
          codCta: fields[10] || '',
          vlItemIr: parseNum(fields[11]),
          numeroLinhaOriginal: currentRawIndex
        };
        h010ItemsList.push(itemH010);
      } else if (reg === 'H020') {
        const cstIcms = fields[2] || '000';
        const vlBcIcms = parseNum(fields[3]);
        const vlIcms = parseNum(fields[4]);
        if (h010ItemsList.length > 0) {
          const lastH010 = h010ItemsList[h010ItemsList.length - 1];
          const h020Obj = {
            cstIcms,
            vlBcIcms,
            vlIcms,
            numeroLinhaOriginal: currentRawIndex
          };
          if (!lastH010.h020List) lastH010.h020List = [];
          lastH010.h020List.push(h020Obj);
          lastH010.h020 = h020Obj;
        }
      } else if (reg === 'C100') {
        const indOper = fields[2] || '';
        const serie = fields[7] || '';
        const numDoc = fields[8] || '';
        const chvNfe = fields[9] || '';
        const dtDoc = fields[10] || '';
        const vlDoc = parseFloat((fields[12] || '0').replace(',', '.')) || 0;
        const vlBcIcms = parseFloat((fields[21] || '0').replace(',', '.')) || 0;
        const vlIcms = parseFloat((fields[22] || '0').replace(',', '.')) || 0;
        const emitenteOrDest = fields[4] || '';

        const { cnpjEmit, chaveValida } = extractCnpjFromChave(chvNfe);
        currentDocId = `${serie}-${numDoc}-${dtDoc}`;

        documentsMap.set(currentDocId, {
          id: currentDocId,
          indOper,
          numDoc,
          serie,
          chvNfe,
          dtDoc,
          vlDoc,
          vlBcIcms,
          vlIcms,
          emitenteOrDest,
          cnpjEmit: cnpjEmit || emitenteOrDest,
          chaveValida,
          codSit: fields[6] || '',
          codMod: fields[5] || '',
          items: [],
          numeroLinhaOriginal: currentRawIndex
        });
      } else if (reg === 'C170' && currentDocId) {
        const numItem = fields[2] || '1';
        const codItem = fields[3] || '';
        const descrCompl = fields[4] || '';
        const qtd = parseFloat((fields[5] || '0').replace(',', '.')) || 0;
        const unid = fields[6] || '';
        const vlItem = parseFloat((fields[7] || '0').replace(',', '.')) || 0;
        const cstIcms = (fields[10] || '').trim().padStart(3, '0');
        const cfop = fields[11] || '';
        const vlBcIcms = parseFloat((fields[13] || '0').replace(',', '.')) || 0;
        const aliqIcms = parseFloat((fields[14] || '0').replace(',', '.')) || 0;
        const vlIcms = parseFloat((fields[15] || '0').replace(',', '.')) || 0;

        const itemInfo = itemNcmMap.get(codItem);
        const ncm = itemInfo ? itemInfo.ncm : '';
        const descrItem = itemInfo ? itemInfo.descr : (descrCompl || codItem);
        const aliquotaImplausivel = aliqIcms > 100 || Math.abs(aliqIcms - vlItem) < 0.01;

        const docObj = documentsMap.get(currentDocId);
        if (docObj) {
          docObj.items.push({
            docId: currentDocId,
            numItem,
            codItem,
            descrItem,
            ncm,
            cfop,
            cstIcms,
            qtd,
            unid,
            vlItem,
            vlBcIcms,
            aliqIcms,
            vlIcms,
            malformed: aliquotaImplausivel,
            malformedReason: aliquotaImplausivel ? 'ALIQ_ICMS_IMPLAUSIVEL' : undefined,
            numeroLinhaOriginal: currentRawIndex
          });
        }
      } else if (reg === 'C190' && currentDocId) {
        const cstIcms = (fields[2] || '').trim().padStart(3, '0');
        const cfop = fields[3] || '';
        const aliqIcms = parseFloat((fields[4] || '0').replace(',', '.')) || 0;
        const vlOpr = parseFloat((fields[5] || '0').replace(',', '.')) || 0;
        const vlBcIcms = parseFloat((fields[6] || '0').replace(',', '.')) || 0;
        const vlIcms = parseFloat((fields[7] || '0').replace(',', '.')) || 0;
        c190RawList.push({ docId: currentDocId, cstIcms, cfop, aliqIcms, vlOpr, vlBcIcms, vlIcms, numeroLinhaOriginal: currentRawIndex });
      } else if (reg === 'E110') {
        apuracao = {
          vlTotDebitos: parseNum(fields[2]),
          vlAjDebitos: parseNum(fields[3]),
          vlTotAjDebitos: parseNum(fields[4]),
          vlEstornosCred: parseNum(fields[5]),
          vlTotCreditos: parseNum(fields[6]),
          vlAjCreditos: parseNum(fields[7]),
          vlTotAjCreditos: parseNum(fields[8]),
          vlEstornosDeb: parseNum(fields[9]),
          vlSldCredorAnt: parseNum(fields[10]),
          vlSldApurado: parseNum(fields[11]),
          vlTotDed: parseNum(fields[12]),
          vlIcmsRecolher: parseNum(fields[13]),
          vlSldCredorTransportar: parseNum(fields[14]),
          debEsp: parseNum(fields[15])
        };
      }
    }

    const progress = Math.min(85, Math.round((chunkEnd / totalLines) * 80) + 5);
    onProgress?.(progress, `Processando arquivo SPED... ${progress}% (${chunkEnd.toLocaleString()} de ${totalLines.toLocaleString()} linhas)`);
    await new Promise(r => setTimeout(r, 0));
  }

  onProgress?.(90, 'Consolidando documentos e apuração fiscal...');
  const documents = Array.from(documentsMap.values());

  // Consolidar e eliminar duplicidades do C190 (mesmo docId + cstIcms + cfop + aliqIcms)
  const c190DedupMap = new Map<string, { docId: string; cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBcIcms: number; vlIcms: number; numeroLinhaOriginal: number }>();
  for (const c190 of c190RawList) {
    const key = `${c190.docId}_${c190.cstIcms}_${c190.cfop}_${(c190.aliqIcms || 0).toFixed(2)}`;
    if (!c190DedupMap.has(key)) {
      c190DedupMap.set(key, { ...c190 });
    } else {
      const existing = c190DedupMap.get(key)!;
      existing.vlOpr = Math.round((existing.vlOpr + c190.vlOpr) * 100) / 100;
      existing.vlBcIcms = Math.round((existing.vlBcIcms + c190.vlBcIcms) * 100) / 100;
      existing.vlIcms = Math.round((existing.vlIcms + c190.vlIcms) * 100) / 100;
    }
  }
  const consolidatedC190RawList = Array.from(c190DedupMap.values());
  c190RawList.length = 0;
  c190RawList.push(...consolidatedC190RawList);

  documents.forEach(doc => {
    const sumMerc = doc.items.reduce((s, i) => s + (i.vlItem || 0), 0);
    if ((doc.vlDoc === 0 || doc.vlDoc === undefined) && sumMerc > 0) {
      doc.vlDoc = sumMerc;
    }
  });

  const reconciliation: SpedC190Reconciliation[] = [];
  documents.forEach(doc => {
    const itemGroups = new Map<string, number>();
    doc.items.forEach(item => {
      const key = `${item.cstIcms}_${item.cfop}`;
      itemGroups.set(key, (itemGroups.get(key) || 0) + item.vlItem);
    });

    const docC190s = c190RawList.filter(c => c.docId === doc.id);
    docC190s.forEach(c190 => {
      const key = `${c190.cstIcms}_${c190.cfop}`;
      const somaItens = itemGroups.get(key) || 0;
      const diff = Math.round((somaItens - c190.vlOpr) * 100) / 100;
      const status = Math.abs(diff) <= 0.05 ? 'CONCILIADO' : 'DIVERGENTE';
      reconciliation.push({
        docId: doc.id,
        cstIcms: c190.cstIcms,
        cfop: c190.cfop,
        somaItens,
        vlOprC190: c190.vlOpr,
        status,
        diff,
        numeroLinhaOriginal: c190.numeroLinhaOriginal
      });
    });

    itemGroups.forEach((somaItens, key) => {
      if (!docC190s.some(c => `${c.cstIcms}_${c.cfop}` === key)) {
        const [cstIcms, cfop] = key.split('_');
        reconciliation.push({
          docId: doc.id,
          cstIcms,
          cfop,
          somaItens,
          vlOprC190: 0,
          status: 'C190_AUSENTE',
          diff: somaItens,
          numeroLinhaOriginal: -1
        });
      }
    });
  });

  if (blocoHData) {
    blocoHData.items = h010ItemsList;
  } else if (h010ItemsList.length > 0) {
    blocoHData = {
      dtInv: header.dtFin || '',
      vlInv: h010ItemsList.reduce((acc, i) => acc + i.vlItem, 0),
      motInv: '01',
      items: h010ItemsList
    };
  }

  onProgress?.(100, `SPED importado com sucesso (${documents.length.toLocaleString()} documentos)`);
  return {
    header,
    documents,
    reconciliation,
    apuracao,
    rawLines,
    c190Raw: c190RawList,
    items0200: items0200List,
    blocoH: blocoHData
  };
}

export async function parseXmlFiles(
  files: File[],
  onProgress?: (progress: number, message: string) => void
): Promise<XmlRecord[]> {
  let all: XmlRecord[] = [];
  let totalFiles = files.length;
  let processed = 0;

  for (const f of files) {
    if (f.name.toLowerCase().endsWith('.zip')) {
      const zip = await JSZip.loadAsync(f);
      const entries = Object.keys(zip.files).filter(nome => !zip.files[nome].dir && nome.toLowerCase().endsWith('.xml'));
      let zipCount = entries.length;
      let zipProcessed = 0;

      for (const nome of entries) {
        const entry = zip.files[nome];
        const texto = await entry.async('text');
        const registro = parseXmlDocument(texto);
        if (registro) all.push(registro);
        zipProcessed++;
        if (zipProcessed % 50 === 0) {
          const pct = Math.round((processed / totalFiles) * 100);
          onProgress?.(pct, `Extraindo ZIP (${zipProcessed.toLocaleString()}/${zipCount.toLocaleString()} XMLs)...`);
          await new Promise(r => setTimeout(r, 0));
        }
      }
    } else {
      const texto = await f.text();
      const registro = parseXmlDocument(texto);
      if (registro) all.push(registro);
    }

    processed++;
    const pct = Math.min(95, Math.round((processed / totalFiles) * 100));
    onProgress?.(pct, `Processando arquivo ${processed} de ${totalFiles} (${all.length.toLocaleString()} XMLs extraídos)...`);
    await new Promise(r => setTimeout(r, 0));
  }

  onProgress?.(100, `Importação concluída (${all.length.toLocaleString()} XMLs carregados)`);
  return all;
}
