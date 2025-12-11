// Teste direto da rota DELETE
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Coloque um token válido

async function testDelete() {
  try {
    // Primeiro, pegar categorias
    const categoriesResponse = await axios.get(`${API_URL}/categories`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    console.log('Total categories:', categoriesResponse.data.data.count);
    
    const categories = categoriesResponse.data.data.categories;
    const categoryToTest = categories.find(c => c._count.transactions === 0);
    
    if (!categoryToTest) {
      console.log('No category without transactions found');
      return;
    }
    
    console.log(`\nTrying to DELETE: ${categoryToTest.name} (${categoryToTest.id})`);
    
    // Testar DELETE
    const deleteResponse = await axios.delete(`${API_URL}/categories/${categoryToTest.id}`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    
    console.log('DELETE Success!');
    console.log('Response:', deleteResponse.data);
    
  } catch (error) {
    console.error('Error:', error.response ? {
      status: error.response.status,
      data: error.response.data
    } : error.message);
  }
}

testDelete();
