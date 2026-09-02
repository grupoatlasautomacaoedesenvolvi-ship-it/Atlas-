import { pgTable, text, timestamp, boolean, integer, numeric, date, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const ncmReferencia = pgTable('ncm_referencia', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  escritorioId: text('escritorio_id').notNull(),
  segmento: text('segmento').notNull(),
  anexo: text('anexo'),
  ncm: text('ncm').notNull(),
  descricaoNcm: text('descricao_ncm'),
  cest: text('cest'),
  cstEsperadoEntrada: text('cst_esperado_entrada').array(),
  cstEsperadoSaida: text('cst_esperado_saida').array(),
  mvaOriginal: numeric('mva_original', { precision: 6, scale: 4 }),
  ufsSignatarias: text('ufs_signatarias').array(),
  vigenciaInicio: date('vigencia_inicio'),
  vigenciaFim: date('vigencia_fim'),
  fonte: text('fonte'),
  aliqIcmsInterna: numeric('aliq_icms_interna', { precision: 6, scale: 4 }),
  criadoEm: timestamp('criado_em').defaultNow(),
}, (table) => {
  return {
    ncmPrefixIdx: index('idx_ncm_referencia_prefix').on(table.escritorioId, table.ncm),
  };
});

export const spedPeriodos = pgTable('sped_periodos', {
  id: text('id').primaryKey(),
  escritorioId: text('escritorio_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  ano: integer('ano').notNull(),
  mes: integer('mes').notNull(),
  temSped: boolean('tem_sped').default(false).notNull(),
  importadoEm: timestamp('importado_em').defaultNow(),
});

export const spedDocumentos = pgTable('sped_documentos', {
  id: text('id').primaryKey(),
  periodoId: text('periodo_id').references(() => spedPeriodos.id, { onDelete: 'cascade' }),
  escritorioId: text('escritorio_id').notNull(),
  numDoc: text('num_doc'),
  serie: text('serie'),
  chvNfe: text('chv_nfe'),
  cnpjEmit: text('cnpj_emit'),
  indOper: text('ind_oper'),
  codSit: text('cod_sit'),
  codMod: text('cod_mod'),
  vlDoc: numeric('vl_doc', { precision: 14, scale: 2 }),
}, (table) => {
  return {
    chvNfeIdx: index('idx_sped_doc_chave').on(table.escritorioId, table.chvNfe),
  };
});

export const decisoesNotasOmissas = pgTable('decisoes_notas_omissas', {
  chvNfe: text('chv_nfe').primaryKey(),
  escritorioId: text('escritorio_id').notNull(),
  decisao: text('decisao').notNull(),
  justificativa: text('justificativa'),
  decididoEm: timestamp('decidido_em').defaultNow(),
});
