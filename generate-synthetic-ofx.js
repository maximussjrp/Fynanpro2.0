#!/usr/bin/env node
/**
 * Gerador de OFX Sintético para Testes
 * Gera arquivos OFX realistas para: Itaú, Inter, BB, C6
 */

const fs = require('fs');
const crypto = require('crypto');

// Templates de transações por banco
const bankConfigs = {
  itau: {
    bankId: '341',
    bankName: 'ITAU UNIBANCO',
    acctId: '19638',
    branchId: '7935',
    patterns: {
      pix_sent: 'PIX ENVIADO - CPF ***{cpf} {nome}',
      pix_received: 'PIX RECEBIDO - {nome} CPF ***{cpf}',
      debit: 'COMPRA CARTAO DEBITO - {estabelecimento}',
      transfer: 'TRANSF ELETRONICA - {destino}',
      invoice: 'PGTO FATURA ITAUCARD',
      fee: 'TARIFA MANUTENCAO CC',
    }
  },
  inter: {
    bankId: '077',
    bankName: 'BANCO INTER',
    acctId: '4146771',
    branchId: '0001',
    patterns: {
      pix_sent: 'Pix enviado - {nome} - {cpf}',
      pix_received: 'Pix recebido - {nome} - {cpf}',
      debit: 'Compra no débito - {estabelecimento}',
      transfer: 'TED Enviada - {destino}',
      invoice: 'Pagamento de fatura Mastercard',
      fee: 'Taxa de serviço',
    }
  },
  bb: {
    bankId: '001',
    bankName: 'BCO DO BRASIL S.A.',
    acctId: '74389',
    branchId: '191',
    patterns: {
      pix_sent: 'PIX TRANSF {nome} CPF:{cpf}',
      pix_received: 'PIX REC {nome} CPF:{cpf}',
      debit: 'COMPRA COM CARTAO - {estabelecimento}',
      transfer: 'DOC/TED ENVIADO - {destino}',
      invoice: 'PGTO FATURA OUROCARD',
      fee: 'TAR PACOTE SERVICOS',
    }
  },
  c6: {
    bankId: '336',
    bankName: 'C6 BANK',
    acctId: '5512847',
    branchId: '0001',
    patterns: {
      pix_sent: 'Pix Enviado - {nome}',
      pix_received: 'Pix Recebido de {nome}',
      debit: 'Débito - {estabelecimento}',
      transfer: 'Transferência para {destino}',
      invoice: 'Pagamento de Fatura C6 Card',
      fee: 'Encargo por serviço',
    }
  }
};

// Dados fictícios
const nomes = [
  'MARIA SILVA SANTOS', 'JOAO CARLOS OLIVEIRA', 'ANA LUCIA FERREIRA',
  'PEDRO HENRIQUE COSTA', 'JULIANA ALMEIDA', 'CARLOS EDUARDO LIMA',
  'FERNANDA RODRIGUES', 'RAFAEL SOUZA', 'PATRICIA GOMES', 'LUCAS MARTINS'
];

const cpfs = [
  '123.456.789-00', '987.654.321-00', '456.789.123-00',
  '789.123.456-00', '321.654.987-00', '654.987.321-00'
];

const estabelecimentos = [
  'SUPERMERCADO EXTRA', 'POSTO IPIRANGA', 'FARMACIA DROGASIL',
  'RESTAURANTE OUTBACK', 'LOJA RENNER', 'MERCADO LIVRE',
  'UBER TRIP', '99 TAXI', 'IFOOD', 'PADARIA SANTA MARIA',
  'DROGARIA SAO PAULO', 'SUBWAY', 'MCDONALDS', 'AMERICANAS'
];

const destinos = [
  'CONTA POUPANCA', 'INVESTIMENTOS', 'TERCEIROS', 'PAGAMENTO FORNECEDOR'
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatCpfPartial(cpf) {
  const parts = cpf.split('.');
  return `***.${parts[1]}.***-**`;
}

function generateFitId() {
  return crypto.randomBytes(8).toString('hex').toUpperCase();
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}120000[-03:BRT]`;
}

function formatDateShort(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function generateDescription(config, type) {
  const template = config.patterns[type];
  if (!template) return 'TRANSACAO';
  
  return template
    .replace('{nome}', randomElement(nomes))
    .replace('{cpf}', formatCpfPartial(randomElement(cpfs)))
    .replace('{estabelecimento}', randomElement(estabelecimentos))
    .replace('{destino}', randomElement(destinos));
}

function generateTransactions(config, numTransactions = 50) {
  const transactions = [];
  const startDate = new Date(2025, 10, 1); // Nov 1, 2025
  const endDate = new Date(2025, 11, 14); // Dec 14, 2025
  
  const types = [
    { type: 'pix_sent', amount: () => -(Math.random() * 500 + 10).toFixed(2) },
    { type: 'pix_received', amount: () => (Math.random() * 1000 + 50).toFixed(2) },
    { type: 'debit', amount: () => -(Math.random() * 200 + 5).toFixed(2) },
    { type: 'transfer', amount: () => -(Math.random() * 2000 + 100).toFixed(2) },
    { type: 'invoice', amount: () => -(Math.random() * 2000 + 500).toFixed(2) },
    { type: 'fee', amount: () => -(Math.random() * 50 + 5).toFixed(2) },
  ];
  
  // Add transfer pairs (internal)
  for (let i = 0; i < 3; i++) {
    const date = new Date(startDate.getTime() + Math.random() * (endDate - startDate));
    const amount = (Math.random() * 500 + 100).toFixed(2);
    
    transactions.push({
      type: 'DEBIT',
      date: formatDate(date),
      dateShort: formatDateShort(date),
      amount: -amount,
      fitId: generateFitId(),
      description: `Transferência para conta própria - ${config.bankName}`
    });
    
    transactions.push({
      type: 'CREDIT',
      date: formatDate(date),
      dateShort: formatDateShort(date),
      amount: amount,
      fitId: generateFitId(),
      description: `Transferência recebida - Conta própria`
    });
  }
  
  // Add regular transactions
  for (let i = 0; i < numTransactions - 6; i++) {
    const date = new Date(startDate.getTime() + Math.random() * (endDate - startDate));
    const txType = randomElement(types);
    const amount = parseFloat(txType.amount());
    
    transactions.push({
      type: amount >= 0 ? 'CREDIT' : 'DEBIT',
      date: formatDate(date),
      dateShort: formatDateShort(date),
      amount: amount,
      fitId: generateFitId(),
      description: generateDescription(config, txType.type)
    });
  }
  
  // Sort by date
  transactions.sort((a, b) => a.dateShort.localeCompare(b.dateShort));
  
  return transactions;
}

function generateOFX(bankKey, transactions) {
  const config = bankConfigs[bankKey];
  const now = new Date();
  const dtserver = formatDate(now);
  
  const stmtTrns = transactions.map(tx => `
<STMTTRN>
<TRNTYPE>${tx.type}
<DTPOSTED>${tx.date}
<TRNAMT>${tx.amount}
<FITID>${tx.fitId}
<MEMO>${tx.description}
</STMTTRN>`).join('');

  return `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>${dtserver}
<LANGUAGE>POR
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>BRL
<BANKACCTFROM>
<BANKID>${config.bankId}
<BRANCHID>${config.branchId}
<ACCTID>${config.acctId}
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20251101120000[-03:BRT]
<DTEND>20251214120000[-03:BRT]
${stmtTrns}
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5000.00
<DTASOF>${dtserver}
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;
}

// Generate files
const outputDir = './synthetic-ofx';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

for (const bankKey of Object.keys(bankConfigs)) {
  const config = bankConfigs[bankKey];
  const transactions = generateTransactions(config, 50);
  const ofxContent = generateOFX(bankKey, transactions);
  
  const filename = `${outputDir}/${bankKey.toUpperCase()}_SYNTHETIC_NOV_DEZ_2025.ofx`;
  fs.writeFileSync(filename, ofxContent);
  
  console.log(`Generated: ${filename} (${transactions.length} transactions)`);
  
  // Print summary
  const credits = transactions.filter(t => t.type === 'CREDIT');
  const debits = transactions.filter(t => t.type === 'DEBIT');
  const pairs = transactions.filter(t => t.description.toLowerCase().includes('conta própria'));
  const invoices = transactions.filter(t => t.description.toLowerCase().includes('fatura'));
  const fees = transactions.filter(t => 
    t.description.toLowerCase().includes('taxa') || 
    t.description.toLowerCase().includes('tarifa') ||
    t.description.toLowerCase().includes('encargo')
  );
  
  console.log(`  - Credits: ${credits.length}, Debits: ${debits.length}`);
  console.log(`  - Transfer pairs: ${pairs.length / 2}`);
  console.log(`  - Invoice payments: ${invoices.length}`);
  console.log(`  - Fees: ${fees.length}`);
  console.log('');
}

console.log('All synthetic OFX files generated!');
