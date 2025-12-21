const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function addSubcategories() {
  const tenantId = '1038780d-26d9-43e7-a825-364260547f85';
  
  // Buscar Moradia
  const moradia = await p.category.findFirst({ where: { tenantId, name: { contains: 'Moradia' }, level: 1 } });
  if (moradia) {
    console.log('Moradia encontrada:', moradia.id);
    const subs = ['Aluguel', 'Condomínio', 'Luz', 'Água', 'Gás', 'Internet'];
    for (const s of subs) {
      const exists = await p.category.findFirst({ where: { tenantId, parentId: moradia.id, name: s } });
      if (exists === null) {
        await p.category.create({ data: { tenantId, name: s, type: 'expense', level: 2, parentId: moradia.id, isActive: true } });
        console.log('Criado:', s);
      }
    }
  }
  
  // Buscar Saúde
  const saude = await p.category.findFirst({ where: { tenantId, name: { contains: 'Saúde' }, level: 1 } });
  if (saude) {
    console.log('Saúde encontrada:', saude.id);
    const subs = ['Plano de Saúde', 'Consultas', 'Exames', 'Farmácia', 'Dentista'];
    for (const s of subs) {
      const exists = await p.category.findFirst({ where: { tenantId, parentId: saude.id, name: s } });
      if (exists === null) {
        await p.category.create({ data: { tenantId, name: s, type: 'expense', level: 2, parentId: saude.id, isActive: true } });
        console.log('Criado:', s);
      }
    }
  }
  
  // Buscar Lazer
  const lazer = await p.category.findFirst({ where: { tenantId, name: { contains: 'Lazer' }, level: 1 } });
  if (lazer) {
    console.log('Lazer encontrado:', lazer.id);
    const subs = ['Cinema', 'Shows', 'Jogos', 'Streaming', 'Hobbies'];
    for (const s of subs) {
      const exists = await p.category.findFirst({ where: { tenantId, parentId: lazer.id, name: s } });
      if (exists === null) {
        await p.category.create({ data: { tenantId, name: s, type: 'expense', level: 2, parentId: lazer.id, isActive: true } });
        console.log('Criado:', s);
      }
    }
  }

  // Buscar Educação
  const educacao = await p.category.findFirst({ where: { tenantId, name: { contains: 'Educação' }, level: 1 } });
  if (educacao) {
    console.log('Educação encontrada:', educacao.id);
    const subs = ['Cursos', 'Faculdade', 'Livros', 'Material Escolar'];
    for (const s of subs) {
      const exists = await p.category.findFirst({ where: { tenantId, parentId: educacao.id, name: s } });
      if (exists === null) {
        await p.category.create({ data: { tenantId, name: s, type: 'expense', level: 2, parentId: educacao.id, isActive: true } });
        console.log('Criado:', s);
      }
    }
  }
  
  console.log('Subcategorias adicionadas!');
}

addSubcategories().finally(() => process.exit(0));
