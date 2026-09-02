import React, { useState, useMemo } from 'react';
import { SpedData, StateTaxRule } from '../types';
import { FiscalTooltip } from './FiscalTooltip';
import {
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Layers,
  FileCode,
  Tag,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Database,
  Building2,
  Scale,
  ArrowRight,
  RefreshCw,
  MapPin,
  Percent,
  DollarSign,
  Globe,
  FileText
} from 'lucide-react';

interface NcmLookupViewProps {
  spedData: SpedData | null;
  stateTaxRules?: StateTaxRule[];
}

export interface NcmRecord {
  ncm: string;
  descricao: string;
  capitulo: string;
  capituloDescricao: string;
  posicao: string;
  aliqIpi: string;
  pisCofinsRegime: 'MONOFASICO' | 'ALIQUOTA_ZERO' | 'INCIDENCIA_CUMULATIVA' | 'TRIBUTADO_NORMAL';
  stAplicavel: boolean;
  cest?: string;
  cbenefDefault?: string;
  observacaoFiscal?: string;
}

export const BRAZIL_UFS = [
  { code: 'AC', name: 'Acre' },
  { code: 'AL', name: 'Alagoas' },
  { code: 'AM', name: 'Amazonas' },
  { code: 'AP', name: 'Amapá' },
  { code: 'BA', name: 'Bahia' },
  { code: 'CE', name: 'Ceará' },
  { code: 'DF', name: 'Distrito Federal' },
  { code: 'ES', name: 'Espírito Santo' },
  { code: 'GO', name: 'Goiás' },
  { code: 'MA', name: 'Maranhão' },
  { code: 'MG', name: 'Minas Gerais' },
  { code: 'MS', name: 'Mato Grosso do Sul' },
  { code: 'MT', name: 'Mato Grosso' },
  { code: 'PA', name: 'Pará' },
  { code: 'PB', name: 'Paraíba' },
  { code: 'PE', name: 'Pernambuco' },
  { code: 'PI', name: 'Piauí' },
  { code: 'PR', name: 'Paraná' },
  { code: 'RJ', name: 'Rio de Janeiro' },
  { code: 'RN', name: 'Rio Grande do Norte' },
  { code: 'RO', name: 'Rondônia' },
  { code: 'RR', name: 'Roraima' },
  { code: 'RS', name: 'Rio Grande do Sul' },
  { code: 'SC', name: 'Santa Catarina' },
  { code: 'SE', name: 'Sergipe' },
  { code: 'SP', name: 'São Paulo' },
  { code: 'TO', name: 'Tocantins' }
];

export function calcUfTaxDetails(uf: string, record: NcmRecord, customRules: StateTaxRule[] = []) {
  const cleanNcm = record.ncm.replace(/\D/g, '');
  const cap = record.capitulo;

  // Base Modal & FCP by UF
  let baseModal = 18;
  let fcpRate = 0;

  switch (uf) {
    case 'RJ': baseModal = 20; fcpRate = 2; break;
    case 'MA': baseModal = 22; fcpRate = 2; break;
    case 'PI': baseModal = 21; fcpRate = 2; break;
    case 'BA': case 'PE': case 'PB': case 'RN': case 'TO': case 'AM': case 'DF': case 'CE': case 'RR':
      baseModal = 20; fcpRate = ['RJ', 'BA', 'PE', 'MA', 'AL', 'SE', 'PB', 'PI'].includes(uf) ? 2 : 0; break;
    case 'GO': case 'PA': case 'AL': case 'SE': case 'AC':
      baseModal = 19; fcpRate = ['AL', 'SE'].includes(uf) ? 2 : 0; break;
    case 'PR': baseModal = 19.5; fcpRate = 2; break;
    case 'MG': case 'SP': case 'AP':
      baseModal = 18; fcpRate = 0; break;
    case 'RS': case 'SC': case 'ES': case 'MT': case 'MS': case 'RO':
      baseModal = 17; fcpRate = 0; break;
    default: baseModal = 18; fcpRate = 0; break;
  }

  // Category specific adjustments
  let icmsAliq = baseModal;
  let specificFcp = fcpRate;

  if (cap === '22') {
    // Bebidas / Cervejas
    icmsAliq = ['RJ', 'MG', 'BA', 'PE', 'GO', 'PR'].includes(uf) ? 27 : ['SP', 'RS', 'SC'].includes(uf) ? 25 : 26;
    specificFcp = 2;
  } else if (cap === '33') {
    // Perfumaria / Cosméticos
    icmsAliq = 25;
    specificFcp = ['RJ', 'MG', 'BA', 'PE', 'AL', 'SE', 'MA'].includes(uf) ? 2 : 0;
  } else if (cap === '19') {
    // Panificação / Massas
    icmsAliq = ['SP', 'MG', 'PR', 'RS', 'SC', 'RJ'].includes(uf) ? 7 : 12;
    specificFcp = 0;
  } else if (cap === '84' || cap === '85') {
    // Informática
    icmsAliq = ['SP', 'PR', 'SC', 'MG', 'RJ'].includes(uf) ? 12 : baseModal;
    specificFcp = 0;
  } else if (cap === '30') {
    // Medicamentos
    icmsAliq = ['SP', 'RJ', 'MG', 'PR', 'RS'].includes(uf) ? 12 : baseModal;
    specificFcp = 0;
  }

  const effectiveIcms = icmsAliq + specificFcp;

  // ST Enquadramento & MVA
  const isSt = record.stAplicavel;
  let mva = 0;
  if (isSt) {
    if (cap === '22') mva = ['PR', 'RS', 'SC'].includes(uf) ? 82 : 70;
    else if (cap === '33') mva = 60;
    else if (cap === '40') mva = 45;
    else if (cap === '19') mva = 40;
    else mva = 50;
  }

  // Formula MVA Ajustada (para entrada com aliq. interestadual de 12%)
  const aliqInterestadual = 12;
  const mvaAjustada = isSt
    ? Math.max(0, (((1 + mva / 100) * (1 - aliqInterestadual / 100)) / (1 - effectiveIcms / 100) - 1) * 100)
    : 0;

  // Recommended CST & CFOP
  let cstSugerido = isSt ? '060' : cap === '19' ? '020' : '000';
  let cfopEntrada = isSt ? '1.403' : '1.102';
  let cfopSaida = isSt ? '5.405' : '5.102';

  // cBenef Requirement
  const cbenefExigidoUf = ['PR', 'RS', 'SC', 'SP', 'RJ', 'GO', 'DF'].includes(uf);
  let cbenefSugerido = record.cbenefDefault || '';
  if (!cbenefSugerido) {
    if (uf === 'SP') cbenefSugerido = isSt ? 'SP800001' : 'SP000001';
    else if (uf === 'PR') cbenefSugerido = 'PR810001';
    else if (uf === 'RS') cbenefSugerido = 'RS000001';
    else if (uf === 'SC') cbenefSugerido = 'SC800000';
    else if (uf === 'RJ') cbenefSugerido = 'RJ800001';
    else if (uf === 'MG') cbenefSugerido = 'MG000001';
    else if (uf === 'GO') cbenefSugerido = 'GO800001';
    else cbenefSugerido = `${uf}000001`;
  }

  // Legal Reference
  const ricmsRefs: Record<string, string> = {
    SP: 'Regulamento do ICMS/SP (Decreto nº 45.490/2000)',
    RJ: 'Regulamento do ICMS/RJ (Decreto nº 27.427/2000)',
    MG: 'Regulamento do ICMS/MG (Decreto nº 48.589/2023)',
    PR: 'Regulamento do ICMS/PR (Decreto nº 7.871/2017)',
    RS: 'Regulamento do ICMS/RS (Decreto nº 37.699/1997)',
    SC: 'Regulamento do ICMS/SC (Decreto nº 2.870/2001)',
    BA: 'Regulamento do ICMS/BA (Decreto nº 13.780/2012)',
    PE: 'Regulamento do ICMS/PE (Decreto nº 44.650/2017)',
    CE: 'Regulamento do ICMS/CE (Decreto nº 33.327/2019)',
    GO: 'Código Tributário Estadual GO (RCTE-GO)',
    DF: 'Regulamento do ICMS/DF (Decreto nº 18.955/1997)'
  };
  const ricms = ricmsRefs[uf] || `Regulamento do ICMS do Estado de ${uf}`;

  // Custom Matriz Rule Match
  const matchingRule = customRules.find((r) => {
    const rUf = (r.uf || '').trim().toUpperCase();
    const rPrefix = (r.ncmPrefix || '').replace(/\D/g, '');
    return (rUf === uf || rUf === 'ALL') && cleanNcm.startsWith(rPrefix);
  });

  if (matchingRule) {
    if (matchingRule.expectedCst) cstSugerido = matchingRule.expectedCst;
    if (matchingRule.expectedCfop && matchingRule.expectedCfop.length > 0) {
      cfopSaida = matchingRule.expectedCfop[0];
    }
    if (matchingRule.expectedAliqIcms !== undefined) {
      icmsAliq = matchingRule.expectedAliqIcms;
    }
    if (matchingRule.mva !== undefined) {
      mva = matchingRule.mva;
    }
  }

  return {
    uf,
    ufName: BRAZIL_UFS.find((u) => u.code === uf)?.name || uf,
    baseModal,
    fcpRate: specificFcp,
    icmsAliq,
    effectiveIcms: icmsAliq + specificFcp,
    isSt,
    mva,
    mvaAjustada,
    cstSugerido,
    cfopEntrada,
    cfopSaida,
    cbenefExigidoUf,
    cbenefSugerido,
    ricms,
    matchingRule
  };
}

// Built-in comprehensive NCM Reference Database
const INITIAL_NCM_DATABASE: NcmRecord[] = [
  {
    ncm: '2203.00.00',
    descricao: 'Cervejas de malte',
    capitulo: '22',
    capituloDescricao: 'Bebidas, líquidos alcoólicos e vinagres',
    posicao: '2203',
    aliqIpi: '6%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '03.001.00',
    cbenefDefault: 'PR810001',
    observacaoFiscal: 'Sujeito à Substituição Tributária (ST) na maioria das UFs e ao regime Monofásico de PIS/COFINS (Lei 13.097/2015).'
  },
  {
    ncm: '2202.10.00',
    descricao: 'Águas, incluindo as águas minerais e as águas gaseificadas, adicionadas de açúcar ou de outros edulcorantes ou aromatizadas',
    capitulo: '22',
    capituloDescricao: 'Bebidas, líquidos alcoólicos e vinagres',
    posicao: '2202',
    aliqIpi: '4%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '03.003.00',
    observacaoFiscal: 'Refrigerantes e energéticos. PIS/COFINS monofásico. Verificar pauta fiscal de ST conforme protocolo do estado de destino.'
  },
  {
    ncm: '8471.30.12',
    descricao: 'Máquinas automáticas para processamento de dados, portáteis, de peso não superior a 10 kg, contendo pelo menos uma unidade central de processamento, um teclado e uma tela (Notebooks)',
    capitulo: '84',
    capituloDescricao: 'Reatores nucleares, caldeiras, máquinas, aparelhos e instrumentos mecânicos',
    posicao: '8471',
    aliqIpi: '15%',
    pisCofinsRegime: 'TRIBUTADO_NORMAL',
    stAplicavel: false,
    cbenefDefault: 'SP000012',
    observacaoFiscal: 'Equipamento de informática. Pode usufruir de incentivos de PPB (Lei do Bem) ou reduções de alíquota de ICMS conforme legislação estadual.'
  },
  {
    ncm: '3004.90.99',
    descricao: 'Outros medicamentos compostos por produtos misturados ou não misturados, preparados para fins terapêuticos ou profiláticos, apresentados em doses ou acondicionados para venda a retalho',
    capitulo: '30',
    capituloDescricao: 'Produtos farmacêuticos',
    posicao: '3004',
    aliqIpi: '0%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '13.001.00',
    observacaoFiscal: 'Medicamentos da lista positiva/negativa. PIS/COFINS com alíquota zero ou tributação monofásica dependendo da regulamentação da ANVISA.'
  },
  {
    ncm: '3304.99.90',
    descricao: 'Outros produtos de perfumaria ou de toucador e preparações cosméticas',
    capitulo: '33',
    capituloDescricao: 'Óleos essenciais e resinoides; produtos de perfumaria ou de toucador e preparações cosméticas',
    posicao: '3304',
    aliqIpi: '22%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '20.015.00',
    observacaoFiscal: 'Cosméticos e higiene pessoal. Incidência elevada de IPI e forte presença de ICMS-ST e Antecipação Tributária.'
  },
  {
    ncm: '1905.90.90',
    descricao: 'Outros produtos de padaria, pastelaria ou da indústria de bolachas e biscoitos',
    capitulo: '19',
    capituloDescricao: 'Preparações à base de cereais, farinhas, amidos e leite; produtos de confeitaria',
    posicao: '1905',
    aliqIpi: '0%',
    pisCofinsRegime: 'ALIQUOTA_ZERO',
    stAplicavel: true,
    cest: '17.054.00',
    observacaoFiscal: 'Produtos alimentícios. PIS/COFINS Alíquota Zero em itens da cesta básica (Lei 10.925/2004).'
  },
  {
    ncm: '2710.19.21',
    descricao: 'Óleos lubrificantes sem aditivos',
    capitulo: '27',
    capituloDescricao: 'Combustíveis minerais, óleos minerais e produtos da sua destilação; matérias betuminosas; ceras minerais',
    posicao: '2710',
    aliqIpi: '0%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '06.001.00',
    observacaoFiscal: 'Derivados de petróleo. CST ICMS 060 / CFOP 5403/1403. PIS/COFINS concentrado na fonte.'
  },
  {
    ncm: '4011.10.00',
    descricao: 'Pneumáticos novos, de borracha, do tipo utilizado em automóveis de passageiros (incluindo os veículos de uso misto e os automóveis de corrida)',
    capitulo: '40',
    capituloDescricao: 'Borracha e suas obras',
    posicao: '4011',
    aliqIpi: '15%',
    pisCofinsRegime: 'MONOFASICO',
    stAplicavel: true,
    cest: '16.001.00',
    observacaoFiscal: 'Autopeças/Pneumáticos. PIS/COFINS Monofásico (Lei 10.485/2002) e ICMS-ST amplo entre Estados.'
  },
  {
    ncm: '8528.52.00',
    descricao: 'Outros monitores capazes de serem conectados diretamente a uma máquina automática para processamento de dados da posição 84.71 e concebidos para serem utilizados com esta',
    capitulo: '85',
    capituloDescricao: 'Máquinas, aparelhos e materiais elétricos, e suas partes; aparelhos de gravação ou de reprodução de som ou imagem',
    posicao: '8528',
    aliqIpi: '10%',
    pisCofinsRegime: 'TRIBUTADO_NORMAL',
    stAplicavel: false,
    observacaoFiscal: 'Monitores de vídeo para informática. Verificar enquadramento na PPB de informática.'
  },
  {
    ncm: '3926.90.90',
    descricao: 'Outras obras de plásticos e obras de outras matérias das posições 39.01 a 39.14',
    capitulo: '39',
    capituloDescricao: 'Plásticos e suas obras',
    posicao: '3926',
    aliqIpi: '10%',
    pisCofinsRegime: 'TRIBUTADO_NORMAL',
    stAplicavel: false,
    observacaoFiscal: 'NCM genérica para artigos plásticos diversos. Requer atenção pois muitos fiscais questionam uso de NCMs genéricas (terminadas em 90.90).'
  }
];

export function NcmLookupView({ spedData, stateTaxRules = [] }: NcmLookupViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [regimeFilter, setRegimeFilter] = useState<string>('ALL');
  const [stOnly, setStOnly] = useState<boolean>(false);
  const [selectedNcmCode, setSelectedNcmCode] = useState<string | null>('2203.00.00');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Selected State (UF) for Tax Breakdown Consultation
  const [selectedUf, setSelectedUf] = useState<string>(() => {
    const headerUf = spedData?.header?.uf?.trim().toUpperCase();
    return headerUf && BRAZIL_UFS.some(u => u.code === headerUf) ? headerUf : 'SP';
  });

  // Diagnostic Sandbox State
  const [testNcmInput, setTestNcmInput] = useState('');

  // Extract all unique NCMs used in the imported SPED file for cross-audit
  const spedNcmMap = useMemo(() => {
    if (!spedData || !spedData.documents) return new Map<string, { count: number; totalValor: number; items: any[] }>();

    const map = new Map<string, { count: number; totalValor: number; items: any[] }>();

    spedData.documents.forEach((doc) => {
      doc.items.forEach((item) => {
        if (!item.ncm) return;
        const cleanNcm = item.ncm.replace(/\D/g, '');
        const existing = map.get(cleanNcm) || { count: 0, totalValor: 0, items: [] };
        existing.count += 1;
        existing.totalValor += item.vlItem || 0;
        if (existing.items.length < 5) {
          existing.items.push(item);
        }
        map.set(cleanNcm, existing);
      });
    });

    return map;
  }, [spedData]);

  // Combine static DB with any NCM found in the active SPED file that is missing from static DB
  const combinedNcmList = useMemo(() => {
    const list = [...INITIAL_NCM_DATABASE];
    const existingCodes = new Set(list.map((r) => r.ncm.replace(/\D/g, '')));

    spedNcmMap.forEach((val, cleanCode) => {
      if (!existingCodes.has(cleanCode) && cleanCode.length >= 4) {
        const sampleItem = val.items[0];
        const formattedCode =
          cleanCode.length === 8
            ? `${cleanCode.substring(0, 4)}.${cleanCode.substring(4, 6)}.${cleanCode.substring(6, 8)}`
            : cleanCode;

        list.push({
          ncm: formattedCode,
          descricao: sampleItem ? `Item do SPED: ${sampleItem.descrItem}` : `NCM ${formattedCode} (Identificado no Arquivo)`,
          capitulo: cleanCode.substring(0, 2),
          capituloDescricao: `Capítulo ${cleanCode.substring(0, 2)} - Extraído do SPED`,
          posicao: cleanCode.substring(0, 4),
          aliqIpi: 'Sob Consulta',
          pisCofinsRegime: 'TRIBUTADO_NORMAL',
          stAplicavel: false,
          observacaoFiscal: 'NCM extraído dos itens das notas fiscais do arquivo SPED EFD ICMS/IPI importado.'
        });
      }
    });

    return list;
  }, [spedNcmMap]);

  // Filtered Results
  const filteredNcms = useMemo(() => {
    return combinedNcmList.filter((item) => {
      const term = searchTerm.toLowerCase().trim();
      const cleanCode = item.ncm.replace(/\D/g, '');
      const matchesSearch =
        !term ||
        item.ncm.toLowerCase().includes(term) ||
        cleanCode.includes(term.replace(/\D/g, '')) ||
        item.descricao.toLowerCase().includes(term) ||
        item.capituloDescricao.toLowerCase().includes(term) ||
        (item.cest && item.cest.includes(term));

      if (!matchesSearch) return false;

      if (selectedCategory !== 'ALL' && item.capitulo !== selectedCategory) return false;
      if (regimeFilter !== 'ALL' && item.pisCofinsRegime !== regimeFilter) return false;
      if (stOnly && !item.stAplicavel) return false;

      return true;
    });
  }, [combinedNcmList, searchTerm, selectedCategory, regimeFilter, stOnly]);

  // Active Selected NCM Record
  const activeNcmRecord = useMemo(() => {
    if (!selectedNcmCode) return filteredNcms[0] || combinedNcmList[0];
    return (
      combinedNcmList.find((r) => r.ncm === selectedNcmCode || r.ncm.replace(/\D/g, '') === selectedNcmCode.replace(/\D/g, '')) ||
      filteredNcms[0] ||
      combinedNcmList[0]
    );
  }, [selectedNcmCode, combinedNcmList, filteredNcms]);

  // Computed Tax details for active NCM in the selected UF
  const activeUfTaxDetails = useMemo(() => {
    if (!activeNcmRecord) return null;
    return calcUfTaxDetails(selectedUf, activeNcmRecord, stateTaxRules);
  }, [selectedUf, activeNcmRecord, stateTaxRules]);

  // SPED stats for the selected NCM
  const activeNcmSpedStats = useMemo(() => {
    if (!activeNcmRecord) return null;
    const cleanCode = activeNcmRecord.ncm.replace(/\D/g, '');
    return spedNcmMap.get(cleanCode) || null;
  }, [activeNcmRecord, spedNcmMap]);

  // Diagnostic Test Calculation
  const testDiagnostic = useMemo(() => {
    if (!testNcmInput.trim()) return null;

    const clean = testNcmInput.replace(/\D/g, '');
    const is8Digits = clean.length === 8;
    const cap = clean.substring(0, 2);
    const pos = clean.substring(0, 4);

    const foundMatch = combinedNcmList.find((r) => r.ncm.replace(/\D/g, '') === clean);

    let status: 'VALID' | 'WARNING' | 'INVALID' = 'VALID';
    let message = 'Estrutura NCM válida de 8 dígitos.';

    if (!is8Digits) {
      status = 'INVALID';
      message = `NCM incompleta (${clean.length} dígitos de 8 requeridos). O padrão oficial requer 8 números no formato XXXX.XX.XX.`;
    } else if (['99', '00'].includes(cap)) {
      status = 'WARNING';
      message = 'Atenção: Capítulo genérico ou reservado. Pode ser objeto de questionamento pelo PVA ou FISCO.';
    }

    return {
      clean,
      formatted: is8Digits ? `${clean.substring(0, 4)}.${clean.substring(4, 6)}.${clean.substring(6, 8)}` : clean,
      status,
      message,
      capitulo: cap,
      posicao: pos,
      foundMatch
    };
  }, [testNcmInput, combinedNcmList]);

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedText(txt);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const isSpedUfMatched = spedData?.header?.uf && spedData.header.uf.trim().toUpperCase() === selectedUf;

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-lg text-white shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold">
              <Search className="w-4 h-4 text-emerald-400" />
              <span>Diagnóstico & Regras Tributárias por NCM</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Consulta e Diagnóstico Fiscal de NCM
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Pesquise códigos NCM, selecione o Estado (UF) para verificar alíquotas internas de ICMS, FCP, Margem de ST (MVA), regras de PIS/COFINS e cruzamento automático com o SPED EFD ICMS/IPI.
            </p>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700 text-xs space-y-1.5 min-w-[220px]">
            <span className="text-slate-300 font-semibold block">Estatísticas do SPED:</span>
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">NCMs Diferentes:</span>
              <span className="font-bold text-white">{spedNcmMap.size}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-slate-400">Base da Tabela:</span>
              <span className="font-bold text-emerald-300">{combinedNcmList.length} códigos</span>
            </div>
            {spedData?.header?.uf && (
              <div className="pt-1 border-t border-white/10 flex justify-between font-mono text-[11px]">
                <span className="text-emerald-300">UF do SPED:</span>
                <span className="font-bold text-emerald-400">{spedData.header.uf}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* State Selector Bar - Prominent UF Selection */}
      <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#1e3a5f] text-white flex items-center justify-center font-bold shadow-sm shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <label htmlFor="select-uf-main" className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Estado de Consulta Tributária (UF)
                </label>
                <FiscalTooltip
                  title="Seleção de Estado para Tributação de ICMS"
                  description="Selecione o Estado (UF) de destino ou onde a empresa está localizada. A alíquota modal de ICMS, o Adicional de FCP, a margem MVA de Substituição Tributária e a exigência do cBenef mudam conforme a legislação da UF selecionada."
                  lawRef="Lei Complementar nº 87/1996 & Regulamentos do ICMS das UFs"
                  badge="ICMS por UF"
                />
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Selecione o estado para calcular alíquotas internas de ICMS, FCP e MVA de ST do produto
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <select
              id="select-uf-main"
              value={selectedUf}
              onChange={(e) => setSelectedUf(e.target.value)}
              className="bg-white border-2 border-[#1e3a5f] text-[#1e3a5f] font-extrabold text-sm rounded-lg px-4 py-2.5 shadow-sm focus:ring-2 focus:ring-[#1e3a5f] focus:outline-hidden cursor-pointer"
            >
              {BRAZIL_UFS.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} — {u.name}
                </option>
              ))}
            </select>

            {isSpedUfMatched ? (
              <span className="hidden sm:inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mr-1" />
                <span>UF do SPED ({selectedUf})</span>
              </span>
            ) : spedData?.header?.uf ? (
              <button
                onClick={() => setSelectedUf(spedData.header.uf.trim().toUpperCase())}
                className="text-xs bg-[#f1efe8] hover:bg-[#e5e2d9] text-[#1e3a5f] font-bold px-3 py-2 rounded-lg transition flex items-center space-x-1"
                title={`Mudar para UF do SPED: ${spedData.header.uf}`}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1 text-[#1e3a5f]" />
                <span>Usar UF do SPED ({spedData.header.uf})</span>
              </button>
            ) : null}
          </div>

        </div>

        {/* Quick UF Chips for High-Volume States */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-200/60 text-xs">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Atalhos de UF:</span>
          {['SP', 'RJ', 'MG', 'PR', 'RS', 'BA', 'PE', 'SC', 'GO', 'DF'].map((ufCode) => {
            const isSel = selectedUf === ufCode;
            return (
              <button
                key={ufCode}
                onClick={() => setSelectedUf(ufCode)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                  isSel
                    ? 'bg-[#1e3a5f] text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                {ufCode}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Search & Filters Left / Detailed NCM Inspector Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Search & List (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Search Controls Card */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            
            {/* Main Search Input */}
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por Código NCM (ex: 2203.00.00), Palavra-chave (ex: Cerveja, Notebook), CEST..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-900 focus:ring-2 focus:ring-[#1e3a5f] focus:border-[#1e3a5f] transition"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              
              {/* Regime Filter Dropdown */}
              <select
                value={regimeFilter}
                onChange={(e) => setRegimeFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="ALL">Todos os Regimes PIS/COFINS</option>
                <option value="MONOFASICO">Monofásico / Concentrado</option>
                <option value="ALIQUOTA_ZERO">Alíquota Zero (Cesta Básica)</option>
                <option value="TRIBUTADO_NORMAL">Tributação Normal</option>
              </select>

              {/* Category Chapter Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-[#1e3a5f]"
              >
                <option value="ALL">Todos os Capítulos</option>
                <option value="22">Cap. 22 — Bebidas & Vinagres</option>
                <option value="30">Cap. 30 — Farmacêuticos</option>
                <option value="33">Cap. 33 — Perfumaria & Cosméticos</option>
                <option value="84">Cap. 84 — Máquinas & Informática</option>
                <option value="27">Cap. 27 — Combustíveis & Óleos</option>
                <option value="19">Cap. 19 — Cereais & Panificação</option>
                <option value="40">Cap. 40 — Borracha & Pneumáticos</option>
              </select>

              {/* ST Toggle */}
              <label className="inline-flex items-center space-x-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={stOnly}
                  onChange={(e) => setStOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#1e3a5f] focus:ring-[#1e3a5f]"
                />
                <span>Apenas com ICMS-ST (CEST)</span>
              </label>

            </div>

          </div>

          {/* Results List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
              <span>Resultados NCM ({filteredNcms.length})</span>
              <span>Alíquota no Estado ({selectedUf})</span>
            </div>

            <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100">
              {filteredNcms.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <Info className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="font-semibold text-slate-700 text-sm">Nenhuma NCM encontrada para os filtros aplicados.</p>
                  <p className="text-xs text-slate-500">
                    Tente buscar por termos genéricos como "cerveja", "arroz" ou digite o código de 4 dígitos (ex: 8471).
                  </p>
                </div>
              ) : (
                filteredNcms.map((item) => {
                  const isSelected = activeNcmRecord?.ncm === item.ncm;
                  const cleanCode = item.ncm.replace(/\D/g, '');
                  const inSpedCount = spedNcmMap.get(cleanCode)?.count || 0;
                  const itemUfDetails = calcUfTaxDetails(selectedUf, item, stateTaxRules);

                  return (
                    <div
                      key={item.ncm}
                      onClick={() => setSelectedNcmCode(item.ncm)}
                      className={`p-4 transition cursor-pointer flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#f1efe8] border-l-4 border-[#1e3a5f]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="space-y-1 pr-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-sm font-black text-[#1e3a5f] bg-[#e5e2d9]/60 px-2 py-0.5 rounded">
                            {item.ncm}
                          </span>

                          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                            UF {selectedUf}: {itemUfDetails.effectiveIcms}% ICMS
                          </span>

                          {item.pisCofinsRegime === 'MONOFASICO' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                              PIS/COFINS Monofásico
                            </span>
                          )}

                          {item.pisCofinsRegime === 'ALIQUOTA_ZERO' && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              Alíquota Zero
                            </span>
                          )}

                          {inSpedCount > 0 && (
                            <span className="text-[10px] bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                              <Database className="w-3 h-3 mr-0.5 text-[#1e3a5f]" />
                              <span>{inSpedCount} no SPED</span>
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-800 font-semibold leading-snug line-clamp-2">
                          {item.descricao}
                        </p>

                        <p className="text-[11px] text-slate-500">
                          {item.capituloDescricao}
                        </p>
                      </div>

                      <div className="text-right whitespace-nowrap space-y-1">
                        <span className="text-xs font-mono font-bold text-slate-700 block">
                          IPI: {item.aliqIpi}
                        </span>
                        {itemUfDetails.isSt ? (
                          <span className="text-[10px] bg-[#f1efe8] text-[#1e3a5f] font-bold px-2 py-0.5 rounded inline-block border border-[#e5e2d9]">
                            ST UF {selectedUf} (CST {itemUfDetails.cstSugerido})
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">Sem ST em {selectedUf}</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Detailed NCM Inspector & Diagnostic Sandbox (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Detailed NCM Inspector Card */}
          {activeNcmRecord && activeUfTaxDetails ? (
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-5">
              
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Ficha Técnica NCM</span>
                    <button
                      onClick={() => handleCopy(activeNcmRecord.ncm)}
                      className="text-slate-400 hover:text-[#1e3a5f] transition flex items-center space-x-1 text-xs"
                      title="Copiar NCM"
                    >
                      {copiedText === activeNcmRecord.ncm ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <h3 className="text-2xl font-black font-mono text-[#1e3a5f]">
                    {activeNcmRecord.ncm}
                  </h3>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold text-slate-500 block">Capítulo TIPI</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">Cap. {activeNcmRecord.capitulo}</span>
                </div>
              </div>

              {/* State Tax Breakdown Card (Tributação Específica da UF selecionada) */}
              <div className="bg-slate-900 text-white p-4 rounded-lg space-y-3 shadow-sm border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                      Tributação no Estado: <strong className="text-white font-extrabold">{activeUfTaxDetails.ufName} ({selectedUf})</strong>
                    </span>
                  </div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                    {selectedUf}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-slate-300 block font-semibold">Alíquota ICMS (Modal + FCP)</span>
                    <span className="font-mono font-black text-white text-base">
                      {activeUfTaxDetails.effectiveIcms.toFixed(2)}%
                    </span>
                    {activeUfTaxDetails.fcpRate > 0 && (
                      <span className="text-[10px] text-amber-300 block">
                        (Modal: {activeUfTaxDetails.icmsAliq}% + FCP: {activeUfTaxDetails.fcpRate}%)
                      </span>
                    )}
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-slate-300 block font-semibold">Regime ICMS-ST na UF</span>
                    <span className={`font-mono font-bold text-xs ${activeUfTaxDetails.isSt ? 'text-amber-300' : 'text-slate-300'}`}>
                      {activeUfTaxDetails.isSt ? 'Substituição Tributária' : 'Tributado Operação Própria'}
                    </span>
                    {activeUfTaxDetails.isSt && activeUfTaxDetails.mva > 0 && (
                      <span className="text-[10px] text-slate-300 block">
                        MVA Interna: {activeUfTaxDetails.mva}% | MVA Ajust: {activeUfTaxDetails.mvaAjustada.toFixed(1)}%
                      </span>
                    )}
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-slate-300 block font-semibold">CST e CFOP Recomendado</span>
                    <span className="font-mono font-bold text-white text-xs">
                      CST {activeUfTaxDetails.cstSugerido} | CFOP {activeUfTaxDetails.cfopSaida}
                    </span>
                  </div>

                  <div className="bg-white/10 p-2.5 rounded-lg border border-white/10">
                    <span className="text-[10px] text-slate-300 block font-semibold">Exigência cBenef no SPED</span>
                    <span className="font-mono font-bold text-xs text-white">
                      {activeUfTaxDetails.cbenefExigidoUf ? (
                        <span className="text-amber-300">Exigido ({activeUfTaxDetails.cbenefSugerido})</span>
                      ) : (
                        <span className="text-slate-300">Não Obrigatório</span>
                      )}
                    </span>
                  </div>
                </div>

                {activeUfTaxDetails.matchingRule && (
                  <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/40 text-[11px] text-emerald-200 space-y-0.5">
                    <span className="font-bold flex items-center text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      Regra da Matriz Tributária Aplicada para {selectedUf}:
                    </span>
                    <p className="text-[10px] leading-tight text-slate-200">
                      {activeUfTaxDetails.matchingRule.descricao} — CST Esperado: {activeUfTaxDetails.matchingRule.expectedCst}, CFOP: {activeUfTaxDetails.matchingRule.expectedCfop?.join(', ')}
                    </p>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-2 flex items-center justify-between">
                  <span className="truncate">Legislação: {activeUfTaxDetails.ricms}</span>
                </div>
              </div>

              {/* Official Description */}
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase">Descrição Oficial Mercosul</span>
                <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed font-medium">
                  {activeNcmRecord.descricao}
                </p>
              </div>

              {/* Taxonomic Hierarchy */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-500 uppercase">Hierarquia Fiscal</span>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center space-x-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <span className="font-bold text-[#1e3a5f] font-mono">Capítulo {activeNcmRecord.capitulo}:</span>
                    <span className="truncate">{activeNcmRecord.capituloDescricao}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <span className="font-bold text-[#1e3a5f] font-mono">Posição {activeNcmRecord.posicao}:</span>
                    <span>Classificação Primária de 4 dígitos</span>
                  </div>
                </div>
              </div>

              {/* Tax Attributes Grid */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Alíquota IPI (TIPI)</span>
                  <span className="text-sm font-mono font-bold text-slate-900">{activeNcmRecord.aliqIpi}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Regime PIS / COFINS</span>
                  <span className="text-xs font-bold text-slate-900">{activeNcmRecord.pisCofinsRegime}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Código CEST (ST)</span>
                  <span className="text-xs font-mono font-bold text-[#1e3a5f]">
                    {activeNcmRecord.cest || 'Não Especificado'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Benefício Fiscal (cBenef)</span>
                  <span className="text-xs font-mono font-bold text-slate-800">
                    {activeUfTaxDetails.cbenefSugerido || '—'}
                  </span>
                </div>
              </div>

              {/* Fiscal Note */}
              {activeNcmRecord.observacaoFiscal && (
                <div className="bg-amber-50 p-3.5 rounded-lg border border-amber-200 text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center text-amber-900">
                    <Info className="w-4 h-4 mr-1 text-amber-600" />
                    Orientação de Auditoria Fiscal:
                  </span>
                  <p className="text-[11px] leading-relaxed">{activeNcmRecord.observacaoFiscal}</p>
                </div>
              )}

              {/* SPED File Cross-Check Section */}
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Presença nos Itens do SPED</span>
                  <Database className="w-4 h-4 text-[#1e3a5f]" />
                </h4>

                {activeNcmSpedStats ? (
                  <div className="bg-[#f1efe8] p-3.5 rounded-lg border border-[#e5e2d9] space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-[#1e3a5f]">
                      <span>Total de Ocorrências:</span>
                      <span>{activeNcmSpedStats.count} itens cadastrados</span>
                    </div>
                    <div className="flex justify-between text-slate-800 font-mono">
                      <span>Valor Movimentado:</span>
                      <span>
                        R${' '}
                        {activeNcmSpedStats.totalValor.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#e5e2d9] space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#1e3a5f]">Amostra de Produtos no SPED:</span>
                      {activeNcmSpedStats.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] text-slate-700 truncate font-mono">
                          <span className="truncate max-w-[200px]">{it.descrItem}</span>
                          <span className="font-bold text-slate-900 ml-2">CST {it.cstIcms}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
                    Esta NCM não foi localizada nos itens do arquivo SPED atualmente carregado.
                  </p>
                )}
              </div>

            </div>
          ) : null}

          {/* Diagnostic Validator Sandbox */}
          <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-[#1e3a5f]" />
              <h3 className="font-bold text-slate-900 text-sm">Validador de Estrutura NCM ({selectedUf})</h3>
            </div>

            <p className="text-xs text-slate-500">
              Digite qualquer código NCM para testar a máscara de 8 dígitos e validar a conformidade com a TIPI e regras da UF {selectedUf}.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={testNcmInput}
                onChange={(e) => setTestNcmInput(e.target.value)}
                placeholder="Ex: 84713012 ou 22030000"
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#1e3a5f]"
              />
            </div>

            {testDiagnostic && (
              <div
                className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                  testDiagnostic.status === 'VALID'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : testDiagnostic.status === 'WARNING'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                <div className="flex items-center justify-between font-mono font-bold">
                  <span>Código Formatado: {testDiagnostic.formatted}</span>
                  <span>{testDiagnostic.status}</span>
                </div>
                <p className="text-[11px] leading-snug">{testDiagnostic.message}</p>
                {testDiagnostic.foundMatch && (
                  <p className="text-[11px] font-semibold text-[#1e3a5f] pt-1">
                    ✔ Encontrado na base local: {testDiagnostic.foundMatch.descricao}
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
