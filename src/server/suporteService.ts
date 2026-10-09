import { adminDb } from '../lib/firebase-admin';
import { ChamadoSuporte, MensagemChamado } from '../types';
import { fetchDocWithFallback, setDocWithFallback } from '../lib/firestore-rest-fallback.ts';

export async function getNextProtocol(token?: string): Promise<string> {
  const year = new Date().getFullYear();
  const counterPath = 'config/suporteContador';
  const counterRef = adminDb.collection('config').doc('suporteContador');
  
  try {
    return await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let nextNum = 1;
      
      if (doc.exists) {
        const data = doc.data();
        if (data && data.year === year) {
          nextNum = (data.lastNum || 0) + 1;
        }
      }
      
      transaction.set(counterRef, { year, lastNum: nextNum });
      return `SUP-${year}-${String(nextNum).padStart(6, '0')}`;
    });
  } catch (err: any) {
    console.warn('[Suporte Service] Admin SDK transaction failed, trying REST fallback:', err.message || err);
    
    if (token) {
      try {
        // Fallback via REST (não é atômico mas resolve o problema de permissão no ambiente)
        const doc = await fetchDocWithFallback(counterPath, token);
        let nextNum = 1;
        if (doc && doc.data && doc.data.year === year) {
          nextNum = (doc.data.lastNum || 0) + 1;
        }
        await setDocWithFallback(counterPath, { year, lastNum: nextNum }, token, true);
        return `SUP-${year}-${String(nextNum).padStart(6, '0')}`;
      } catch (restErr) {
        console.error('[Suporte Service] REST fallback also failed:', restErr);
      }
    }
    
    return `SUP-${year}-${Date.now()}`;
  }
}

export async function sendSupportEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[Suporte Service] SMTP not configured (SMTP_HOST/USER/PASS missing). Skipping email sending.');
    return;
  }

  try {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 465,
      secure: (Number(SMTP_PORT) || 465) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
      connectionTimeout: 8000,
      socketTimeout: 8000,
    });

    await transporter.sendMail({
      from: `"Atlas Suporte" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
    console.log(`[Suporte Service] Email sent to ${options.to}`);
  } catch (err) {
    console.error('[Suporte Service] Error sending email:', err);
  }
}

export async function notifyNewTicket(chamado: ChamadoSuporte) {
  const destino = process.env.SUPORTE_EMAIL_DESTINO;
  if (!destino) return;

  const subject = `[Atlas Suporte] ${chamado.protocolo} – ${chamado.tipo} – ${chamado.titulo}`;
  const text = `
    Novo chamado aberto:
    Protocolo: ${chamado.protocolo}
    Tipo: ${chamado.tipo}
    Título: ${chamado.titulo}
    
    Autor: ${chamado.autorNome} (${chamado.autorEmail})
    Escritório: ${chamado.escritorioNome} (ID: ${chamado.escritorioId})
    Tela de Origem: ${chamado.telaOrigem}
    Versão App: ${chamado.versaoApp}
    
    Descrição:
    ${chamado.descricao}
  `;

  // Não bloqueante
  sendSupportEmail({ to: destino, subject, text }).catch(e => console.error('Erro notifyNewTicket:', e));
}

export async function notifyUserResponse(chamado: ChamadoSuporte, mensagem: string) {
  const destino = process.env.SUPORTE_EMAIL_DESTINO;
  if (!destino) return;

  const subject = `[Atlas Suporte] Re: ${chamado.protocolo} – Nova mensagem de ${chamado.autorNome}`;
  const text = `
    O usuário respondeu ao chamado ${chamado.protocolo}.
    
    Autor: ${chamado.autorNome}
    Escritório: ${chamado.escritorioNome}
    
    Mensagem:
    ${mensagem}
  `;

  // Não bloqueante
  sendSupportEmail({ to: destino, subject, text }).catch(e => console.error('Erro notifyUserResponse:', e));
}

export async function notifyAdminResponse(chamado: ChamadoSuporte, mensagem: string) {
  const subject = `[Atlas Suporte] Resposta ao seu chamado ${chamado.protocolo}`;
  const text = `
    Olá ${chamado.autorNome},
    
    O suporte da Atlas enviou uma resposta ao seu chamado ${chamado.protocolo} (${chamado.titulo}).
    
    Mensagem:
    ${mensagem}
    
    Para visualizar e responder, acesse o módulo de Suporte no sistema.
  `;

  // Não bloqueante
  sendSupportEmail({ to: chamado.autorEmail, subject, text }).catch(e => console.error('Erro notifyAdminResponse:', e));
}

export async function notifyStatusChange(chamado: ChamadoSuporte) {
  const subject = `[Atlas Suporte] Status alterado: ${chamado.protocolo}`;
  const text = `
    Olá ${chamado.autorNome},
    
    O status do seu chamado ${chamado.protocolo} foi alterado para: ${chamado.status}.
    
    Para mais detalhes, acesse o módulo de Suporte no sistema.
  `;

  // Não bloqueante
  sendSupportEmail({ to: chamado.autorEmail, subject, text }).catch(e => console.error('Erro notifyStatusChange:', e));
}
