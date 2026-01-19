const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetMasterPassword() {
  const newPassword = 'Master@2024';
  const hash = await bcrypt.hash(newPassword, 12);
  
  console.log('Hash gerado:', hash);
  
  const result = await prisma.user.updateMany({
    where: { email: 'master@utopsistema.com.br' },
    data: { passwordHash: hash }
  });
  
  console.log('Usuários atualizados:', result.count);
  console.log('Nova senha: Master@2024');
  
  await prisma.$disconnect();
}

resetMasterPassword().catch(console.error);
