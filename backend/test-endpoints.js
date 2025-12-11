const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

// Você precisa fornecer um token válido aqui
const TOKEN = 'SEU_TOKEN_AQUI'; // Cole o token do localStorage

(async () => {
  try {
    console.log('=== TESTANDO ENDPOINTS ===\n');

    // 1. Testar GET /recurring-bills
    console.log('1. GET /recurring-bills');
    const billsResponse = await axios.get(`${API_URL}/recurring-bills`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`   Status: ${billsResponse.status}`);
    console.log(`   Total: ${billsResponse.data.data.recurringBills.length} recorrências\n`);

    // 2. Testar GET /recurring-bills/occurrences
    console.log('2. GET /recurring-bills/occurrences');
    const occurrencesResponse = await axios.get(`${API_URL}/recurring-bills/occurrences`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`   Status: ${occurrencesResponse.status}`);
    console.log(`   Total: ${occurrencesResponse.data.data.occurrences.length} ocorrências\n`);

    // 3. Testar GET /calendar/events
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    console.log('3. GET /calendar/events');
    const calendarResponse = await axios.get(`${API_URL}/calendar/events`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      params: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      }
    });
    console.log(`   Status: ${calendarResponse.status}`);
    console.log(`   Transações: ${calendarResponse.data.data.transactions?.length || 0}`);
    console.log(`   Recorrências: ${calendarResponse.data.data.recurringBills?.length || 0}`);
    console.log(`   Ocorrências: ${calendarResponse.data.data.recurringOccurrences?.length || 0}\n`);

    console.log('✅ Todos os endpoints responderam corretamente!');

  } catch (error) {
    console.error('❌ Erro ao testar endpoints:');
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Mensagem: ${error.response.data?.error?.message || error.message}`);
    } else {
      console.error(`   ${error.message}`);
    }
  }
})();
