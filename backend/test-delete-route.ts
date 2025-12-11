import axios from 'axios';

const API_URL = 'http://localhost:3000/api/v1';

async function testDeleteRoute() {
  try {
    // 1. Login para obter token
    console.log('1. Fazendo login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@fynanpro.com',
      password: 'Admin@2024'
    });
    
    const token = loginResponse.data.data.accessToken;
    console.log('✅ Login OK\n');

    // 2. Listar categorias
    console.log('2. Listando categorias...');
    const categoriesResponse = await axios.get(`${API_URL}/categories`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const categories = categoriesResponse.data.data.categories;
    console.log(`✅ ${categories.length} categorias encontradas\n`);

    // 3. Tentar deletar uma categoria sem transações
    const categoryToDelete = categories.find((c: any) => c._count.transactions === 0);
    
    if (!categoryToDelete) {
      console.log('❌ Nenhuma categoria sem transações encontrada');
      return;
    }

    console.log(`3. Tentando deletar categoria: ${categoryToDelete.name} (${categoryToDelete.id})`);
    console.log(`   Transações: ${categoryToDelete._count.transactions}`);
    
    try {
      const deleteResponse = await axios.delete(`${API_URL}/categories/${categoryToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ DELETE funcionou!');
      console.log('Resposta:', deleteResponse.data);
    } catch (deleteError: any) {
      console.log('❌ DELETE falhou!');
      console.log('Status:', deleteError.response?.status);
      console.log('Erro:', deleteError.response?.data);
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testDeleteRoute();
