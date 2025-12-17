const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function resetPassword() {
  const newPassword = 'Admin123!';
  const hash = await bcrypt.hash(newPassword, 12);
  
  await prisma.user.update({
    where: { email: 'xxmaxx05@gmail.com' },
    data: { passwordHash: hash }
  });
  
  console.log('✅ Senha resetada com sucesso!');
  console.log('Email: xxmaxx05@gmail.com');
  console.log('Nova senha: Admin123!');
}

resetPassword()
  .finally(() => prisma.$disconnect());
