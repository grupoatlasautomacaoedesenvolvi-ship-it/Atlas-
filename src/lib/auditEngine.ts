import { SpedData, AuditConfig, Achado, TipoAchado, SeveridadeAchado, StatusRevisao, XmlRecord } from '../types';
import { findMatchingXmlItem, findBestFuzzyXmlItemMatch } from './cfopUtils';

// Casamento entre SPED e XML deve SEMPRE usar a chave de acesso de 44 dígitos,
// nunca número de nota (colide facilmente entre fornecedores diferentes) e
// nunca o ID interno do documento (que é apenas serie-numDoc-data, derivado,
// não a chave real). Normalizar removendo tudo que não é dígito evita que
// diferenças de formatação (espaços, zeros à esquerda) quebrem o casamento.
export function normalizarChave(chave: string | undefined | null): string {
  return (chave || '').replace(/\D/g, '');
}

export function gerarIdAchado(tipo: TipoAchado, docId: string, numItem?: string): string {
  return `${tipo}__${docId}__${numItem || 'doc'}`;
}

function getRevisoesKey(escritorioId?: string): string {
  return escritorioId ? `atlas_revisoes_${escritorioId}` : 'atlas_revisoes';
}

export function salvarStatusRevisao(achadoId: string, status: StatusRevisao, escritorioId?: string): void {
  const key = getRevisoesKey(escritorioId);
  const todos = JSON.parse(localStorage.getItem(key) || '{}');
  todos[achadoId] = { status, revisadoEm: new Date().toISOString() };
  localStorage.setItem(key, JSON.stringify(todos));
}

export function carregarStatusRevisao(achadoId: string, escritorioId?: string): { statusRevisao: StatusRevisao; revisadoEm?: string } {
  const key = getRevisoesKey(escritorioId);
  const todos = JSON.parse(localStorage.getItem(key) || '{}');
  const stored = todos[achadoId];
  if (stored) {
    return {
      statusRevisao: stored.status || stored.statusRevisao || 'pendente',
      revisadoEm: stored.revisadoEm
    };
  }
  return { statusRevisao: 'pendente' };
}

export function executarAuditoriaUnificada(
  spedData: SpedData | null,
  auditConfig: AuditConfig | null,
  xmlTerceiros: XmlRecord[] = [],
  xmlProprio: XmlRecord[] = [],
  xmlNfce: XmlRecord[] = []
): Achado[] {
  if (!spedData) return [];

  const achados: Achado[] = [];
  const companyUf = (spedData.header.uf || 'SP').trim().toUpperCase();

  const xmlTerceirosMap = new Map<string, XmlRecord>();
  xmlTerceiros.forEach(x => {
    const chave = normalizarChave(x.chvNfe);
    if (chave) xmlTerceirosMap.set(chave, x);
    // Nunca indexar por número de nota — números se repetem entre
    // fornecedores diferentes e já causaram falso-negativo comprovado
    // (nota nunca lançada passando despercebida por coincidência de número).
  });

  const xmlSaidasMap = new Map<string, XmlRecord>();
  [...xmlProprio, ...xmlNfce].forEach(x => {
    const chave = normalizarChave(x.chvNfe);
    if (chave) xmlSaidasMap.set(chave, x);
  });

  const spedChaves = new Set<string>();
  const spedNumDocs = new Set<string>();

  const mapSeries = new Map<string, number[]>();

  for (const doc of spedData.documents) {
    if (doc.indOper === '1' && (doc.codMod === '55' || doc.codMod === '65')) {
      const num = parseInt((doc.numDoc || '').replace(/\D/g, ''), 10);
      if (!isNaN(num) && num > 0) {
        const key = `${doc.codMod}_${doc.serie}`;
        if (!mapSeries.has(key)) mapSeries.set(key, []);
        mapSeries.get(key)!.push(num);
      }
    }

    const chaveDoc = normalizarChave(doc.chvNfe);

    if (chaveDoc) {
      if (spedChaves.has(chaveDoc)) {
        const id = gerarIdAchado('CHAVE_DUPLICADA', doc.id);
        achados.push({
          id,
          tipo: 'CHAVE_DUPLICADA',
          severidade: 'alta',
          titulo: 'Chave de Acesso Duplicada',
          descricao: `A chave de acesso ${doc.chvNfe} aparece em mais de um documento C100 do SPED — risco de crédito ou débito duplicado.`,
          baseLegal: 'Princípio da não-cumulatividade do ICMS',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          ...carregarStatusRevisao(id)
        });
      } else {
        spedChaves.add(chaveDoc);
      }
    }
    spedNumDocs.add(`${doc.numDoc}_${doc.serie}`);

    const matchedXmlTerceiros = chaveDoc ? xmlTerceirosMap.get(chaveDoc) : undefined;
    const matchedXmlSaida = chaveDoc ? xmlSaidasMap.get(chaveDoc) : undefined;
    const matchedXml = matchedXmlTerceiros || matchedXmlSaida;

    if (matchedXml) {
      if (matchedXml.isCancelada && (doc.codSit === '00' || doc.codSit === '01')) {
        const id = gerarIdAchado('DOCUMENTO_REGULAR_COM_XML_CANCELADO', doc.id);
        achados.push({
          id,
          tipo: 'DOCUMENTO_REGULAR_COM_XML_CANCELADO',
          severidade: 'alta',
          titulo: 'Documento Regular no SPED com XML Cancelado na SEFAZ',
          descricao: `Documento ${doc.numDoc} está registrado como Regular no SPED (COD_SIT=${doc.codSit}), porém o XML correspondente consta como CANCELADO/DENEGADO na SEFAZ.`,
          baseLegal: 'Guia Prático EFD ICMS/IPI - Escrituração Indevida de Documento Cancelado',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          correcaoSugerida: [{
            campo: 'codSit',
            valorDeclarado: doc.codSit,
            valorSugerido: '02',
            origemSugestao: 'Alterar situação para 02 (Documento Cancelado)'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      if (Math.abs(doc.vlDoc - matchedXml.vNF) > 0.05 && !matchedXml.isCancelada) {
        const id = gerarIdAchado('VALOR_DIVERGENTE_XML_SPED', doc.id);
        achados.push({
          id,
          tipo: 'VALOR_DIVERGENTE_XML_SPED',
          severidade: 'alta',
          titulo: 'Valor Divergente entre SPED e XML',
          descricao: `Valor total do documento no SPED (R$ ${doc.vlDoc.toFixed(2)}) difere do XML (R$ ${matchedXml.vNF.toFixed(2)}).`,
          baseLegal: 'Ajuste de Escrituração Fiscal',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          correcaoSugerida: [{
            campo: 'vlDoc',
            valorDeclarado: doc.vlDoc,
            valorSugerido: matchedXml.vNF,
            origemSugestao: 'Valor Total da Nota (vNF) do XML original correspondente'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      if (doc.cnpjEmit && matchedXml.emitCnpj && doc.cnpjEmit.replace(/\D/g, '') !== matchedXml.emitCnpj.replace(/\D/g, '')) {
        const id = gerarIdAchado('CNPJ_DIVERGENTE_XML_SPED', doc.id);
        achados.push({
          id,
          tipo: 'CNPJ_DIVERGENTE_XML_SPED',
          severidade: 'media',
          titulo: 'CNPJ Divergente entre SPED e XML',
          descricao: `CNPJ emitente no SPED (${doc.cnpjEmit}) difere do XML (${matchedXml.emitCnpj}). Requer investigação.`,
          baseLegal: 'Conferência Cadastral',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          ...carregarStatusRevisao(id)
        });
      }
    } else if (doc.codMod === '55' || doc.codMod === '65') {
      // Document is in SPED, but not in XMLs
      if (doc.indOper === '0') {
        // Missing XML de Terceiros for this inbound invoice
        const id = gerarIdAchado('NOTA_SPED_SEM_XML', doc.id);
        achados.push({
          id,
          tipo: 'NOTA_SPED_SEM_XML',
          severidade: 'media',
          titulo: 'Nota de Entrada no SPED sem XML',
          descricao: `Documento de entrada ${doc.numDoc} (Chave: ${doc.chvNfe || 'N/A'}) consta no SPED mas seu XML não foi importado. Verifique se falta baixar o XML correspondente.`,
          baseLegal: 'Garantia de Acervo Fiscal',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          ...carregarStatusRevisao(id)
        });
      }
    }

    const cancelado = ['02', '03', '04', '05'].includes(doc.codSit);
    if (cancelado) {
      if (doc.vlDoc > 0.01) {
        const id = gerarIdAchado('DOCUMENTO_CANCELADO_COM_VALOR', doc.id);
        achados.push({
          id,
          tipo: 'DOCUMENTO_CANCELADO_COM_VALOR',
          severidade: 'alta',
          titulo: 'Documento Cancelado com Valor Declarado',
          descricao: `Documento ${doc.numDoc} com situação cancelada/denegada (COD_SIT=${doc.codSit}) possui valor total declarado de R$ ${doc.vlDoc.toFixed(2)}. Documentos cancelados devem ter valores zerados.`,
          baseLegal: 'Guia Prático EFD ICMS/IPI - Regra de Validação C100',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          correcaoSugerida: [{
            campo: 'vlDoc',
            valorDeclarado: doc.vlDoc,
            valorSugerido: 0,
            origemSugestao: 'Documento cancelado — valor total deve ser zerado'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      for (const item of doc.items) {
        if (item.vlIcms > 0.01 || item.vlItem > 0.01) {
          const id = gerarIdAchado('DOCUMENTO_CANCELADO_COM_CREDITO', doc.id, item.numItem);
          achados.push({
            id,
            tipo: 'DOCUMENTO_CANCELADO_COM_CREDITO',
            severidade: 'alta',
            titulo: 'Documento Cancelado com Crédito/Valor no Item',
            descricao: `Documento ${doc.numDoc} com situação cancelada/denegada (COD_SIT=${doc.codSit}) ainda registra R$ ${item.vlItem.toFixed(2)} de valor e R$ ${item.vlIcms.toFixed(2)} de ICMS no item.`,
            baseLegal: 'Documento cancelado não gera direito a crédito nem débito',
            docId: doc.id, numDoc: doc.numDoc, serie: doc.serie,
            dtDoc: doc.dtDoc,
            numItem: item.numItem, codItem: item.codItem, descrItem: item.descrItem,
            correcaoSugerida: [{
              campo: 'vlIcms', valorDeclarado: item.vlIcms, valorSugerido: 0,
              origemSugestao: 'Documento cancelado — valores e crédito devem ser zerados'
            }],
            ...carregarStatusRevisao(id)
          });
        }
      }
    }

    for (const [itemIndex, item] of doc.items.entries()) {
      const ncm = (item.ncm || '').trim();
      const cfop = (item.cfop || '').trim();
      const cst = (item.cstIcms || '').trim();
      const itemId = item.numItem || '1';

      const icmsCalculado = Math.round(item.vlBcIcms * (item.aliqIcms / 100) * 100) / 100;
      if (item.vlBcIcms > 0 && Math.abs(icmsCalculado - item.vlIcms) > 0.05) {
        const id = gerarIdAchado('BASE_ICMS_INCONSISTENTE', doc.id, itemId);
        achados.push({
          id,
          tipo: 'BASE_ICMS_INCONSISTENTE',
          severidade: 'alta',
          titulo: 'Base de ICMS Inconsistente',
          descricao: `ICMS declarado R$ ${item.vlIcms.toFixed(2)} não corresponde a Base × Alíquota (R$ ${icmsCalculado.toFixed(2)}).`,
          baseLegal: 'Art. 23 LC 87/96',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          numItem: itemId,
          codItem: item.codItem,
          descrItem: item.descrItem,
          correcaoSugerida: [{
            campo: 'vlIcms',
            valorDeclarado: item.vlIcms,
            valorSugerido: icmsCalculado,
            origemSugestao: 'Cálculo Base de Cálculo × Alíquota (recalculado a partir dos campos do item)'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      const cfopsConsumo = ['1556', '2556', '1407', '2407', '1551', '2551', '1557', '2557'];
      if (cfopsConsumo.includes(cfop) && item.vlIcms > 0) {
        const id = gerarIdAchado('CREDITO_USO_CONSUMO_VEDADO', doc.id, itemId);
        achados.push({
          id,
          tipo: 'CREDITO_USO_CONSUMO_VEDADO',
          severidade: 'alta',
          titulo: 'Crédito de Uso e Consumo Vedado',
          descricao: `Apropriação de crédito de ICMS em operação de uso/consumo ou imobilizado (CFOP ${cfop}) com valor R$ ${item.vlIcms.toFixed(2)}.`,
          baseLegal: 'Art. 33, I, LC 87/96',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          numItem: itemId,
          codItem: item.codItem,
          descrItem: item.descrItem,
          correcaoSugerida: [{
            campo: 'vlIcms',
            valorDeclarado: item.vlIcms,
            valorSugerido: 0,
            origemSugestao: 'Estorno de crédito de ICMS vedado para uso/consumo e outras entradas sem direito a crédito'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      const fuzzyMatchDetails = matchedXml?.items ? findBestFuzzyXmlItemMatch(matchedXml.items, item, itemIndex) : null;
      const matchedXmlItem = fuzzyMatchDetails?.xmlItem || (matchedXml?.items ? findMatchingXmlItem(matchedXml.items, item, itemIndex) : undefined);

      if (fuzzyMatchDetails && fuzzyMatchDetails.isSequenceMismatch) {
        const id = gerarIdAchado('INCONSISTENCIA_SEQUENCIA_SPED_XML', doc.id, itemId);
        achados.push({
          id,
          tipo: 'INCONSISTENCIA_SEQUENCIA_SPED_XML',
          severidade: 'media',
          titulo: 'Desalinhamento de Sequência de Itens (SPED x XML)',
          descricao: `O item no SPED (numItem ${item.numItem}, cProd ${item.codItem || 'N/A'}) foi localizado na posição de item ${fuzzyMatchDetails.xmlNItem} do XML com similaridade de ${fuzzyMatchDetails.score}%. A sequência de escrituração no SPED difere do arquivo XML.`,
          baseLegal: 'Guia Prático EFD ICMS/IPI - Registro C170',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          numItem: itemId,
          codItem: item.codItem,
          descrItem: item.descrItem,
          ...carregarStatusRevisao(id)
        });
      }

      if (matchedXmlItem && item.vlIcms > 0 && (!matchedXmlItem.vIcms || matchedXmlItem.vIcms === 0)) {
        const id = gerarIdAchado('CREDITO_SPED_SEM_DESTAQUE_XML', doc.id, itemId);
        achados.push({
          id,
          tipo: 'CREDITO_SPED_SEM_DESTAQUE_XML',
          severidade: 'alta',
          titulo: 'Crédito no SPED sem Destaque no XML',
          descricao: `Item apropriando R$ ${item.vlIcms.toFixed(2)} de ICMS no SPED, porém o XML original não possui destaque de ICMS para este item.`,
          baseLegal: 'Princípio da não-cumulatividade (exige destaque no documento hábil)',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          numItem: itemId,
          codItem: item.codItem,
          descrItem: item.descrItem,
          correcaoSugerida: [{
            campo: 'vlIcms',
            valorDeclarado: item.vlIcms,
            valorSugerido: 0,
            origemSugestao: 'Zerar crédito, pois XML não possui destaque de ICMS'
          }],
          ...carregarStatusRevisao(id)
        });
      }

      if ((cfop === '1551' || cfop === '2551') && item.vlIcms > 0) {
        const id = gerarIdAchado('CREDITO_ATIVO_IMOBILIZADO_REQUER_HISTORICO', doc.id, itemId);
        achados.push({
          id,
          tipo: 'CREDITO_ATIVO_IMOBILIZADO_REQUER_HISTORICO',
          severidade: 'media',
          titulo: 'Crédito Ativo Imobilizado Requer Histórico (CIAP)',
          descricao: `Apropriação de crédito de ICMS para ativo imobilizado (CFOP ${cfop}) exige controle CIAP e apuração por 1/48 avos.`,
          baseLegal: 'Art. 20 e 33 LC 87/96',
          docId: doc.id,
          numDoc: doc.numDoc,
          serie: doc.serie,
          dtDoc: doc.dtDoc,
          numItem: itemId,
          codItem: item.codItem,
          descrItem: item.descrItem,
          ...carregarStatusRevisao(id)
        });
      }

      // Regra de Correlação de Banco de Dados (CST 060 -> CFOP 1403/5403 | Demais CSTs -> CFOP 1102/5102)
      const cleanCst = (cst || '').replace(/\D/g, '').padStart(3, '0');
      const isEntry = doc.indOper === '0' || cfop.startsWith('1') || cfop.startsWith('2');
      const isInterstate = cfop.startsWith('2') || cfop.startsWith('6');

      if (cleanCst === '060') {
        const allowedStCfops = ['1403', '2403', '5403', '6403'];
        if (!allowedStCfops.includes(cfop)) {
          const sugCfop = isEntry ? (isInterstate ? '2403' : '1403') : (isInterstate ? '6403' : '5403');
          const id = gerarIdAchado('CFOP_INCOMPATIVEL', `${doc.id}_cst060`, itemId);
          achados.push({
            id,
            tipo: 'CFOP_INCOMPATIVEL',
            severidade: 'alta',
            titulo: 'CFOP Incompatível com CST 060 (Substituição Tributária)',
            descricao: `Produto com CST 060 (ST) exige CFOP ${isEntry ? '1403 / 2403' : '5403 / 6403'}. Encontrado CFOP ${cfop}.`,
            baseLegal: 'Regra Banco de Dados: CST 060 x CFOPs 1403 e 5403',
            docId: doc.id,
            numDoc: doc.numDoc,
            serie: doc.serie,
            dtDoc: doc.dtDoc,
            numItem: itemId,
            codItem: item.codItem,
            descrItem: item.descrItem,
            correcaoSugerida: [{
              campo: 'cfop',
              valorDeclarado: cfop,
              valorSugerido: sugCfop,
              origemSugestao: `Regra do Banco de Dados: CST 060 determina CFOP ${sugCfop}`
            }],
            ...carregarStatusRevisao(id)
          });
        }
      } else {
        // Demais CSTs (000, 020, 040, 041, 050, 090, etc.) em operações de revenda/comercialização
        const stCfopsIncorretos = ['1403', '2403', '5403', '6403'];
        if (stCfopsIncorretos.includes(cfop)) {
          const sugCfop = isEntry ? (isInterstate ? '2102' : '1102') : (isInterstate ? '6102' : '5102');
          const id = gerarIdAchado('CFOP_INCOMPATIVEL', `${doc.id}_cstoutros`, itemId);
          achados.push({
            id,
            tipo: 'CFOP_INCOMPATIVEL',
            severidade: 'alta',
            titulo: `CFOP Incompatível com CST ${cleanCst} (Demais CSTs)`,
            descricao: `Produto com CST ${cleanCst} (diferente de 060) não deve usar CFOP de Substituição Tributária (${cfop}). Para demais CSTs o CFOP correto é ${sugCfop}.`,
            baseLegal: 'Regra Banco de Dados: Demais CSTs x CFOPs 1102 e 5102',
            docId: doc.id,
            numDoc: doc.numDoc,
            serie: doc.serie,
            dtDoc: doc.dtDoc,
            numItem: itemId,
            codItem: item.codItem,
            descrItem: item.descrItem,
            correcaoSugerida: [{
              campo: 'cfop',
              valorDeclarado: cfop,
              valorSugerido: sugCfop,
              origemSugestao: `Regra do Banco de Dados: Demais CSTs determinam CFOP ${sugCfop}`
            }],
            ...carregarStatusRevisao(id)
          });
        }
      }

      // Check State Tax Matrix database (fonte configurada pelo usuário — mantido)
      try {
        const stateMatrixSaved = localStorage.getItem('atlas_state_tax_matrix');
        if (stateMatrixSaved) {
          const stateMatrixRules = JSON.parse(stateMatrixSaved);
          for (const smRule of stateMatrixRules) {
            const smUf = (smRule.uf || 'ALL').trim().toUpperCase();
            const smNcm = (smRule.ncmPrefix || '').trim();
            const ncmMatches = !smNcm || ncm.startsWith(smNcm);
            // Determinar a UF de destino da operação
            let ufDestino = companyUf;
            if (doc.indOper === '1' && cfop.startsWith('6')) {
              // Venda interestadual: UF de destino seria a do cliente
              // Como não temos a uf do cliente na extração atual do XML, assumimos 'INTERESTADUAL'
              ufDestino = 'INTERESTADUAL'; 
            }

            const ufMatches = smUf === 'ALL' || smUf === ufDestino || smUf === companyUf;

            if (ncmMatches && ufMatches) {
              const expectedMatrixCst = (smRule.expectedCst || '').trim().padStart(3, '0');
              const currentCleanCst = cst.padStart(3, '0');
              if (expectedMatrixCst && currentCleanCst !== expectedMatrixCst) {
                const id = gerarIdAchado('CST_INCOMPATIVEL_NCM', doc.id, itemId);
                achados.push({
                  id,
                  tipo: 'CST_INCOMPATIVEL_NCM',
                  severidade: 'alta',
                  titulo: `Divergência na Matriz Tributária UF/NCM (${smRule.ncmPrefix})`,
                  descricao: `Item com NCM ${ncm} destinado à UF ${ufDestino === 'INTERESTADUAL' ? 'de fora' : ufDestino} declarado com CST ${cst}, mas a Matriz Tributária determina CST ${smRule.expectedCst} (${smRule.descricao}).`,
                  baseLegal: 'Matriz Tributária Estadual parametrizada',
                  docId: doc.id,
                  numDoc: doc.numDoc,
                  serie: doc.serie,
          dtDoc: doc.dtDoc,
                  numItem: itemId,
                  codItem: item.codItem,
                  descrItem: item.descrItem,
                  correcaoSugerida: [{
                    campo: 'cstIcms',
                    valorDeclarado: cst,
                    valorSugerido: smRule.expectedCst,
                    origemSugestao: `Regra da Matriz Tributária para NCM ${smRule.ncmPrefix}`
                  }],
                  ...carregarStatusRevisao(id)
                });
              }

              // Validação Estrita de CFOP baseada na Matriz (Se houver CFOPs cadastrados na regra)
              const expectedCfopsArray = smRule.expectedCfop && Array.isArray(smRule.expectedCfop) && smRule.expectedCfop.length > 0
                ? smRule.expectedCfop 
                : [];
              
              if (expectedCfopsArray.length > 0 && !expectedCfopsArray.includes(cfop)) {
                // Se a regra define CFOPs e o CFOP atual não está na lista permitida
                const id = gerarIdAchado('CFOP_INCOMPATIVEL', doc.id, itemId);
                achados.push({
                  id,
                  tipo: 'CFOP_INCOMPATIVEL', // reaproveitando a categoria
                  severidade: 'alta',
                  titulo: `CFOP Inválido para o NCM (Matriz Tributária)`,
                  descricao: `Item declarado com CFOP ${cfop}. De acordo com a Matriz Tributária para o NCM ${smRule.ncmPrefix}, os CFOPs permitidos são: ${expectedCfopsArray.join(', ')}.`,
                  baseLegal: 'Matriz Tributária Estadual parametrizada (Lista Restrita de CFOPs)',
                  docId: doc.id,
                  numDoc: doc.numDoc,
                  serie: doc.serie,
          dtDoc: doc.dtDoc,
                  numItem: itemId,
                  codItem: item.codItem,
                  descrItem: item.descrItem,
                  correcaoSugerida: [{
                    campo: 'cfop',
                    valorDeclarado: cfop,
                    valorSugerido: expectedCfopsArray[0],
                    origemSugestao: `Primeiro CFOP sugerido na Matriz Tributária`
                  }],
                  ...carregarStatusRevisao(id)
                });
              } else if (expectedCfopsArray.length === 0 && doc.indOper === '0' && ['1', '2'].includes(cfop.charAt(0))) {
                // Validação de CFOP de Revenda Dinâmica (fallback caso não haja lista estrita na matriz)
                const isCfopRevenda = ['1102', '2102', '1403', '2403'].includes(cfop);
                if (isCfopRevenda) {
                  const prefix = cfop.charAt(0); // 1 = interno, 2 = interestadual
                  const isStNoXml = matchedXmlItem?.cst ? ['10', '30', '60', '70'].includes(matchedXmlItem.cst.slice(-2)) : false;
                  const isStNaMatriz = ['10', '30', '60', '70'].includes(expectedMatrixCst.slice(-2));
                  
                  // Se for ST na Matriz ou ST no XML original, o CFOP correto é 1403/2403
                  const shouldBeSt = isStNaMatriz || isStNoXml;
                  const expectedCfopRevenda = shouldBeSt ? `${prefix}403` : `${prefix}102`;
                  
                  if (cfop !== expectedCfopRevenda) {
                    const id = gerarIdAchado('CFOP_REVENDA_INCORRETO_ST', doc.id, itemId);
                    achados.push({
                      id,
                      tipo: 'CFOP_REVENDA_INCORRETO_ST',
                      severidade: 'alta',
                      titulo: 'CFOP de Revenda Incorreto (Normal vs ST)',
                      descricao: `Item declarado com CFOP ${cfop}. Como o XML indica CST ${matchedXmlItem?.cst || 'N/A'} e a Matriz Tributária prevê CST ${expectedMatrixCst}, o CFOP adequado para revenda é ${expectedCfopRevenda}.`,
                      baseLegal: 'Adequação CFOP Normal vs Substituição Tributária',
                      docId: doc.id,
                      numDoc: doc.numDoc,
                      serie: doc.serie,
          dtDoc: doc.dtDoc,
                      numItem: itemId,
                      codItem: item.codItem,
                      descrItem: item.descrItem,
                      correcaoSugerida: [{
                        campo: 'cfop',
                        valorDeclarado: cfop,
                        valorSugerido: expectedCfopRevenda,
                        origemSugestao: `Regra de Revenda: XML/Matriz indica operação ${shouldBeSt ? 'com ST' : 'Normal'}`
                      }],
                      ...carregarStatusRevisao(id)
                    });
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('Error checking state tax matrix', e);
      }


      if (auditConfig?.rules) {
        for (const rule of auditConfig.rules) {
          const ruleNcm = (rule.ncm || '').trim();
          const ncmMatch = ruleNcm ? ncm.startsWith(ruleNcm) : false;
          const ruleUf = (rule.uf || 'ALL').trim().toUpperCase();
          const ufMatch = ruleUf === 'ALL' || ruleUf === companyUf;

          if (ncmMatch && ufMatch) {
            const isCfopInvalid = rule.expectedCfops.length > 0 && !rule.expectedCfops.includes(cfop);
            const isCstInvalid = rule.expectedCsts.length > 0 && !rule.expectedCsts.includes(cst);

            if (isCfopInvalid) {
              const sugCfop = rule.expectedCfops[0];
              const id = gerarIdAchado('CFOP_INCOMPATIVEL', doc.id, itemId);
              achados.push({
                id,
                tipo: 'CFOP_INCOMPATIVEL',
                severidade: 'alta',
                titulo: `CFOP Incompatível com NCM (${rule.name})`,
                descricao: `CFOP ${cfop} não permitido para NCM ${ncm} conforme regra ${rule.name}.`,
                baseLegal: rule.errorMessage,
                docId: doc.id,
                numDoc: doc.numDoc,
                serie: doc.serie,
          dtDoc: doc.dtDoc,
                numItem: itemId,
                codItem: item.codItem,
                descrItem: item.descrItem,
                correcaoSugerida: [{
                  campo: 'cfop',
                  valorDeclarado: cfop,
                  valorSugerido: sugCfop,
                  origemSugestao: `Primeiro CFOP esperado na regra configurada (${sugCfop})`
                }],
                ...carregarStatusRevisao(id)
              });
            }

            if (isCstInvalid) {
              const sugCst = rule.expectedCsts[0];
              const id = gerarIdAchado('CST_INCOMPATIVEL_NCM', doc.id, itemId);
              achados.push({
                id,
                tipo: 'CST_INCOMPATIVEL_NCM',
                severidade: 'alta',
                titulo: `CST Incompatível com NCM (${rule.name})`,
                descricao: `CST ${cst} não permitido para NCM ${ncm} conforme regra ${rule.name}.`,
                baseLegal: rule.errorMessage,
                docId: doc.id,
                numDoc: doc.numDoc,
                serie: doc.serie,
          dtDoc: doc.dtDoc,
                numItem: itemId,
                codItem: item.codItem,
                descrItem: item.descrItem,
                correcaoSugerida: [{
                  campo: 'cstIcms',
                  valorDeclarado: cst,
                  valorSugerido: sugCst,
                  origemSugestao: `Primeiro CST esperado na regra configurada (${sugCst})`
                }],
                ...carregarStatusRevisao(id)
              });
            }
          }
        }
      }
    }
  }

  xmlTerceiros.forEach(xml => {
    if (xml.isCancelada) return; // Terceiros cancelado não deve ser escriturado no SPED
    const chaveXml = normalizarChave(xml.chvNfe);
    if (!chaveXml) return; // sem chave válida, não dá para afirmar nada com segurança
    const foundInSped = spedData.documents.some(d => normalizarChave(d.chvNfe) === chaveXml);
    if (!foundInSped) {
      const id = gerarIdAchado('NOTA_ENTRADA_NAO_ESCRITURADA', xml.id);
      achados.push({
        id,
        tipo: 'NOTA_ENTRADA_NAO_ESCRITURADA',
        severidade: 'alta',
        titulo: 'Nota de Entrada não Escriturada no SPED',
        descricao: `XML de Terceiros (NF-e ${xml.nNF}, Emitente: ${xml.emitNome || xml.emitCnpj}, Valor R$ ${xml.vNF.toFixed(2)}) encontrado mas ausente no SPED Fiscal.`,
        baseLegal: 'Omissão de Escrituração de Documento Fiscal',
        docId: xml.id,
        numDoc: xml.nNF,
        serie: xml.serie,
        rascunhoLancamento: {
          origemXmlId: xml.id,
          camposPreenchidos: {
            numDoc: xml.nNF,
            serie: xml.serie,
            chvNfe: xml.chvNfe,
            dtDoc: xml.dhEmi,
            vlDoc: xml.vNF,
            cnpjEmit: xml.emitCnpj,
            emitNome: xml.emitNome
          },
          camposRequerAjusteManual: ['cfop', 'cstIcms', 'vlBcIcms', 'vlIcms'],
          observacao: `Fornecedor emitiu NF-e ${xml.nNF} — ajuste o CFOP/CST de entrada conforme a natureza real da operação. Rascunho montado a partir dos dados objetivos do XML.`
        },
        ...carregarStatusRevisao(id)
      });
    }
  });

  [...xmlProprio, ...xmlNfce].forEach(xml => {
    const chaveXml = normalizarChave(xml.chvNfe);
    if (!chaveXml) return;
    const foundInSped = spedData.documents.some(d => normalizarChave(d.chvNfe) === chaveXml);
    if (!foundInSped) {
      if (xml.isCancelada) {
        const id = gerarIdAchado('NOTA_SAIDA_CANCELADA_NAO_ESCRITURADA', xml.id);
        achados.push({
          id,
          tipo: 'NOTA_SAIDA_CANCELADA_NAO_ESCRITURADA',
          severidade: 'alta',
          titulo: 'Nota de Saída Cancelada Ausente no SPED',
          descricao: `XML Próprio/NFC-e Cancelado (NF-e ${xml.nNF}) não foi escriturado no SPED. Documentos de emissão própria cancelados devem constar no SPED Fiscal obrigatoriamente com COD_SIT = 02.`,
          baseLegal: 'Guia Prático EFD ICMS/IPI - Registro C100 COD_SIT 02',
          docId: xml.id,
          numDoc: xml.nNF,
          serie: xml.serie,
          rascunhoLancamento: {
            origemXmlId: xml.id,
            camposPreenchidos: {
              numDoc: xml.nNF,
              serie: xml.serie,
              chvNfe: xml.chvNfe,
              dtDoc: xml.dhEmi,
              vlDoc: 0,
              cnpjDest: xml.destCnpj,
              destNome: xml.destNome
            },
            camposRequerAjusteManual: [],
            observacao: `Inserir documento cancelado (COD_SIT 02) para manter a sequência numérica da EFD.`
          },
          ...carregarStatusRevisao(id)
        });
      } else {
        const id = gerarIdAchado('NOTA_SAIDA_NAO_ESCRITURADA', xml.id);
        achados.push({
          id,
          tipo: 'NOTA_SAIDA_NAO_ESCRITURADA',
          severidade: 'alta',
          titulo: 'Nota de Saída não Escriturada no SPED',
          descricao: `XML Próprio/NFC-e (NF-e ${xml.nNF}, Valor R$ ${xml.vNF.toFixed(2)}) emitido mas ausente no SPED Fiscal.`,
          baseLegal: 'Omissão de Saída / Faturamento',
          docId: xml.id,
          numDoc: xml.nNF,
          serie: xml.serie,
          rascunhoLancamento: {
            origemXmlId: xml.id,
            camposPreenchidos: {
              numDoc: xml.nNF,
              serie: xml.serie,
              chvNfe: xml.chvNfe,
              dtDoc: xml.dhEmi,
              vlDoc: xml.vNF,
              cnpjDest: xml.destCnpj,
              destNome: xml.destNome
            },
            camposRequerAjusteManual: ['cfop', 'cstIcms', 'vlBcIcms', 'vlIcms'],
            observacao: `Nota fiscal de saída ${xml.nNF} não localizada no SPED Fiscal — rascunho gerado a partir do XML original.`
          },
          ...carregarStatusRevisao(id)
        });
      }
    }
  });

  if (spedData.apuracao) {
    achados.push(...validarMatematicaApuracao(spedData.apuracao));
    achados.push(...compararApuracaoComLancamentos(spedData));
  }

  for (const [key, rawNums] of mapSeries.entries()) {
    if (rawNums.length === 0) continue;
    const nums = Array.from(new Set(rawNums)).sort((a, b) => a - b);
    let expected = nums[0];
    const missing: number[] = [];
    
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] > expected) {
        for (let j = expected; j < nums[i]; j++) {
          missing.push(j);
        }
        expected = nums[i] + 1;
      } else if (nums[i] === expected) {
        expected++;
      }
    }

    if (missing.length > 0) {
      const intervals = [];
      let start = missing[0];
      let end = missing[0];
      for (let i = 1; i < missing.length; i++) {
        if (missing[i] === end + 1) {
          end = missing[i];
        } else {
          intervals.push(start === end ? `${start}` : `${start} a ${end}`);
          start = missing[i];
          end = missing[i];
        }
      }
      intervals.push(start === end ? `${start}` : `${start} a ${end}`);

      const [mod, serie] = key.split('_');
      const id = gerarIdAchado('QUEBRA_DE_SEQUENCIA', `mod_${mod}_ser_${serie}`);
      achados.push({
        id,
        tipo: 'QUEBRA_DE_SEQUENCIA',
        severidade: 'alta',
        titulo: `Quebra de Sequência de Numeração (Saídas Mod ${mod})`,
        descricao: `Furos detectados na sequência numérica para a Série ${serie}. Notas faltando: ${intervals.join(', ')}.`,
        baseLegal: 'Omissão de Documento Fiscal / Quebra de Numeração (Ajuste SINIEF)',
        docId: `mod_${mod}_ser_${serie}`,
        numDoc: '-',
        serie,
        ...carregarStatusRevisao(id)
      });
    }
  }

  return achados;
}

function validarMatematicaApuracao(apuracao: any): Achado[] {
  const achados: Achado[] = [];

  const expressao =
    apuracao.vlTotDebitos + apuracao.vlAjDebitos + apuracao.vlTotAjDebitos + apuracao.vlEstornosCred
    - (apuracao.vlTotCreditos + apuracao.vlAjCreditos + apuracao.vlTotAjCreditos + apuracao.vlEstornosDeb + apuracao.vlSldCredorAnt);

  if (expressao >= 0) {
    const consistente = Math.abs(expressao - apuracao.vlSldApurado) < 0.05
      && Math.abs(apuracao.vlSldCredorTransportar) < 0.05;
    if (!consistente) {
      const id = 'APURACAO_MATEMATICA_INCONSISTENTE';
      achados.push({
        id,
        tipo: 'APURACAO_MATEMATICA_INCONSISTENTE',
        severidade: 'alta',
        titulo: 'Saldo apurado (E110) não bate com a fórmula oficial',
        descricao: `Esperado (débitos + ajustes - créditos - ajustes - saldo anterior) = R$ ${expressao.toFixed(2)} em VL_SLD_APURADO, mas o arquivo declara R$ ${apuracao.vlSldApurado.toFixed(2)}.`,
        docId: 'apuracao', numDoc: '-', serie: '-',
        correcaoSugerida: [{
          campo: 'vlSldApurado', valorDeclarado: apuracao.vlSldApurado,
          valorSugerido: Math.round(expressao * 100) / 100,
          origemSugestao: 'Fórmula oficial do Guia Prático EFD-ICMS/IPI (Registro E110, Campo 11)'
        }],
        ...carregarStatusRevisao(id)
      });
    }
  } else {
    const consistente = Math.abs(apuracao.vlSldApurado) < 0.05
      && Math.abs(Math.abs(expressao) - apuracao.vlSldCredorTransportar) < 0.05;
    if (!consistente) {
      const id = 'APURACAO_MATEMATICA_INCONSISTENTE';
      achados.push({
        id,
        tipo: 'APURACAO_MATEMATICA_INCONSISTENTE',
        severidade: 'alta',
        titulo: 'Saldo credor a transportar (E110) não bate com a fórmula oficial',
        descricao: `Esperado R$ ${Math.abs(expressao).toFixed(2)} em VL_SLD_CREDOR_TRANSPORTAR, mas o arquivo declara R$ ${apuracao.vlSldCredorTransportar.toFixed(2)}.`,
        docId: 'apuracao', numDoc: '-', serie: '-',
        correcaoSugerida: [{
          campo: 'vlSldCredorTransportar', valorDeclarado: apuracao.vlSldCredorTransportar,
          valorSugerido: Math.round(Math.abs(expressao) * 100) / 100,
          origemSugestao: 'Fórmula oficial do Guia Prático EFD-ICMS/IPI (Registro E110, Campo 14)'
        }],
        ...carregarStatusRevisao(id)
      });
    }
  }

  return achados;
}

function compararApuracaoComLancamentos(spedData: SpedData): Achado[] {
  if (!spedData.apuracao) return [];

  let somaDebitos = 0;   // saídas
  let somaCreditos = 0;  // entradas

  for (const rec of spedData.reconciliation) {
    const doc = spedData.documents.find(d => d.id === rec.docId);
    if (!doc) continue;
    if (doc.indOper === '1') {
      somaDebitos += rec.vlOprC190;
    } else {
      somaCreditos += rec.vlOprC190;
    }
  }

  const achados: Achado[] = [];
  const AVISO_ESCOPO = 'Esta comparação usa apenas os registros C190 (NF-e/NFC-e). ' +
    'Não inclui C320/C390/C490/C590 (combustíveis, energia, comunicação, transporte) — ' +
    'se a empresa tiver esse tipo de documento, uma divergência aqui pode ser esperada, não necessariamente um erro.';

  if (Math.abs(spedData.apuracao.vlTotDebitos - somaDebitos) > 0.05) {
    const id = 'APURACAO_DEBITO_DIVERGENTE_C190';
    achados.push({
      id,
      tipo: 'APURACAO_DEBITO_DIVERGENTE_C190',
      severidade: 'media',
      titulo: 'VL_TOT_DEBITOS não bate com a soma dos C190 de saída',
      descricao: `Declarado: R$ ${spedData.apuracao.vlTotDebitos.toFixed(2)}. Soma dos C190 de saída: R$ ${somaDebitos.toFixed(2)}. ${AVISO_ESCOPO}`,
      docId: 'apuracao', numDoc: '-', serie: '-',
      ...carregarStatusRevisao(id)
    });
  }

  if (Math.abs(spedData.apuracao.vlTotCreditos - somaCreditos) > 0.05) {
    const id = 'APURACAO_CREDITO_DIVERGENTE_C190';
    achados.push({
      id,
      tipo: 'APURACAO_CREDITO_DIVERGENTE_C190',
      severidade: 'media',
      titulo: 'VL_TOT_CREDITOS não bate com a soma dos C190 de entrada',
      descricao: `Declarado: R$ ${spedData.apuracao.vlTotCreditos.toFixed(2)}. Soma dos C190 de entrada: R$ ${somaCreditos.toFixed(2)}. ${AVISO_ESCOPO}`,
      docId: 'apuracao', numDoc: '-', serie: '-',
      ...carregarStatusRevisao(id)
    });
  }

  return achados;
}
