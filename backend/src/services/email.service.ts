/**
 * EmailService - Serviço de envio de emails usando Resend
 * 
 * Para configurar:
 * 1. Crie uma conta em https://resend.com
 * 2. Vá em API Keys e crie uma nova API Key
 * 3. Configure RESEND_API_KEY no .env
 * 4. Configure EMAIL_FROM (ex: noreply@seudominio.com)
 * 
 * Importante: Para enviar de um domínio próprio, você precisa verificá-lo no Resend
 */

import { log } from '../utils/logger';

// Interface para o cliente Resend (importação condicional para evitar erro se não instalado)
let Resend: any = null;
try {
  Resend = require('resend').Resend;
} catch (e) {
  log.warn('Resend não instalado. Emails serão simulados no console.');
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailVerificationData {
  userName: string;
  verificationLink: string;
}

interface WelcomeEmailData {
  userName: string;
  loginLink: string;
}

interface PasswordResetData {
  userName: string;
  resetLink: string;
}

interface TrialEndingData {
  userName: string;
  daysRemaining: number;
  upgradeLink: string;
}

class EmailService {
  private resend: any = null;
  private from: string;
  private baseUrl: string;
  private isEnabled: boolean = false;

  constructor() {
    this.from = process.env.EMAIL_FROM || 'UTOP <noreply@utopsistema.com.br>';
    this.baseUrl = process.env.FRONTEND_URL || 'https://utopsistema.com.br';
    
    const apiKey = process.env.RESEND_API_KEY;
    
    if (apiKey && Resend) {
      this.resend = new Resend(apiKey);
      this.isEnabled = true;
      log.info('EmailService inicializado com Resend');
    } else {
      log.warn('EmailService em modo simulação (RESEND_API_KEY não configurado)');
    }
  }

  /**
   * Envia um email
   */
  async send(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.isEnabled || !this.resend) {
        // Modo simulação - apenas loga
        log.info('📧 [SIMULAÇÃO] Email enviado:', {
          to: options.to,
          subject: options.subject,
          preview: options.html.substring(0, 200) + '...'
        });
        console.log('\n📧 ========== EMAIL SIMULADO ==========');
        console.log(`Para: ${options.to}`);
        console.log(`Assunto: ${options.subject}`);
        console.log('HTML:', options.html);
        console.log('========================================\n');
        return true;
      }

      const result = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text
      });

      log.info('Email enviado com sucesso', { to: options.to, id: result.id });
      return true;
    } catch (error) {
      log.error('Erro ao enviar email', { error, to: options.to });
      return false;
    }
  }

  /**
   * Envia email de verificação
   */
  async sendVerificationEmail(to: string, data: EmailVerificationData): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifique seu email - UTOP</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 24px; font-weight: bold;">U</span>
                </div>
                <span style="font-size: 28px; font-weight: bold; color: #0F172A;">UTOP</span>
              </div>
            </td>
          </tr>
          
          <!-- Card Principal -->
          <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <h1 style="margin: 0 0 20px; font-size: 24px; color: #0F172A; text-align: center;">
                Confirme seu email
              </h1>
              
              <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
                Olá, <strong>${data.userName}</strong>!<br><br>
                Clique no botão abaixo para verificar seu email e ativar sua conta no UTOP.
              </p>
              
              <!-- Botão -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${data.verificationLink}" 
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Verificar Email
                </a>
              </div>
              
              <p style="margin: 0; color: #94A3B8; font-size: 14px; text-align: center;">
                Se você não criou uma conta no UTOP, ignore este email.
              </p>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #E2E8F0;">
              
              <p style="margin: 0; color: #94A3B8; font-size: 12px; text-align: center;">
                Se o botão não funcionar, copie e cole este link no navegador:<br>
                <a href="${data.verificationLink}" style="color: #1F4FD8; word-break: break-all;">
                  ${data.verificationLink}
                </a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 30px;">
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                © 2025 UTOP - Seu dinheiro em equilíbrio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.send({
      to,
      subject: '✉️ Confirme seu email - UTOP',
      html,
      text: `Olá ${data.userName}! Clique no link para verificar seu email: ${data.verificationLink}`
    });
  }

  /**
   * Envia email de boas-vindas após verificação
   */
  async sendWelcomeEmail(to: string, data: WelcomeEmailData): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bem-vindo ao UTOP!</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 24px; font-weight: bold;">U</span>
                </div>
                <span style="font-size: 28px; font-weight: bold; color: #0F172A;">UTOP</span>
              </div>
            </td>
          </tr>
          
          <!-- Card Principal -->
          <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">🎉</span>
              </div>
              
              <h1 style="margin: 0 0 20px; font-size: 24px; color: #0F172A; text-align: center;">
                Bem-vindo ao UTOP!
              </h1>
              
              <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
                Olá, <strong>${data.userName}</strong>!<br><br>
                Sua conta foi verificada com sucesso. Agora você pode organizar suas finanças de forma simples e inteligente.
              </p>
              
              <!-- Features -->
              <div style="background: #F8FAFC; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
                <p style="margin: 0 0 10px; color: #0F172A; font-weight: 600;">✨ O que você pode fazer:</p>
                <ul style="margin: 0; padding-left: 20px; color: #475569;">
                  <li style="margin-bottom: 8px;">Registrar receitas e despesas</li>
                  <li style="margin-bottom: 8px;">Gerenciar contas bancárias</li>
                  <li style="margin-bottom: 8px;">Criar orçamentos mensais</li>
                  <li style="margin-bottom: 8px;">Visualizar relatórios detalhados</li>
                </ul>
              </div>
              
              <!-- Botão -->
              <div style="text-align: center;">
                <a href="${data.loginLink}" 
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Acessar minha conta
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 30px;">
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                © 2025 UTOP - Seu dinheiro em equilíbrio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.send({
      to,
      subject: '🎉 Bem-vindo ao UTOP!',
      html,
      text: `Bem-vindo ao UTOP, ${data.userName}! Sua conta foi verificada. Acesse: ${data.loginLink}`
    });
  }

  /**
   * Envia email de recuperação de senha
   */
  async sendPasswordResetEmail(to: string, data: PasswordResetData): Promise<boolean> {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar senha - UTOP</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #F8FAFC;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 500px; border-collapse: collapse;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom: 30px;">
              <div style="display: inline-flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                  <span style="color: white; font-size: 24px; font-weight: bold;">U</span>
                </div>
                <span style="font-size: 28px; font-weight: bold; color: #0F172A;">UTOP</span>
              </div>
            </td>
          </tr>
          
          <!-- Card Principal -->
          <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
              <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 48px;">🔐</span>
              </div>
              
              <h1 style="margin: 0 0 20px; font-size: 24px; color: #0F172A; text-align: center;">
                Recuperar senha
              </h1>
              
              <p style="margin: 0 0 30px; color: #475569; font-size: 16px; line-height: 1.6; text-align: center;">
                Olá, <strong>${data.userName}</strong>!<br><br>
                Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
              </p>
              
              <!-- Botão -->
              <div style="text-align: center; margin-bottom: 30px;">
                <a href="${data.resetLink}" 
                   style="display: inline-block; padding: 16px 48px; background: linear-gradient(135deg, #1F4FD8, #2ECC9A); color: white; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
                  Redefinir senha
                </a>
              </div>
              
              <p style="margin: 0; color: #94A3B8; font-size: 14px; text-align: center;">
                Este link expira em 1 hora.<br>
                Se você não solicitou a redefinição, ignore este email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top: 30px;">
              <p style="margin: 0; color: #94A3B8; font-size: 12px;">
                © 2025 UTOP - Seu dinheiro em equilíbrio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    return this.send({
      to,
      subject: '🔐 Recuperar senha - UTOP',
      html,
      text: `Olá ${data.userName}! Clique no link para redefinir sua senha: ${data.resetLink}`
    });
  }

  /**
   * Gera o link de verificação
   */
  getVerificationLink(token: string): string {
    return `${this.baseUrl}/verify-email?token=${token}`;
  }

  /**
   * Gera o link de reset de senha
   */
  getPasswordResetLink(token: string): string {
    return `${this.baseUrl}/reset-password?token=${token}`;
  }

  /**
   * Envia email de aviso de fim de trial (D-7 ou D-1).
   * Sprint B — usado pelo job `trial-expiry-notification.job.ts`.
   */
  async sendTrialEndingEmail(to: string, data: TrialEndingData): Promise<boolean> {
    const isCritical = data.daysRemaining <= 1;
    const accentColor = isCritical ? '#E64545' : '#F59E0B';
    const subject = isCritical
      ? '⚠️ Seu período de teste UTOP termina amanhã'
      : `⏳ Faltam ${data.daysRemaining} dias do seu teste UTOP`;
    const headline = isCritical
      ? 'Seu teste termina em menos de 24h'
      : `Seu teste termina em ${data.daysRemaining} dias`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;font-family:'Inter',Arial,sans-serif;background-color:#F8FAFC;">
  <table role="presentation" style="width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" style="width:100%;max-width:520px;border-collapse:collapse;">
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <div style="display:inline-flex;align-items:center;gap:12px;">
                <div style="width:48px;height:48px;background:linear-gradient(135deg,#1F4FD8,#2ECC9A);border-radius:12px;display:flex;align-items:center;justify-content:center;">
                  <span style="color:white;font-size:24px;font-weight:bold;">U</span>
                </div>
                <span style="font-size:28px;font-weight:bold;color:#0F172A;">UTOP</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background:white;border-radius:16px;padding:40px;box-shadow:0 4px 6px rgba(0,0,0,0.05);">
              <div style="background:${accentColor};color:white;font-weight:600;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;padding:6px 14px;border-radius:999px;display:inline-block;margin-bottom:20px;">
                ${isCritical ? 'Último aviso' : 'Aviso'}
              </div>
              <h1 style="margin:0 0 16px;font-size:24px;color:#0F172A;">${headline}</h1>
              <p style="margin:0 0 20px;color:#475569;font-size:16px;line-height:1.6;">
                Olá, <strong>${data.userName}</strong>!
              </p>
              <p style="margin:0 0 20px;color:#475569;font-size:16px;line-height:1.6;">
                Seu período de teste do UTOP termina em <strong>${data.daysRemaining} ${data.daysRemaining === 1 ? 'dia' : 'dias'}</strong>.
                Para não perder o acesso ao histórico das suas finanças, ative seu plano agora.
              </p>
              <div style="text-align:center;margin:30px 0;">
                <a href="${data.upgradeLink}"
                   style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#1F4FD8,#2ECC9A);color:white;text-decoration:none;border-radius:12px;font-weight:600;font-size:16px;">
                  Ver planos e ativar
                </a>
              </div>
              <p style="margin:0;color:#94A3B8;font-size:13px;text-align:center;">
                Dúvidas? Responda este email — nossa equipe ajuda você.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-top:30px;">
              <p style="margin:0;color:#94A3B8;font-size:12px;">
                © 2025 UTOP — Seu dinheiro em equilíbrio
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    const text =
      `Olá ${data.userName}!\n\n` +
      `Seu período de teste do UTOP termina em ${data.daysRemaining} ${data.daysRemaining === 1 ? 'dia' : 'dias'}.\n` +
      `Ative seu plano para manter acesso: ${data.upgradeLink}\n\n` +
      `— Equipe UTOP`;

    return this.send({ to, subject, html, text });
  }

  /**
   * Link para a página de planos / upgrade (usado nos emails comerciais).
   */
  getUpgradeLink(): string {
    return `${this.baseUrl}/dashboard/settings/billing`;
  }
}

export const emailService = new EmailService();
