const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findFirst({ where: { email: "m2nivel.contato@gmail.com" }, select: { tenantId: true }});
  console.log("Tenant:", user?.tenantId);
  const cats = await prisma.category.findMany({ where: { tenantId: user.tenantId, level: 1, deletedAt: null }, include: { children: { where: { deletedAt: null } } }});
  console.log("Total L1:", cats.length);
  cats.slice(0,5).forEach(function(c) { console.log("-", c.name, "| children:", c.children ? c.children.length : 0); });
}
main().finally(function() { process.exit(0); });
