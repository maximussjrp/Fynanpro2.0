// Script para resetar senha diretamente no banco
// Executar: npx ts-node reset-test-password.ts

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'xxmaxx05@gmail.com';
  const newPassword = 'Test123!';
  
  // Gerar hash com bcrypt (mesma config do auth.service.ts)
  const passwordHash = await bcrypt.hash(newPassword, 12);
  
  console.log('Resetando senha para:', email);
  console.log('Nova senha:', newPassword);
  console.log('Hash gerado:', passwordHash);
  
  const result = await prisma.user.update({
    where: { email },
    data: { passwordHash }
  });
  
  console.log('Usuário atualizado:', result.id);
  console.log('Email:', result.email);
  console.log('Senha resetada com sucesso!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
