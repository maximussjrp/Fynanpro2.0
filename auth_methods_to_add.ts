// Adicionar ao auth.service.ts após o método de register

  /**
   * Esqueci minha senha - envia email com link de reset
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    try {
      log.info('AuthService.forgotPassword', { email });

      const user = await prisma.user.findUnique({
        where: { email },
      });

      // Sempre retorna sucesso para não revelar se email existe
      if (!user) {
        log.info('ForgotPassword - email não encontrado', { email });
        return { message: 'Se o email existir, você receberá um link de recuperação.' };
      }

      // Gera token de reset
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Salva token no banco
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
        },
      });

      // Envia email
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await emailService.sendPasswordResetEmail(user.email, {
        userName: user.fullName.split(' ')[0],
        resetLink,
        expiresIn: '1 hora',
      });

      log.info('ForgotPassword - email enviado', { userId: user.id });
      return { message: 'Se o email existir, você receberá um link de recuperação.' };
    } catch (error) {
      log.error('ForgotPassword error', { error, email });
      throw error;
    }
  }

  /**
   * Reset de senha com token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      log.info('AuthService.resetPassword', { tokenLength: token.length });

      const user = await prisma.user.findFirst({
        where: {
          passwordResetToken: token,
          passwordResetExpires: { gt: new Date() },
        },
      });

      if (!user) {
        throw new Error('Token inválido ou expirado');
      }

      // Valida nova senha
      if (newPassword.length < 6) {
        throw new Error('Senha deve ter no mínimo 6 caracteres');
      }

      // Hash da nova senha
      const passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

      // Atualiza senha e limpa token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      // Invalida todos os refresh tokens do usuário (força re-login)
      await prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      });

      log.info('ResetPassword - senha alterada', { userId: user.id });
      return { message: 'Senha alterada com sucesso! Faça login com sua nova senha.' };
    } catch (error) {
      log.error('ResetPassword error', { error });
      throw error;
    }
  }
