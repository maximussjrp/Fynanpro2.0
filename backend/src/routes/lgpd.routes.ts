/**
 * Rotas LGPD
 * Endpoints para conformidade com a Lei Geral de Proteção de Dados
 */

import { Router, Request, Response } from 'express';
import { lgpdService } from '../services/lgpd.service';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/lgpd/export
 * @desc    Exportar todos os dados do usuário (portabilidade - LGPD Art. 18, V)
 * @access  Private
 */
router.get('/export', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const requestInfo = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const data = await lgpdService.exportUserData(userId, requestInfo);

    // Definir headers para download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="meus-dados-${new Date().toISOString().split('T')[0]}.json"`);

    return res.json(data);
  } catch (error) {
    console.error('Erro ao exportar dados:', error);
    return res.status(500).json({ 
      error: 'Erro ao exportar dados',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   DELETE /api/v1/lgpd/account
 * @desc    Excluir conta e anonimizar dados (LGPD Art. 18, VI)
 * @access  Private
 * @body    { confirmation: "EXCLUIR MINHA CONTA" }
 */
router.delete('/account', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { confirmation } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!confirmation) {
      return res.status(400).json({ 
        error: 'Confirmação necessária',
        message: 'Envie { "confirmation": "EXCLUIR MINHA CONTA" } para confirmar a exclusão',
      });
    }

    const requestInfo = {
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    };

    const result = await lgpdService.deleteUserAccount(userId, confirmation, requestInfo);

    return res.json(result);
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    return res.status(400).json({ 
      error: 'Erro ao excluir conta',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   GET /api/v1/lgpd/consents
 * @desc    Listar consentimentos do usuário
 * @access  Private
 */
router.get('/consents', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const consents = await lgpdService.getUserConsents(userId);

    return res.json(consents);
  } catch (error) {
    console.error('Erro ao buscar consentimentos:', error);
    return res.status(500).json({ 
      error: 'Erro ao buscar consentimentos',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   POST /api/v1/lgpd/consents
 * @desc    Registrar novo consentimento
 * @access  Private
 * @body    { type: string, version: string, accepted: boolean }
 */
router.post('/consents', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { type, version, accepted } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (!type || !version || typeof accepted !== 'boolean') {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        message: 'Envie { type, version, accepted }',
      });
    }

    const validTypes = ['terms_of_use', 'privacy_policy', 'marketing', 'data_sharing'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Tipo inválido',
        message: `Tipos válidos: ${validTypes.join(', ')}`,
      });
    }

    const consent = await lgpdService.registerConsent(userId, {
      type,
      version,
      accepted,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    return res.status(201).json(consent);
  } catch (error) {
    console.error('Erro ao registrar consentimento:', error);
    return res.status(500).json({ 
      error: 'Erro ao registrar consentimento',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   DELETE /api/v1/lgpd/consents/:type
 * @desc    Revogar consentimento específico
 * @access  Private
 */
router.delete('/consents/:type', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { type } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const result = await lgpdService.revokeConsent(userId, type);

    return res.json(result);
  } catch (error) {
    console.error('Erro ao revogar consentimento:', error);
    return res.status(400).json({ 
      error: 'Erro ao revogar consentimento',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   GET /api/v1/lgpd/privacy-report
 * @desc    Relatório de privacidade para DPO (apenas admin)
 * @access  Private (Admin only)
 */
router.get('/privacy-report', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = req.tenantId;
    
    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant não identificado' });
    }

    // TODO: Verificar se é admin

    const report = await lgpdService.generatePrivacyReport(tenantId);

    return res.json(report);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return res.status(500).json({ 
      error: 'Erro ao gerar relatório',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
  }
});

/**
 * @route   GET /api/v1/lgpd/policy
 * @desc    Retorna a política de privacidade em formato estruturado
 * @access  Public
 */
router.get('/policy', async (_req: Request, res: Response) => {
  const policy = {
    version: '1.0.0',
    lastUpdated: '2025-01-01',
    company: {
      name: 'FYNANPRO',
      cnpj: 'XX.XXX.XXX/0001-XX', // Substituir pelo real
      address: 'Endereço da empresa',
      dpoEmail: 'privacidade@fynanpro.com.br',
    },
    sections: [
      {
        title: '1. Dados Coletados',
        content: `Coletamos os seguintes dados pessoais:
- Dados de identificação: nome, e-mail, telefone
- Dados financeiros: transações, saldos, categorias (inseridos pelo usuário)
- Dados de acesso: IP, navegador, data/hora de acesso
- Cookies: preferências do usuário e sessão`,
      },
      {
        title: '2. Finalidade do Tratamento',
        content: `Utilizamos seus dados para:
- Prestação do serviço de gestão financeira
- Geração de relatórios e análises
- Comunicação sobre o serviço
- Melhoria contínua da plataforma
- Cumprimento de obrigações legais`,
      },
      {
        title: '3. Base Legal (LGPD Art. 7)',
        content: `O tratamento dos dados é baseado em:
- Execução de contrato (Art. 7, V)
- Consentimento do titular (Art. 7, I)
- Cumprimento de obrigação legal (Art. 7, II)
- Legítimo interesse (Art. 7, IX)`,
      },
      {
        title: '4. Compartilhamento de Dados',
        content: `Seus dados podem ser compartilhados com:
- Prestadores de serviço (hospedagem, e-mail)
- Autoridades públicas (quando exigido por lei)
- Não vendemos seus dados a terceiros`,
      },
      {
        title: '5. Seus Direitos (LGPD Art. 18)',
        content: `Você tem direito a:
- Confirmar a existência de tratamento
- Acessar seus dados
- Corrigir dados incompletos ou desatualizados
- Anonimização, bloqueio ou eliminação
- Portabilidade dos dados
- Revogar consentimento`,
      },
      {
        title: '6. Retenção de Dados',
        content: `Mantemos seus dados enquanto:
- Sua conta estiver ativa
- For necessário para cumprir obrigações legais
- For necessário para exercer direitos em processos

Após exclusão da conta, dados são anonimizados.`,
      },
      {
        title: '7. Segurança',
        content: `Adotamos medidas de segurança como:
- Criptografia de dados em trânsito (HTTPS)
- Hash de senhas (bcrypt)
- Controle de acesso por perfis
- Logs de auditoria
- Backup periódico`,
      },
      {
        title: '8. Contato',
        content: `Para exercer seus direitos ou esclarecer dúvidas:
- E-mail: privacidade@fynanpro.com.br
- Use a função "Exportar meus dados" no sistema
- Use a função "Excluir minha conta" para eliminação`,
      },
    ],
    rights: [
      { code: 'access', name: 'Acesso aos dados', endpoint: 'GET /api/v1/lgpd/export' },
      { code: 'rectification', name: 'Correção', endpoint: 'PUT /api/users/me' },
      { code: 'erasure', name: 'Eliminação', endpoint: 'DELETE /api/v1/lgpd/account' },
      { code: 'portability', name: 'Portabilidade', endpoint: 'GET /api/v1/lgpd/export' },
      { code: 'consent', name: 'Gerenciar consentimentos', endpoint: 'GET /api/v1/lgpd/consents' },
    ],
  };

  return res.json(policy);
});

export default router;
