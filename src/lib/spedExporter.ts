import { SpedData, Achado } from '../types';

export interface AlteracaoAplicada {
  numeroLinha: number;
  registro: string;
  campo: string;
  valorAntigo: string;
  valorNovo: string;
  achadoId: string;
}

export interface ResultadoExportacao {
  textoCorrigido: string;
  relatorio: AlteracaoAplicada[];
  erros: string[];
}

function formatarComoOriginal(valor: number, _campoOriginal?: string): string {
  return (valor || 0).toFixed(2).replace('.', ',');
}

// Índices validados do layout SPED Fiscal EFD ICMS/IPI
const IDX_C170 = { vlItem: 7, cstIcms: 10, cfop: 11, vlBcIcms: 13, aliqIcms: 14, vlIcms: 15 };
const IDX_C190 = { cstIcms: 2, cfop: 3, aliqIcms: 4, vlOpr: 5, vlBcIcms: 6, vlIcms: 7 };
const IDX_C100 = { vlDoc: 12, vlMerc: 16, vlBcIcms: 21, vlIcms: 22 };

export function exportSped(spedData: SpedData, achadosAprovados: Achado[]): ResultadoExportacao {
  console.log('[SPED Exporter Verification] Iniciando exportação SPED com total de documentos:', spedData?.documents?.length || 0);

  if (!spedData.rawLines || spedData.rawLines.length === 0) {
    console.error('[SPED Exporter Verification] Erro: SPED sem texto original preservado.');
    return { textoCorrigido: '', relatorio: [], erros: ['SPED sem texto original preservado — não é possível exportar com segurança.'] };
  }

  let linhas = spedData.rawLines.map(l => l.content);
  const relatorio: AlteracaoAplicada[] = [];
  const docIdsAfetados = new Set<string>();

  function validarContagem(numeroLinha: number, camposAntes: number, camposDepois: number, contexto: string) {
    if (camposAntes !== camposDepois) {
      throw new Error(`${contexto} alterou o número de campos da linha ${numeroLinha + 1} (${camposAntes} -> ${camposDepois}) — exportação abortada.`);
    }
  }

  try {
    let totalItensVerificados = 0;
    let totalItensModificados = 0;

    // 0. Aplicar alterações no Bloco 0200 se houver items0200
    if (spedData.items0200 && spedData.items0200.length > 0) {
      for (const item0200 of spedData.items0200) {
        if (item0200.numeroLinhaOriginal !== undefined && item0200.numeroLinhaOriginal >= 0 && linhas[item0200.numeroLinhaOriginal]) {
          const campos = linhas[item0200.numeroLinhaOriginal].split('|');
          if (campos[1] === '0200') {
            let mudou = false;
            if (item0200.ncm && campos[8] !== item0200.ncm) {
              relatorio.push({
                numeroLinha: item0200.numeroLinhaOriginal + 1,
                registro: '0200',
                campo: 'NCM',
                valorAntigo: campos[8],
                valorNovo: item0200.ncm,
                achadoId: 'edicao-estoque'
              });
              campos[8] = item0200.ncm;
              mudou = true;
            }
            if (item0200.aliqIcms !== undefined) {
              const aliqStr = formatarComoOriginal(item0200.aliqIcms);
              if (campos[12] !== aliqStr) {
                relatorio.push({
                  numeroLinha: item0200.numeroLinhaOriginal + 1,
                  registro: '0200',
                  campo: 'ALIQ_ICMS',
                  valorAntigo: campos[12],
                  valorNovo: aliqStr,
                  achadoId: 'edicao-estoque'
                });
                campos[12] = aliqStr;
                mudou = true;
              }
            }
            if (mudou) {
              linhas[item0200.numeroLinhaOriginal] = campos.join('|');
            }
          }
        }
      }
    }

    // 0.5 Aplicar / Injetar Bloco H (H005 e H010) se houver blocoH
    if (spedData.blocoH && spedData.blocoH.items && spedData.blocoH.items.length > 0) {
      const dtInv = spedData.blocoH.dtInv || spedData.header.dtFin || '';
      const motInv = spedData.blocoH.motInv || '01';
      const totInv = spedData.blocoH.items.reduce((s, i) => s + (i.vlItem || 0), 0);
      const totInvStr = formatarComoOriginal(totInv);

      const novasLinhasBlocoH: string[] = [];
      novasLinhasBlocoH.push(`|H001|0|`);
      novasLinhasBlocoH.push(`|H005|${dtInv}|${totInvStr}|${motInv}|`);

      for (const item of spedData.blocoH.items) {
        const qtdStr = (item.qtd || 0).toFixed(3).replace('.', ',');
        const vlUnitStr = formatarComoOriginal(item.vlUnit || 0);
        const vlItemStr = formatarComoOriginal(item.vlItem || 0);
        const indProp = item.indProp || '0';
        const codPart = item.codPart || '';
        const txtCompl = item.txtCompl || '';
        const codCta = item.codCta || '';
        const vlItemIrStr = item.vlItemIr ? formatarComoOriginal(item.vlItemIr) : '';

        novasLinhasBlocoH.push(`|H010|${item.codItem}|${item.unid || 'UN'}|${qtdStr}|${vlUnitStr}|${vlItemStr}|${indProp}|${codPart}|${txtCompl}|${codCta}|${vlItemIrStr}|`);

        // Export H020 records (Informação Complementar do Inventário)
        const h020Items = item.h020List && item.h020List.length > 0 ? item.h020List : (item.h020 ? [item.h020] : []);
        for (const h020Item of h020Items) {
          const cstIcms = h020Item.cstIcms || '000';
          const bcIcms = typeof h020Item.vlBcIcms === 'number' ? h020Item.vlBcIcms : item.vlItem;
          const vlIcms = typeof h020Item.vlIcms === 'number' ? h020Item.vlIcms : 0;
          const bcIcmsStr = formatarComoOriginal(bcIcms);
          const vlIcmsStr = formatarComoOriginal(vlIcms);
          novasLinhasBlocoH.push(`|H020|${cstIcms}|${bcIcmsStr}|${vlIcmsStr}|`);
        }
      }
      novasLinhasBlocoH.push(`|H990|${novasLinhasBlocoH.length + 1}|`);

      // Verificar se já existem linhas do Bloco H para substituir ou se é injeção
      const hFirstIdx = linhas.findIndex(l => (l.split('|')[1] || '').trim().startsWith('H'));
      if (hFirstIdx >= 0) {
        let hLastIdx = hFirstIdx;
        for (let i = hFirstIdx; i < linhas.length; i++) {
          const reg = (linhas[i].split('|')[1] || '').trim();
          if (reg.startsWith('H')) {
            hLastIdx = i;
          } else {
            break;
          }
        }
        const deleteCount = hLastIdx - hFirstIdx + 1;
        linhas.splice(hFirstIdx, deleteCount, ...novasLinhasBlocoH);
        relatorio.push({
          numeroLinha: hFirstIdx + 1,
          registro: 'H005/H010',
          campo: 'bloco-h',
          valorAntigo: `${deleteCount} linhas originais`,
          valorNovo: `${novasLinhasBlocoH.length} linhas (Total R$ ${totInvStr})`,
          achadoId: 'atualizacao-estoque'
        });
      } else {
        // Injetar Bloco H antes de K, 1 ou 9
        let insertIdx = linhas.findIndex(l => (l.split('|')[1] || '').trim().startsWith('K'));
        if (insertIdx === -1) insertIdx = linhas.findIndex(l => (l.split('|')[1] || '').trim().startsWith('1'));
        if (insertIdx === -1) insertIdx = linhas.findIndex(l => (l.split('|')[1] || '').trim().startsWith('9'));
        if (insertIdx === -1) insertIdx = linhas.length - 1;

        linhas.splice(insertIdx, 0, ...novasLinhasBlocoH);
        relatorio.push({
          numeroLinha: insertIdx + 1,
          registro: 'H001/H005/H010',
          campo: 'injecao-bloco-h',
          valorAntigo: 'Bloco H Ausente',
          valorNovo: `Criado Bloco H com ${spedData.blocoH.items.length} itens (Total R$ ${totInvStr})`,
          achadoId: 'criacao-estoque'
        });
      }
    }

    // 1. Aplicar alterações nos C170 presentes no spedData.documents (Edições de CST/CFOP/Valores/Matriz/XML)
    for (const doc of spedData.documents) {
      for (const item of doc.items) {
        totalItensVerificados++;
        const numeroLinha = item.numeroLinhaOriginal;
        if (numeroLinha === undefined || numeroLinha < 0 || !linhas[numeroLinha]) continue;

        const campos = linhas[numeroLinha].split('|');
        if (campos[1] !== 'C170') continue;

        const camposAntes = campos.length;
        let mudou = false;

        // CST_ICMS (posição 10)
        const origCst = (campos[IDX_C170.cstIcms] || '').trim();
        const newCst = (item.cstIcms || '').trim();
        if (newCst && origCst !== newCst) {
          relatorio.push({
            numeroLinha: numeroLinha + 1,
            registro: 'C170',
            campo: 'cstIcms',
            valorAntigo: campos[IDX_C170.cstIcms],
            valorNovo: item.cstIcms,
            achadoId: 'edicao-direta'
          });
          campos[IDX_C170.cstIcms] = item.cstIcms;
          mudou = true;
        }

        // CFOP (posição 11)
        const origCfop = (campos[IDX_C170.cfop] || '').trim();
        const newCfop = (item.cfop || '').trim();
        if (newCfop && origCfop !== newCfop) {
          relatorio.push({
            numeroLinha: numeroLinha + 1,
            registro: 'C170',
            campo: 'cfop',
            valorAntigo: campos[IDX_C170.cfop],
            valorNovo: item.cfop,
            achadoId: 'edicao-direta'
          });
          campos[IDX_C170.cfop] = item.cfop;
          mudou = true;
        }

        // VL_ITEM (posição 7)
        if (item.vlItem !== undefined) {
          const origVal = parseFloat((campos[IDX_C170.vlItem] || '0').replace(',', '.')) || 0;
          if (Math.abs(origVal - item.vlItem) > 0.001) {
            const novoVlItem = formatarComoOriginal(item.vlItem, campos[IDX_C170.vlItem]);
            relatorio.push({
              numeroLinha: numeroLinha + 1,
              registro: 'C170',
              campo: 'vlItem',
              valorAntigo: campos[IDX_C170.vlItem],
              valorNovo: novoVlItem,
              achadoId: 'edicao-direta'
            });
            campos[IDX_C170.vlItem] = novoVlItem;
            mudou = true;
          }
        }

        // VL_BC_ICMS (posição 13)
        if (item.vlBcIcms !== undefined) {
          const origVal = parseFloat((campos[IDX_C170.vlBcIcms] || '0').replace(',', '.')) || 0;
          if (Math.abs(origVal - item.vlBcIcms) > 0.001) {
            const novoVlBc = formatarComoOriginal(item.vlBcIcms, campos[IDX_C170.vlBcIcms]);
            relatorio.push({
              numeroLinha: numeroLinha + 1,
              registro: 'C170',
              campo: 'vlBcIcms',
              valorAntigo: campos[IDX_C170.vlBcIcms],
              valorNovo: novoVlBc,
              achadoId: 'edicao-direta'
            });
            campos[IDX_C170.vlBcIcms] = novoVlBc;
            mudou = true;
          }
        }

        // ALIQ_ICMS (posição 14)
        if (item.aliqIcms !== undefined) {
          const origVal = parseFloat((campos[IDX_C170.aliqIcms] || '0').replace(',', '.')) || 0;
          if (Math.abs(origVal - item.aliqIcms) > 0.001) {
            const novaAliq = formatarComoOriginal(item.aliqIcms, campos[IDX_C170.aliqIcms]);
            relatorio.push({
              numeroLinha: numeroLinha + 1,
              registro: 'C170',
              campo: 'aliqIcms',
              valorAntigo: campos[IDX_C170.aliqIcms],
              valorNovo: novaAliq,
              achadoId: 'edicao-direta'
            });
            campos[IDX_C170.aliqIcms] = novaAliq;
            mudou = true;
          }
        }

        // VL_ICMS (posição 15)
        if (item.vlIcms !== undefined) {
          const origVal = parseFloat((campos[IDX_C170.vlIcms] || '0').replace(',', '.')) || 0;
          if (Math.abs(origVal - item.vlIcms) > 0.001) {
            const novoVlIcms = formatarComoOriginal(item.vlIcms, campos[IDX_C170.vlIcms]);
            relatorio.push({
              numeroLinha: numeroLinha + 1,
              registro: 'C170',
              campo: 'vlIcms',
              valorAntigo: campos[IDX_C170.vlIcms],
              valorNovo: novoVlIcms,
              achadoId: 'edicao-direta'
            });
            campos[IDX_C170.vlIcms] = novoVlIcms;
            mudou = true;
          }
        }

        if (mudou) {
          validarContagem(numeroLinha, camposAntes, campos.length, 'Edição de C170');
          linhas[numeroLinha] = campos.join('|');
          docIdsAfetados.add(doc.id);
          totalItensModificados++;
        }
      }
    }

    // 1.5 Inserir novos documentos omitidos (sem linha original) no bloco C
    const novosDocumentos = spedData.documents.filter(d => d.numeroLinhaOriginal === -1 || d.numeroLinhaOriginal === undefined);
    if (novosDocumentos.length > 0) {
      console.log(`[SPED Exporter Verification] Inserindo ${novosDocumentos.length} documento(s) faltantes no TXT exportado...`);

      const novasLinhasBlocoC: string[] = [];

      for (const doc of novosDocumentos) {
        const totMerc = doc.items.reduce((s, i) => s + (i.vlItem || 0), 0);
        const totBc = doc.items.reduce((s, i) => s + (i.vlBcIcms || 0), 0);
        const totIcms = doc.items.reduce((s, i) => s + (i.vlIcms || 0), 0);
        const vlMercStr = formatarComoOriginal(totMerc || doc.vlDoc || 0);
        const vlBcStr = formatarComoOriginal(totBc || doc.vlBcIcms || 0);
        const vlIcmsStr = formatarComoOriginal(totIcms || doc.vlIcms || 0);

        const linC100 = `|C100|${doc.indOper}|0||${doc.codMod || '55'}|00|${doc.serie || '1'}|${doc.numDoc}|${doc.chvNfe}|${doc.dtDoc}||${vlMercStr}||0,00|0,00|${vlMercStr}||0,00|0,00|0,00|${vlBcStr}|${vlIcmsStr}|0,00|0,00|0,00|0,00|0,00|0,00|0,00|`;
        novasLinhasBlocoC.push(linC100);

        relatorio.push({
          numeroLinha: 0,
          registro: 'C100',
          campo: 'insercao-documento',
          valorAntigo: '-',
          valorNovo: `NF ${doc.numDoc} (Chave: ${doc.chvNfe})`,
          achadoId: 'insercao-nota-omissa'
        });

        // C170
        const c190Groups = new Map<string, { cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBc: number; vlIcms: number }>();

        doc.items.forEach((item, idx) => {
          const itemNum = String(item.numItem || idx + 1);
          const vlItemStr = formatarComoOriginal(item.vlItem || 0);
          const itemBcStr = formatarComoOriginal(item.vlBcIcms || 0);
          const itemAliqStr = formatarComoOriginal(item.aliqIcms || 0);
          const itemIcmsStr = formatarComoOriginal(item.vlIcms || 0);

          const linC170 = `|C170|${itemNum}|${item.codItem}|${item.descrItem}|${(item.qtd || 1).toFixed(3).replace('.', ',')}|${item.unid || 'UN'}|${vlItemStr}|||${item.cstIcms}|${item.cfop}||${itemBcStr}|${itemAliqStr}|${itemIcmsStr}|||||||||||||||||||||`;
          novasLinhasBlocoC.push(linC170);

          const key = `${item.cstIcms}_${item.cfop}_${item.aliqIcms}`;
          const g = c190Groups.get(key) || { cstIcms: item.cstIcms, cfop: item.cfop, aliqIcms: item.aliqIcms, vlOpr: 0, vlBc: 0, vlIcms: 0 };
          g.vlOpr += item.vlItem || 0;
          g.vlBc += item.vlBcIcms || 0;
          g.vlIcms += item.vlIcms || 0;
          c190Groups.set(key, g);
        });

        // C190
        c190Groups.forEach(grp => {
          const oprStr = formatarComoOriginal(grp.vlOpr);
          const bcStr = formatarComoOriginal(grp.vlBc);
          const icmsStr = formatarComoOriginal(grp.vlIcms);
          const aliqStr = formatarComoOriginal(grp.aliqIcms);

          const linC190 = `|C190|${grp.cstIcms}|${grp.cfop}|${aliqStr}|${oprStr}|${bcStr}|${icmsStr}|0,00|0,00|0,00|0,00||`;
          novasLinhasBlocoC.push(linC190);
        });
      }

      let idxInsertion = linhas.findIndex(l => l.startsWith('|C990|'));
      if (idxInsertion === -1) idxInsertion = linhas.findIndex(l => l.startsWith('|D001|'));
      if (idxInsertion === -1) idxInsertion = linhas.findIndex(l => l.startsWith('|9001|'));
      if (idxInsertion === -1) idxInsertion = linhas.length - 1;

      linhas.splice(idxInsertion, 0, ...novasLinhasBlocoC);
    }

    // 2. Aplicar correções de achados com statusRevisao === 'aprovado'
    for (const achado of achadosAprovados) {
      if (achado.statusRevisao !== 'aprovado' || !achado.correcaoSugerida?.length) continue;

      const doc = spedData.documents.find(d => d.id === achado.docId);
      const item = doc?.items.find(i => i.numItem === achado.numItem);
      if (!doc || !item) continue;

      const numeroLinha = item.numeroLinhaOriginal;
      if (numeroLinha === undefined || numeroLinha < 0 || !linhas[numeroLinha]) continue;

      const campos = linhas[numeroLinha].split('|');
      const camposAntes = campos.length;

      for (const correcao of achado.correcaoSugerida) {
        const indice = (IDX_C170 as any)[correcao.campo];
        if (indice === undefined) continue;

        const valorAntigo = campos[indice];
        const valorNovo = typeof correcao.valorSugerido === 'number'
          ? formatarComoOriginal(correcao.valorSugerido, valorAntigo)
          : String(correcao.valorSugerido);
        campos[indice] = valorNovo;
        relatorio.push({ numeroLinha: numeroLinha + 1, registro: 'C170', campo: correcao.campo, valorAntigo, valorNovo, achadoId: achado.id });
      }

      validarContagem(numeroLinha, camposAntes, campos.length, 'Correção de C170');
      linhas[numeroLinha] = campos.join('|');
      docIdsAfetados.add(doc.id);
    }

    // 3. RECÁLCULO GLOBAL FIDEDIGNO DE C100 E C190 PARA TODOS OS DOCUMENTOS
    // Localizar todas as linhas de C100
    const c100Indexes: number[] = [];
    for (let i = 0; i < linhas.length; i++) {
      if ((linhas[i].split('|')[1] || '').trim() === 'C100') {
        c100Indexes.push(i);
      }
    }

    // Processar de trás para frente (ordem reversa) para que edições na lista não desloquem os C100 anteriores
    for (let idxIndex = c100Indexes.length - 1; idxIndex >= 0; idxIndex--) {
      const c100Index = c100Indexes[idxIndex];
      const nextC100Index = idxIndex + 1 < c100Indexes.length ? c100Indexes[idxIndex + 1] : linhas.length;

      let endDocScopeIndex = nextC100Index;
      for (let k = c100Index + 1; k < nextC100Index; k++) {
        const reg = (linhas[k].split('|')[1] || '').trim();
        if (['C990', 'D001', 'E001', '9001', '1001'].includes(reg)) {
          endDocScopeIndex = k;
          break;
        }
      }

      const c170LineIndexes: number[] = [];
      const existingC190Indexes: number[] = [];

      for (let k = c100Index + 1; k < endDocScopeIndex; k++) {
        const reg = (linhas[k].split('|')[1] || '').trim();
        if (reg === 'C170') {
          c170LineIndexes.push(k);
        } else if (reg === 'C190') {
          existingC190Indexes.push(k);
        }
      }

      // Extrair itens
      const c100IndOper = (linhas[c100Index].split('|')[2] || '').trim();
      const docItems: { cstIcms: string; cfop: string; aliqIcms: number; vlItem: number; vlBcIcms: number; vlIcms: number }[] = [];

      if (c170LineIndexes.length > 0) {
        for (const k of c170LineIndexes) {
          const fields = linhas[k].split('|');
          const vlItem = parseFloat((fields[IDX_C170.vlItem] || '0').replace(',', '.')) || 0;
          const cstIcms = (fields[IDX_C170.cstIcms] || '000').trim().padStart(3, '0');
          let cfop = (fields[IDX_C170.cfop] || '1102').trim().padStart(4, '0');
          const vlBcIcms = parseFloat((fields[IDX_C170.vlBcIcms] || '0').replace(',', '.')) || 0;
          const aliqIcms = parseFloat((fields[IDX_C170.aliqIcms] || '0').replace(',', '.')) || 0;
          const vlIcms = parseFloat((fields[IDX_C170.vlIcms] || '0').replace(',', '.')) || 0;

          const c100Fields = linhas[c100Index].split('|');
          const c100IndOper = c100Fields[2] || '';

          // Garante que se o C100 é de SAÍDA (indOper === '1'), nenhum CFOP de ENTRADA (1.xxx, 2.xxx, 3.xxx) permaneça no C170/C190
          if (c100IndOper === '1' && (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            const newFirstDigit = firstDigit === '1' ? '5' : (firstDigit === '2' ? '6' : '7');
            cfop = newFirstDigit + rest;
            fields[IDX_C170.cfop] = cfop;
            linhas[k] = fields.join('|');
          } else if (c100IndOper === '0' && (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            const newFirstDigit = firstDigit === '5' ? '1' : (firstDigit === '6' ? '2' : '3');
            cfop = newFirstDigit + rest;
            fields[IDX_C170.cfop] = cfop;
            linhas[k] = fields.join('|');
          }

          docItems.push({ cstIcms, cfop, aliqIcms, vlItem, vlBcIcms, vlIcms });
        }
      } else {
        const c100Fields = linhas[c100Index].split('|');
        const serie = c100Fields[7] || '';
        const numDoc = c100Fields[8] || '';
        const chvNfe = c100Fields[9] || '';
        const dtDoc = c100Fields[10] || '';

        // Procurar estritamente o documento correspondente, validando indOper (Entrada vs Saída)
        const docObj = spedData.documents.find(d => {
          if (d.indOper !== c100IndOper) return false;
          if (chvNfe && d.chvNfe && d.chvNfe.trim() === chvNfe.trim()) return true;
          return d.numDoc === numDoc && (!serie || !d.serie || d.serie === serie) && (!dtDoc || !d.dtDoc || d.dtDoc === dtDoc);
        });

        if (docObj && docObj.items.length > 0 && docObj.indOper === c100IndOper) {
          docObj.items.forEach(i => {
            let cfop = (i.cfop || '1102').trim().padStart(4, '0');
            if (c100IndOper === '1' && (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3'))) {
              const firstDigit = cfop.charAt(0);
              const rest = cfop.slice(1);
              const newFirstDigit = firstDigit === '1' ? '5' : (firstDigit === '2' ? '6' : '7');
              cfop = newFirstDigit + rest;
            } else if (c100IndOper === '0' && (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7'))) {
              const firstDigit = cfop.charAt(0);
              const rest = cfop.slice(1);
              const newFirstDigit = firstDigit === '5' ? '1' : (firstDigit === '6' ? '2' : '3');
              cfop = newFirstDigit + rest;
            }
            docItems.push({
              cstIcms: (i.cstIcms || '000').trim().padStart(3, '0'),
              cfop,
              aliqIcms: i.aliqIcms || 0,
              vlItem: i.vlItem || 0,
              vlBcIcms: i.vlBcIcms || 0,
              vlIcms: i.vlIcms || 0
            });
          });
        }
      }

      if (docItems.length > 0) {
        // Recalcular C100 a partir dos C170
        const totalMerc = docItems.reduce((acc, i) => acc + i.vlItem, 0);
        const totalBc = docItems.reduce((acc, i) => acc + i.vlBcIcms, 0);
        const totalIcms = docItems.reduce((acc, i) => acc + i.vlIcms, 0);

        const fieldsC100 = linhas[c100Index].split('|');
        const camposAntes = fieldsC100.length;

        const origVlDoc = parseFloat((fieldsC100[IDX_C100.vlDoc] || '0').replace(',', '.')) || 0;
        const origVlMerc = parseFloat((fieldsC100[IDX_C100.vlMerc] || '0').replace(',', '.')) || 0;
        const diffDocMerc = (origVlDoc > origVlMerc + 0.01) ? (origVlDoc - origVlMerc) : 0;

        const newVlDoc = totalMerc + diffDocMerc;

        fieldsC100[IDX_C100.vlDoc] = formatarComoOriginal(newVlDoc, fieldsC100[IDX_C100.vlDoc]);
        fieldsC100[IDX_C100.vlMerc] = formatarComoOriginal(totalMerc, fieldsC100[IDX_C100.vlMerc]);
        fieldsC100[IDX_C100.vlBcIcms] = formatarComoOriginal(totalBc, fieldsC100[IDX_C100.vlBcIcms]);
        fieldsC100[IDX_C100.vlIcms] = formatarComoOriginal(totalIcms, fieldsC100[IDX_C100.vlIcms]);

        validarContagem(c100Index, camposAntes, fieldsC100.length, 'Recálculo de C100');
        linhas[c100Index] = fieldsC100.join('|');

        // Mapear dados existentes dos C190 para preservar ICMS-ST, IPI, Redução de BC e Observações
        const existingC190Data = new Map<string, { bcSt: string; icmsSt: string; redBc: string; ipi: string; obs: string }>();
        const existingC190ByCstCfop = new Map<string, { bcSt: string; icmsSt: string; redBc: string; ipi: string; obs: string }>();

        for (const k of existingC190Indexes) {
          const fields = linhas[k].split('|');
          const cst = (fields[2] || '').trim();
          let cfop = (fields[3] || '').trim().padStart(4, '0');

          if (c100IndOper === '1' && (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '1' ? '5' : firstDigit === '2' ? '6' : '7') + rest;
          } else if (c100IndOper === '0' && (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '5' ? '1' : firstDigit === '6' ? '2' : '3') + rest;
          }

          const aliq = formatarComoOriginal(parseFloat((fields[4] || '0').replace(',', '.')) || 0);
          const data = {
            bcSt: fields[8] || '0,00',
            icmsSt: fields[9] || '0,00',
            redBc: fields[10] || '0,00',
            ipi: fields[11] || '0,00',
            obs: fields[12] || ''
          };
          existingC190Data.set(`${cst}_${cfop}_${aliq}`, data);
          if (!existingC190ByCstCfop.has(`${cst}_${cfop}`)) {
            existingC190ByCstCfop.set(`${cst}_${cfop}`, data);
          }
        }

        // Agrupar itens por (CST_ICMS, CFOP, ALIQ_ICMS) para regerar C190
        const c190Map = new Map<string, { cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBc: number; vlIcms: number }>();

        for (const item of docItems) {
          const key = `${item.cstIcms}_${item.cfop}_${item.aliqIcms}`;
          const g = c190Map.get(key) || { cstIcms: item.cstIcms, cfop: item.cfop, aliqIcms: item.aliqIcms, vlOpr: 0, vlBc: 0, vlIcms: 0 };
          g.vlOpr += item.vlItem;
          g.vlBc += item.vlBcIcms;
          g.vlIcms += item.vlIcms;
          c190Map.set(key, g);
        }

        const geradosC190: string[] = [];
        c190Map.forEach(g => {
          const oprStr = formatarComoOriginal(g.vlOpr);
          const bcStr = formatarComoOriginal(g.vlBc);
          const icmsStr = formatarComoOriginal(g.vlIcms);
          const aliqStr = formatarComoOriginal(g.aliqIcms);

          const keyFull = `${g.cstIcms}_${g.cfop}_${aliqStr}`;
          const keyShort = `${g.cstIcms}_${g.cfop}`;
          const existing = existingC190Data.get(keyFull) || existingC190ByCstCfop.get(keyShort);
          const bcSt = existing?.bcSt || '0,00';
          const icmsSt = existing?.icmsSt || '0,00';
          const redBc = existing?.redBc || '0,00';
          const ipi = existing?.ipi || '0,00';
          const obs = existing?.obs || '';

          geradosC190.push(`|C190|${g.cstIcms}|${g.cfop}|${aliqStr}|${oprStr}|${bcStr}|${icmsStr}|${bcSt}|${icmsSt}|${redBc}|${ipi}|${obs}|`);
        });

        // Substituir ou Inserir linhas C190
        if (existingC190Indexes.length > 0) {
          const startIdx = existingC190Indexes[0];
          const deleteCount = existingC190Indexes.length;
          linhas.splice(startIdx, deleteCount, ...geradosC190);
        } else {
          const insertIdx = c170LineIndexes.length > 0 ? c170LineIndexes[c170LineIndexes.length - 1] + 1 : c100Index + 1;
          linhas.splice(insertIdx, 0, ...geradosC190);
        }
      } else if (existingC190Indexes.length > 0) {
        // C100 sem C170: recalcular totais a partir do C190 e CONSOLIDAR eventuais duplicidades de C190
        const c100IndOper = (linhas[c100Index].split('|')[2] || '').trim();
        const c190Consolidated = new Map<string, {
          cst: string;
          cfop: string;
          aliqNum: number;
          aliqStr: string;
          vlOpr: number;
          vlBc: number;
          vlIcms: number;
          bcSt: string;
          icmsSt: string;
          redBc: string;
          ipi: string;
          obs: string;
        }>();

        for (const k of existingC190Indexes) {
          const fields = linhas[k].split('|');
          const cst = (fields[2] || '').trim().padStart(3, '0');
          let cfop = (fields[3] || '').trim().padStart(4, '0');

          if (c100IndOper === '1' && (cfop.startsWith('1') || cfop.startsWith('2') || cfop.startsWith('3'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '1' ? '5' : firstDigit === '2' ? '6' : '7') + rest;
          } else if (c100IndOper === '0' && (cfop.startsWith('5') || cfop.startsWith('6') || cfop.startsWith('7'))) {
            const firstDigit = cfop.charAt(0);
            const rest = cfop.slice(1);
            cfop = (firstDigit === '5' ? '1' : firstDigit === '6' ? '2' : '3') + rest;
          }

          const aliqNum = parseFloat((fields[4] || '0').replace(',', '.')) || 0;
          const aliqStr = formatarComoOriginal(aliqNum, fields[4]);
          const key = `${cst}_${cfop}_${aliqNum.toFixed(2)}`;

          const vlOpr = parseFloat((fields[IDX_C190.vlOpr] || '0').replace(',', '.')) || 0;
          const vlBc = parseFloat((fields[IDX_C190.vlBcIcms] || '0').replace(',', '.')) || 0;
          const vlIcms = parseFloat((fields[IDX_C190.vlIcms] || '0').replace(',', '.')) || 0;

          if (!c190Consolidated.has(key)) {
            c190Consolidated.set(key, {
              cst,
              cfop,
              aliqNum,
              aliqStr,
              vlOpr,
              vlBc,
              vlIcms,
              bcSt: fields[8] || '0,00',
              icmsSt: fields[9] || '0,00',
              redBc: fields[10] || '0,00',
              ipi: fields[11] || '0,00',
              obs: fields[12] || ''
            });
          } else {
            const existing = c190Consolidated.get(key)!;
            existing.vlOpr = Math.round((existing.vlOpr + vlOpr) * 100) / 100;
            existing.vlBc = Math.round((existing.vlBc + vlBc) * 100) / 100;
            existing.vlIcms = Math.round((existing.vlIcms + vlIcms) * 100) / 100;
          }
        }

        const geradosC190: string[] = [];
        let totOpr = 0;
        let totBc = 0;
        let totIcms = 0;

        c190Consolidated.forEach(g => {
          totOpr += g.vlOpr;
          totBc += g.vlBc;
          totIcms += g.vlIcms;

          const oprStr = formatarComoOriginal(g.vlOpr);
          const bcStr = formatarComoOriginal(g.vlBc);
          const icmsStr = formatarComoOriginal(g.vlIcms);

          geradosC190.push(`|C190|${g.cst}|${g.cfop}|${g.aliqStr}|${oprStr}|${bcStr}|${icmsStr}|${g.bcSt}|${g.icmsSt}|${g.redBc}|${g.ipi}|${g.obs}|`);
        });

        // Substituir linhas C190 no array de linhas pelas consolidadas (sem duplicidades)
        const startIdx = existingC190Indexes[0];
        const deleteCount = existingC190Indexes.length;
        linhas.splice(startIdx, deleteCount, ...geradosC190);

        const fieldsC100 = linhas[c100Index].split('|');
        const camposAntes = fieldsC100.length;

        fieldsC100[IDX_C100.vlDoc] = formatarComoOriginal(totOpr, fieldsC100[IDX_C100.vlDoc]);
        fieldsC100[IDX_C100.vlMerc] = formatarComoOriginal(totOpr, fieldsC100[IDX_C100.vlMerc]);
        fieldsC100[IDX_C100.vlBcIcms] = formatarComoOriginal(totBc, fieldsC100[IDX_C100.vlBcIcms]);
        fieldsC100[IDX_C100.vlIcms] = formatarComoOriginal(totIcms, fieldsC100[IDX_C100.vlIcms]);

        validarContagem(c100Index, camposAntes, fieldsC100.length, 'Recálculo de C100');
        linhas[c100Index] = fieldsC100.join('|');
      }
    }
  } catch (e) {
    console.error('[SPED Exporter Verification] Erro ao exportar:', e);
    return { textoCorrigido: '', relatorio: [], erros: [(e as Error).message] };
  }

  // 4. Recalcular totalizadores de controle de blocos (0990, C990, D990, E990, G990, H990, K990, 1990)
  const blocos = ['0', 'B', 'C', 'D', 'E', 'G', 'H', 'K', '1'];
  for (const b of blocos) {
    const regTotalizador = `${b}990`;
    const idxTotalizador = linhas.findIndex(l => (l.split('|')[1] || '').trim() === regTotalizador);
    if (idxTotalizador >= 0) {
      let count = 0;
      for (const line of linhas) {
        const reg = (line.split('|')[1] || '').trim();
        if (reg.startsWith(b)) {
          count++;
        }
      }
      linhas[idxTotalizador] = `|${regTotalizador}|${count}|`;
    }
  }

  // 5. Reconstrução e recálculo total do Bloco 9 (9001, 9900, 9990, 9999)
  let idxBlock9Start = linhas.findIndex(l => {
    const r = (l.split('|')[1] || '').trim();
    return r === '9001' || r === '9900' || r === '9990' || r === '9999';
  });

  const line9001 = (idxBlock9Start >= 0 && (linhas[idxBlock9Start].split('|')[1] || '').trim() === '9001')
    ? linhas[idxBlock9Start]
    : '|9001|0|';

  const nonBlock9Lines = (idxBlock9Start >= 0 ? linhas.slice(0, idxBlock9Start) : [...linhas])
    .filter(l => l.trim().length > 0);

  const regCounts = new Map<string, number>();

  // Contar registros fora do Bloco 9
  for (const line of nonBlock9Lines) {
    const reg = (line.split('|')[1] || '').trim();
    if (reg) {
      regCounts.set(reg, (regCounts.get(reg) || 0) + 1);
    }
  }

  // Contar o próprio 9001
  const reg9001 = (line9001.split('|')[1] || '').trim() || '9001';
  regCounts.set(reg9001, (regCounts.get(reg9001) || 0) + 1);

  // Mapear todos os registros únicos que devem constar no 9900
  const allRegsSet = new Set<string>(regCounts.keys());
  allRegsSet.add('9900');
  allRegsSet.add('9990');
  allRegsSet.add('9999');

  const sortedRegs = Array.from(allRegsSet).sort();

  const count9900 = sortedRegs.length;
  regCounts.set('9900', count9900);
  regCounts.set('9990', 1);
  regCounts.set('9999', 1);

  const newBlock9Lines: string[] = [];
  newBlock9Lines.push(line9001);

  for (const reg of sortedRegs) {
    const qtd = regCounts.get(reg) || 0;
    newBlock9Lines.push(`|9900|${reg}|${qtd}|`);
  }

  // 9990 - Qtd de linhas do Bloco 9 (incluindo 9001, todos os 9900, o próprio 9990 e o 9999)
  const totalBlock9Lines = newBlock9Lines.length + 2;
  newBlock9Lines.push(`|9990|${totalBlock9Lines}|`);

  // 9999 - Total de linhas do arquivo (linhas fora do bloco 9 + linhas do bloco 9 + linha 9999)
  const totalFileLines = nonBlock9Lines.length + newBlock9Lines.length + 1;
  newBlock9Lines.push(`|9999|${totalFileLines}|`);

  linhas = [...nonBlock9Lines, ...newBlock9Lines];

  return { textoCorrigido: linhas.join('\r\n') + '\r\n', relatorio, erros: [] };
}
