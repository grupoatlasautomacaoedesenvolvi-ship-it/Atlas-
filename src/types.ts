export interface SpedHeader {
  cnpj: string;
  nome: string;
  uf: string;
  dtIni: string;
  dtFin: string;
}

export interface SpedItem {
  docId: string;
  numItem: string;
  codItem: string;
  descrItem: string;
  ncm: string;
  cfop: string;
  cstIcms: string;
  qtd: number;
  unid: string;
  vlItem: number;
  vlBcIcms: number;
  aliqIcms: number;
  vlIcms: number;
  malformed?: boolean;
  malformedReason?: string;
  numeroLinhaOriginal: number;
  correctedByRobot?: boolean;
  robotCorrectionReason?: string;
  analystConfirmed?: boolean;
  isModified?: boolean;
}

export interface SpedDocument {
  id: string;
  indOper: string;
  numDoc: string;
  serie: string;
  chvNfe: string;
  dtDoc: string;
  vlDoc: number;
  vlBcIcms?: number;
  vlIcms?: number;
  emitenteOrDest: string;
  cnpjEmit: string;
  chaveValida: boolean;
  codSit: string;
  codMod: string;
  items: SpedItem[];
  numeroLinhaOriginal: number;
}

export interface SpedC190Reconciliation {
  docId: string;
  cstIcms: string;
  cfop: string;
  somaItens: number;
  vlOprC190: number;
  status: 'CONCILIADO' | 'DIVERGENTE' | 'C190_AUSENTE';
  diff: number;
  numeroLinhaOriginal: number;
}

export interface SpedApuracao {
  vlTotDebitos: number;
  vlAjDebitos: number;
  vlTotAjDebitos: number;
  vlEstornosCred: number;
  vlTotCreditos: number;
  vlAjCreditos: number;
  vlTotAjCreditos: number;
  vlEstornosDeb: number;
  vlSldCredorAnt: number;
  vlSldApurado: number;
  vlTotDed: number;
  vlIcmsRecolher: number;
  vlSldCredorTransportar: number;
  debEsp: number;
}

export interface Sped0200Item {
  codItem: string;
  descrItem: string;
  codBarra?: string;
  unid: string;
  tipoItem?: string;
  ncm: string;
  aliqIcms?: number;
  cest?: string;
  cstIcmsPadrao?: string;
  numeroLinhaOriginal?: number;
}

export interface SpedH020Item {
  cstIcms: string;
  vlBcIcms: number;
  vlIcms: number;
  numeroLinhaOriginal?: number;
}

export interface SpedH010Item {
  codItem: string;
  unid: string;
  qtd: number;
  vlUnit: number;
  vlItem: number;
  indProp: string; // '0', '1', '2'
  codPart?: string;
  txtCompl?: string;
  codCta?: string;
  vlItemIr?: number;
  h020?: SpedH020Item;
  h020List?: SpedH020Item[];
  numeroLinhaOriginal?: number;
}

export interface SpedBlocoH {
  dtInv: string; // DDMMYYYY
  vlInv: number;
  motInv: string; // '01', '02', '03', '04', '05'
  items: SpedH010Item[];
  numeroLinhaOriginalH005?: number;
}

export interface SpedData {
  header: SpedHeader;
  documents: SpedDocument[];
  reconciliation: SpedC190Reconciliation[];
  apuracao: SpedApuracao | null;
  rawLines?: { reg: string; content: string }[];
  c190Raw?: { docId: string; cstIcms: string; cfop: string; aliqIcms: number; vlOpr: number; vlBcIcms: number; vlIcms: number }[];
  items0200?: Sped0200Item[];
  blocoH?: SpedBlocoH;
}

export type XmlCategoria = 'XML_TERCEIROS' | 'XML_PROPRIO' | 'XML_NFCE';

export interface XmlItem {
  nItem: string;
  cProd: string;
  xProd: string;
  ncm: string;
  cfop: string;
  cst: string;
  qtd: number;
  unid: string;
  vProd: number;
  vBc: number;
  pIcms: number;
  vIcms: number;
}

export interface XmlRecord {
  id: string;
  chvNfe: string;
  mod: string;
  tpNF: string;
  nNF: string;
  serie: string;
  dhEmi: string;
  emitCnpj: string;
  emitNome: string;
  destCnpj: string;
  destNome: string;
  vNF: number;
  vProd: number;
  vICMS: number;
  itensCount: number;
  items?: XmlItem[];
  cStat?: string;
  xMotivo?: string;
  tpEvento?: string;
  isCancelada?: boolean;
  isTerceiros?: boolean;
}

export interface StateTaxRule {
  id: string;
  uf: string;
  ncmPrefix: string;
  expectedCst: string;
  expectedCfop: string[];
  descricao: string;
  description?: string;
  expectedAliqIcms?: number;
  mva?: number;
  cest?: string;
}

export interface AuditRuleConfig {
  id: string;
  name: string;
  uf: string;
  ncm: string;
  expectedCfops: string[];
  expectedCsts: string[];
  errorMessage: string;
}

export interface AuditConfig {
  rules: AuditRuleConfig[];
}


export interface AuditFinding {
  id: string;
  ruleCode: string;
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  legalBasis: string;
  numDoc: string;
  serie: string;
  codItem: string;
  descrCompl: string;
  cstIcms: string;
  cfop: string;
}

export type TipoAchado =
  | 'BASE_ICMS_INCONSISTENTE'
  | 'CST_INCOMPATIVEL_NCM'
  | 'CFOP_INCOMPATIVEL'
  | 'CREDITO_USO_CONSUMO_VEDADO'
  | 'CREDITO_ATIVO_IMOBILIZADO_REQUER_HISTORICO'
  | 'CST_SEM_DIREITO_CREDITO'
  | 'DOCUMENTO_CANCELADO_COM_CREDITO'
  | 'DOCUMENTO_CANCELADO_COM_VALOR'
  | 'DOCUMENTO_REGULAR_COM_XML_CANCELADO'
  | 'NOTA_SAIDA_CANCELADA_NAO_ESCRITURADA'
  | 'CHAVE_DUPLICADA'
  | 'NOTA_ENTRADA_NAO_ESCRITURADA'
  | 'NOTA_SAIDA_NAO_ESCRITURADA'
  | 'NOTA_EM_MES_SEM_SPED'
  | 'NOTA_SPED_SEM_XML'
  | 'VALOR_DIVERGENTE_XML_SPED'
  | 'CNPJ_DIVERGENTE_XML_SPED'
  | 'CREDITO_SPED_SEM_DESTAQUE_XML'
  | 'CFOP_REVENDA_INCORRETO_ST'
  | 'QUEBRA_DE_SEQUENCIA'
  | 'CREDITO_SEM_DESTAQUE_XML'
  | 'QUEBRA_SEQUENCIA_SEM_EXPLICACAO'
  | 'QUEBRA_SEQUENCIA_NAO_LANCADA'
  | 'INCONSISTENCIA_SEQUENCIA_SPED_XML'
  | 'APURACAO_MATEMATICA_INCONSISTENTE'
  | 'APURACAO_DEBITO_DIVERGENTE_C190'
  | 'APURACAO_CREDITO_DIVERGENTE_C190'
  | 'CST_CFOP_INCOMPATIVEL';

export type SeveridadeAchado = 'alta' | 'media' | 'baixa';
export type StatusRevisao = 'pendente' | 'aprovado' | 'rejeitado';

export interface CampoCorrecao {
  campo: string;
  valorDeclarado: string | number;
  valorSugerido: string | number;
  origemSugestao: string;
}

export interface RascunhoLancamento {
  origemXmlId: string;
  camposPreenchidos: Record<string, string | number>;
  camposRequerAjusteManual: string[];
  observacao: string;
}

export interface Achado {
  id: string;
  tipo: TipoAchado;
  severidade: SeveridadeAchado;
  titulo: string;
  descricao: string;
  baseLegal?: string;
  docId: string;
  numDoc: string;
  serie: string;
  numItem?: string;
  codItem?: string;
  descrItem?: string;
  ncm?: string;
  dtDoc?: string;
  correcaoSugerida?: CampoCorrecao[];
  rascunhoLancamento?: RascunhoLancamento;
  statusRevisao: StatusRevisao;
  revisadoEm?: string;
}

export interface PeriodoAcumulado {
  id: string;              // "AAAA-MM"
  ano: number;
  mes: number;
  temSped: boolean;
  spedData: SpedData | null;
  xmlTerceiros: XmlRecord[];
}

export interface DecisaoNotaOmissa {
  chvNfe: string;
  decisao: 'lancada_retroativo' | 'ignorada_justificada' | 'pendente';
  justificativa?: string;
  decididoEm: string;
}

export type NotificationType = 'system' | 'edit' | 'import' | 'audit' | 'export' | 'rule';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: NotificationType;
  actionUrl?: string;
  author?: string;
}

export type RegimeTributario = 'Lucro Real' | 'Lucro Presumido' | 'Simples Nacional' | 'MEI';

export interface Cliente {
  id: string;
  nome: string; // Razão Social / Nome
  cnpj: string; // CNPJ formatado ou apenas dígitos
  uf: string;
  ie?: string; // Inscrição Estadual
  regimeTributario: RegimeTributario;
  email?: string;
  telefone?: string;
  observacoes?: string;
  tags?: string[];
  escritorioId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PastaCliente {
  id: string;
  clienteId: string;
  nome: string; // Ex: "Exercício 2024", "SPEDs e XMLs 2025", "Janeiro/2025"
  descricao?: string;
  parentId?: string | null;
  cor?: string; // Ex: 'blue', 'emerald', 'amber', 'purple', 'indigo', 'rose'
  createdAt: string;
}

export interface ArquivoCliente {
  id: string;
  clienteId: string;
  pastaId?: string;
  nome: string;
  tipo: 'SPED' | 'XML_ZIP' | 'AUDITORIA_SALVA' | 'RELATORIO_PDF' | 'OUTRO';
  periodo?: string; // Ex: "01/2025"
  tamanhoBytes?: number;
  qtdDocumentos?: number;
  criadoPor?: string;
  dataUpload: string;
  dadosSped?: SpedData;
  xmlsTerceiros?: XmlRecord[];
  xmlsProprios?: XmlRecord[];
  xmlsNfce?: XmlRecord[];
  observacoes?: string;
}

export interface LearnedTaxRule {
  id: string;
  uf: string;
  ncmPrefix: string;
  learnedCst: string;
  learnedCfop: string[];
  learnedAliqIcms?: number;
  descricao: string;
  descricaoProduto?: string;
  confiancaPercentual: number;
  amostrasAnalisadas: number;
  clienteOrigem?: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  criadoEm: string;
}

export interface RoboExecutionLog {
  id: string;
  timestamp: string;
  clienteNome?: string;
  arquivoNome?: string;
  tipoAcao: 'PROCESSAMENTO' | 'VALIDACAO_MATRIZ' | 'INCONSISTENCIA' | 'APRENDIZADO' | 'ERRO';
  mensagem: string;
  detalhes?: string;
  inconsistenciasCount?: number;
  regrasAprendidasCount?: number;
  // Marca um log gerado por "Simular" (dado de teste fictício) — nunca
  // deve ser confundido com uma auditoria real de cliente.
  isSimulacao?: boolean;
}

export interface C170AgentLogEntry {
  id: string;
  timestamp: string;
  itemNum: string;
  docNum: string;
  descrItem: string;
  agentId: 'agent1' | 'agent2' | 'agent3' | 'system';
  agentName: string;
  status: 'ANALYSING' | 'APPROVED' | 'INCONSISTENT' | 'AUTO_CORRECTED' | 'ERROR';
  message: string;
  details?: {
    originalNcm?: string;
    suggestedNcm?: string;
    originalCst?: string;
    suggestedCst?: string;
    originalCfop?: string;
    suggestedCfop?: string;
    confidenceScore?: number;
    risk?: 'Baixo' | 'Médio' | 'Alto';
  };
}

export interface AgentPerformanceMetrics {
  totalItemsAudited: number;
  totalErrorsFound: number;
  totalAutoCorrections: number;
  accuracyRate: number;
  avgProcessingTimeMs: number;
  errorDistribution: {
    cstIcms: number;
    cfopIncompatible: number;
    ncmInvalid: number;
    pisCofinsDivergent: number;
    stMonofasicoMissed: number;
  };
  agentStats: {
    agent1: { name: string; analyzed: number; alerts: number; corrections: number };
    agent2: { name: string; analyzed: number; alerts: number; corrections: number };
    agent3: { name: string; analyzed: number; alerts: number; corrections: number };
  };
}

export interface AgentFeedbackReport {
  id: string;
  timestamp: string;
  itemKey: string;
  docNum?: string;
  itemNum?: string;
  descrItem: string;
  reportedAgentId: 'agent1' | 'agent2' | 'agent3' | 'all';
  mistakeType: 'Falso Positivo' | 'CST Incorreto' | 'CFOP Incompatível' | 'NCM Invalida' | 'Regra UF Específica' | 'Outro';
  suggestedByAgent: {
    ncm?: string;
    cst?: string;
    cfop?: string;
  };
  userCorrectValue: {
    ncm?: string;
    cst?: string;
    cfop?: string;
  };
  userJustification: string;
  status: 'PENDING_REVIEW' | 'PROMPT_REFINED' | 'RESOLVED';
  uf?: string;
}

export interface RoboConfig {
  ativo: boolean;
  intervaloMinutos: number;
  notificarInconsistencias: boolean;
  validarSpedXmlCruzado: boolean;
}

// ============ Minhas Rotinas ============
// Adaptado do módulo "Minhas Rotinas" do Atlas Workspace, com duas mudanças
// deliberadas em relação ao original: (1) vínculo com empresa/cliente, que
// o original não tinha; (2) persistência real no Firestore por escritório —
// o original só salvava em localStorage, o que fazia a visibilidade
// "Todos"/"Administradores" não compartilhar nada de verdade entre usuários
// reais. "Coordenadores" (papel do Workspace) não existe no modelo de 3
// papéis do Atlas — adaptado para os papéis reais do projeto.

export type RotinaRecorrencia = 'Diária' | 'Semanal' | 'Mensal';
export type RotinaTipo = 'Rotina' | 'Compromisso' | 'Processo Interno' | 'Aviso';
export type RotinaVisibilidade = 'Privado' | 'Todos' | 'Administradores';

export interface RotinaChecklistItem {
  id: string;
  texto: string;
  concluido: boolean;
}

export interface Rotina {
  id: string;
  escritorioId: string;
  userId: string;
  userNome: string;
  creatorRole: 'super_admin' | 'admin_escritorio' | 'colaborador';
  empresaId?: string;
  empresaNome?: string;
  titulo: string;
  descricao: string;
  recorrencia: RotinaRecorrencia;
  prazoInfo: string;
  checklist: RotinaChecklistItem[];
  concluida: boolean;
  tipo: RotinaTipo;
  visibilidade: RotinaVisibilidade;
  criadoEm: string;
  atualizadoEm: string;
}



