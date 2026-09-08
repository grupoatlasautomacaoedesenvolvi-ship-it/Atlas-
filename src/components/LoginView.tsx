import React, { useState } from 'react';
import { useAuth } from '../lib/auth';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  LogIn, 
  KeyRound, 
  FileCheck2, 
  SlidersHorizontal, 
  BarChart3, 
  Building2,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  Server,
  Layers,
  Check
} from 'lucide-react';

export function LoginView() {
  const { signIn, resetPassword } = useAuth();
  
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
  };

  const applyAtlasDomain = () => {
    if (!email) {
      setEmail('usuario@atlas.com');
      return;
    }
    if (!email.includes('@')) {
      setEmail(`${email}@atlas.com`);
    } else {
      const parts = email.split('@');
      setEmail(`${parts[0]}@atlas.com`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    let finalEmail = email.trim();
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@atlas.com`;
      setEmail(finalEmail);
    }

    try {
      if (mode === 'forgot') {
        await resetPassword(finalEmail);
        setMessage('E-mail de redefinição enviado com sucesso. Verifique sua caixa de entrada.');
      } else {
        await signIn(finalEmail, password);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let errMsg = err.message || 'Ocorreu um erro na autenticação. Tente novamente.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        errMsg = 'E-mail ou senha incorretos.';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'Este e-mail já está cadastrado no sistema. Faça login.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'A senha deve conter pelo menos 6 caracteres.';
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans text-[var(--atlas-text)] selection:bg-[var(--atlas-navy)] selection:text-white" style={{ background: 'var(--atlas-bg)' }}>
      {/* Left Column: Official Brand & High Impact Product Showcase */}
      <div className="lg:w-7/12 p-8 lg:p-16 xl:px-20 xl:py-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[var(--atlas-border)] relative overflow-hidden bg-[var(--atlas-navy)] text-white">
        {/* Textura sutil em baixa opacidade */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        <div className="max-w-2xl relative z-10">
          {/* Prominent Logo Header */}
          <div className="mb-10 flex items-center justify-between">
            <img 
              src="/logo.svg" 
              alt="Atlas Auditor Fiscal" 
              className="h-24 lg:h-28 w-auto object-contain max-w-full drop-shadow-md"
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/30 bg-emerald-500/10">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Plataforma Homologada
            </span>
          </div>

          {/* Product Headline & Positioning */}
          <div className="space-y-4 mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/20 text-xs font-bold text-white uppercase tracking-wider bg-white/10 backdrop-blur-md">
              <Layers className="w-3.5 h-3.5 text-emerald-300" />
              Auditoria EFD ICMS/IPI & NF-e
            </div>
            <h1 className="text-3xl lg:text-[38px] font-bold text-white font-serif tracking-tight leading-snug">
              Conformidade fiscal e auditoria SPED com máxima segurança e precisão.
            </h1>
            <p className="text-slate-200 text-sm lg:text-base leading-relaxed">
              O <strong className="text-white font-semibold">Atlas Auditor Fiscal</strong> realiza o cruzamento automatizado dos seus arquivos SPED com documentos fiscais eletrônicos e regras estaduais, identificando divergências com rapidez e garantindo total conformidade antes do envio à Receita Federal.
            </p>
          </div>

          {/* Product Operational Highlights Panel */}
          <div className="mb-10 p-5 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md">
            <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider mb-3">
              Módulos e Recursos em Destaque
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2 text-white">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Conciliação SPED x XML de NF-e/NFC-e</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Conferência de NCM, CEST e MVA por UF</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Mapeamento de Notas Omissas e Não Escrituradas</span>
              </div>
              <div className="flex items-center gap-2 text-white">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Exportação Direta de SPED Retificado em TXT</span>
              </div>
            </div>
          </div>

          {/* Feature Details */}
          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-3.5 pb-3.5 border-b border-white/10">
              <div className="p-2 rounded-lg text-emerald-300 bg-white/10 shrink-0 mt-0.5">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cruzamento Automatizado</h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                  Análise detalhada de consistência entre livros fiscais e chaves de acesso de documentos emitidos e recebidos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 pb-3.5 border-b border-white/10">
              <div className="p-2 rounded-lg text-emerald-300 bg-white/10 shrink-0 mt-0.5">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Regras Tributárias Estaduais</h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                  Validação automatizada de alíquotas internas de ICMS, substituição tributária e benefícios fiscais vigentes.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-lg text-emerald-300 bg-white/10 shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Relatórios e Edição em Lote</h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                  Painel intuitivo com apontamento de erros por severidade e recursos de retificação ágil de registros.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-6 border-t border-white/10 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-4 relative z-10">
          <p>© {new Date().getFullYear()} Grupo Atlas Automação e Desenvolvimento. Todos os direitos reservados.</p>
          <div className="flex items-center gap-5">
            <span className="flex items-center gap-1.5 text-white font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Compatível com PVA RFB
            </span>
            <span className="flex items-center gap-1.5 text-white font-semibold">
              <Building2 className="w-3.5 h-3.5 text-emerald-300" /> Multi-Escritório
            </span>
          </div>
        </div>
      </div>

      {/* Right Column: Integrated Form */}
      <div className="lg:w-5/12 p-8 lg:p-16 xl:p-20 flex flex-col justify-between">
        <div className="w-full max-w-sm mx-auto space-y-8 my-auto">
          {/* Header */}
          <div>
            <div className="flex items-center space-x-2 border-b border-[var(--atlas-border)] pb-3 mb-6">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-xs font-bold pb-3 -mb-3 transition-colors text-[var(--atlas-navy)] border-b-2 border-[var(--atlas-navy)]"
              >
                Acessar Conta
              </button>
            </div>

            <h2 className="text-xl font-bold text-[var(--atlas-navy)] tracking-tight">
              {mode === 'forgot'
                ? 'Recuperação de Senha'
                : 'Autenticação de Usuário'}
            </h2>
            <p className="text-xs text-[var(--atlas-text-muted)] mt-1 leading-relaxed">
              {mode === 'forgot'
                ? 'Informe seu e-mail corporativo para receber as instruções de redefinição.'
                : 'Insira suas credenciais corporativas para acessar o painel de auditoria.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-[var(--atlas-text-secondary)]">
                  E-mail Corporativo
                </label>
                <button
                  type="button"
                  onClick={applyAtlasDomain}
                  className="text-[11px] text-[var(--atlas-navy)]/80 hover:text-[var(--atlas-navy)] transition font-medium underline"
                >
                  Usar @atlas.com
                </button>
              </div>
              <div className="relative">
                <Mail className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  placeholder="usuario@atlas.com"
                  className="atlas-input pl-10 py-3.5"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-[var(--atlas-text-secondary)]">Senha</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}
                      className="text-[11px] text-[var(--atlas-navy)]/80 hover:text-[var(--atlas-navy)] transition font-semibold"
                    >
                      Esqueceu a senha?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--atlas-text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="atlas-input pl-10 pr-10 py-3.5"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--atlas-text-muted)] hover:text-[var(--atlas-text-secondary)] transition"
                    aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="atlas-alert atlas-alert-danger" role="alert">
                {error}
              </div>
            )}

            {message && (
              <div className="atlas-alert atlas-alert-success" role="status">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="atlas-btn atlas-btn-primary w-full mt-2"
            >
              {loading ? (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              ) : mode === 'forgot' ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  Enviar Instruções
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Entrar no Sistema
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </button>

            {mode === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                  className="text-xs text-[var(--atlas-text-muted)] hover:text-[var(--atlas-navy)] transition underline font-medium"
                >
                  Voltar para a tela de login
                </button>
              </div>
            )}
          </form>

          <div className="pt-6 border-t border-[var(--atlas-border)] text-center space-y-2">
            <p className="text-[11px] text-[var(--atlas-text-muted)]">
              Autenticação corporativa com criptografia TLS 1.3 e controle de acessos por perfil.
            </p>
            <div className="flex items-center justify-center gap-2 text-[10px] text-[var(--atlas-text-muted)] font-mono">
              <Server className="w-3 h-3 text-[var(--atlas-text-muted)]" />
              <span>Servidores Ativos • EFD Schema RFB v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
