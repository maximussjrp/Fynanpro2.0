/**
 * Serviço de Perfis de Bancos Brasileiros
 * 
 * Contém configurações específicas para importação de extratos
 * de cada banco, com mapeamento de colunas, formatos de data,
 * e padrões de categorização.
 */

import { ColumnMapping } from './import.service';

// ==================== TIPOS ====================

export interface BankProfile {
  id: string;
  name: string;
  code: string; // Código FEBRABAN
  logo?: string;
  color: string;
  
  // Configurações de importação
  csvConfig: {
    delimiter: string;
    encoding: string;
    skipRows: number; // Linhas para pular no início
    columnMapping: ColumnMapping;
    dateFormats: string[]; // Formatos possíveis
  };
  
  ofxConfig: {
    bankId?: string; // Identificador no OFX
    patterns: string[]; // Padrões para detectar banco
  };
  
  // Padrões de categorização específicos do banco
  categoryPatterns: CategoryPattern[];
}

export interface CategoryPattern {
  pattern: string; // Regex ou string
  isRegex: boolean;
  categoryName: string; // Nome da categoria sugerida
  categoryType: 'income' | 'expense';
  priority: number; // Maior = mais prioritário
}

export interface CategorizationRule {
  id: string;
  tenantId: string;
  pattern: string;
  isRegex: boolean;
  matchType: 'contains' | 'startsWith' | 'endsWith' | 'exact' | 'regex';
  categoryId: string;
  categoryName: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

// ==================== PERFIS DE BANCOS ====================

export const BANK_PROFILES: BankProfile[] = [
  // ==================== NUBANK ====================
  {
    id: 'nubank',
    name: 'Nubank',
    code: '260',
    color: '#820AD1',
    csvConfig: {
      delimiter: ',',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Descrição',
        amount: 'Valor',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD'],
    },
    ofxConfig: {
      bankId: '260',
      patterns: ['NUBANK', 'NU PAGAMENTOS', 'Nu Pagamentos'],
    },
    categoryPatterns: [
      { pattern: 'uber|99|cabify', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 10 },
      { pattern: 'ifood|rappi|zé delivery', isRegex: true, categoryName: 'Alimentação', categoryType: 'expense', priority: 10 },
      { pattern: 'netflix|spotify|amazon prime|disney|hbo|star+', isRegex: true, categoryName: 'Streaming', categoryType: 'expense', priority: 10 },
      { pattern: 'pix recebido|transferencia recebida|ted recebida', isRegex: true, categoryName: 'Transferência Recebida', categoryType: 'income', priority: 10 },
      { pattern: 'pix enviado|transferencia enviada|ted enviada', isRegex: true, categoryName: 'Transferência Enviada', categoryType: 'expense', priority: 10 },
      { pattern: 'pagamento de boleto|boleto', isRegex: true, categoryName: 'Boletos', categoryType: 'expense', priority: 5 },
      { pattern: 'cashback|rendimento', isRegex: true, categoryName: 'Rendimentos', categoryType: 'income', priority: 10 },
    ],
  },
  
  // ==================== ITAÚ ====================
  {
    id: 'itau',
    name: 'Itaú Unibanco',
    code: '341',
    color: '#EC7000',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'data',
        description: 'historico',
        amount: 'valor',
        balance: 'saldo',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY', 'DD/MM/YY'],
    },
    ofxConfig: {
      bankId: '341',
      patterns: ['ITAU', 'ITAÚ', 'ITAU UNIBANCO'],
    },
    categoryPatterns: [
      { pattern: 'tar.*pacote|tarifa', isRegex: true, categoryName: 'Taxas Bancárias', categoryType: 'expense', priority: 10 },
      { pattern: 'rend.*poup|cdb|lci|lca', isRegex: true, categoryName: 'Investimentos', categoryType: 'income', priority: 10 },
      { pattern: 'saldo anterior', isRegex: false, categoryName: 'Saldo', categoryType: 'income', priority: 1 },
      { pattern: 'pagto.*cobranca|pag.*tit', isRegex: true, categoryName: 'Boletos', categoryType: 'expense', priority: 5 },
      { pattern: 'compra.*cartao|cartao de debito', isRegex: true, categoryName: 'Compras', categoryType: 'expense', priority: 5 },
    ],
  },
  
  // ==================== BANCO DO BRASIL ====================
  {
    id: 'bb',
    name: 'Banco do Brasil',
    code: '001',
    color: '#FFED00',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 2, // BB costuma ter cabeçalho extra
      columnMapping: {
        date: 'Data',
        description: 'Histórico',
        amount: 'Valor',
        balance: 'Saldo',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY'],
    },
    ofxConfig: {
      bankId: '001',
      patterns: ['BANCO DO BRASIL', 'BB ', 'BCO BRASIL'],
    },
    categoryPatterns: [
      { pattern: 'salario|folha.*pagto|proventos', isRegex: true, categoryName: 'Salário', categoryType: 'income', priority: 10 },
      { pattern: 'inss|fgts|contribuicao', isRegex: true, categoryName: 'Impostos', categoryType: 'expense', priority: 10 },
      { pattern: 'pix.*recebido', isRegex: true, categoryName: 'PIX Recebido', categoryType: 'income', priority: 10 },
      { pattern: 'pix.*enviado', isRegex: true, categoryName: 'PIX Enviado', categoryType: 'expense', priority: 10 },
    ],
  },
  
  // ==================== BRADESCO ====================
  {
    id: 'bradesco',
    name: 'Bradesco',
    code: '237',
    color: '#CC092F',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Histórico',
        amount: 'Valor',
        balance: 'Saldo',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY', 'DD/MM/YY'],
    },
    ofxConfig: {
      bankId: '237',
      patterns: ['BRADESCO', 'BCO BRADESCO'],
    },
    categoryPatterns: [
      { pattern: 'ted.*enviada|doc.*enviado', isRegex: true, categoryName: 'Transferência Enviada', categoryType: 'expense', priority: 10 },
      { pattern: 'ted.*recebida|doc.*recebido', isRegex: true, categoryName: 'Transferência Recebida', categoryType: 'income', priority: 10 },
      { pattern: 'tarifa|taxa.*manutencao', isRegex: true, categoryName: 'Taxas Bancárias', categoryType: 'expense', priority: 10 },
    ],
  },
  
  // ==================== SANTANDER ====================
  {
    id: 'santander',
    name: 'Santander',
    code: '033',
    color: '#EC0000',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'DATA',
        description: 'DESCRICAO',
        amount: 'VALOR',
        balance: 'SALDO',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY'],
    },
    ofxConfig: {
      bankId: '033',
      patterns: ['SANTANDER', 'BCO SANTANDER'],
    },
    categoryPatterns: [
      { pattern: 'supermercado|mercado|carrefour|extra|pao de acucar', isRegex: true, categoryName: 'Supermercado', categoryType: 'expense', priority: 10 },
      { pattern: 'farmacia|drogaria|raia|drogas', isRegex: true, categoryName: 'Farmácia', categoryType: 'expense', priority: 10 },
      { pattern: 'posto|combustivel|shell|ipiranga|br ', isRegex: true, categoryName: 'Combustível', categoryType: 'expense', priority: 10 },
    ],
  },
  
  // ==================== C6 BANK ====================
  {
    id: 'c6',
    name: 'C6 Bank',
    code: '336',
    color: '#1A1A1A',
    csvConfig: {
      delimiter: ',',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Descrição',
        amount: 'Valor',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD'],
    },
    ofxConfig: {
      bankId: '336',
      patterns: ['C6 BANK', 'C6 ', 'C6BANK'],
    },
    categoryPatterns: [
      { pattern: 'cashback|cb ', isRegex: true, categoryName: 'Cashback', categoryType: 'income', priority: 10 },
      { pattern: 'rendimento.*cdi|juros', isRegex: true, categoryName: 'Rendimentos', categoryType: 'income', priority: 10 },
    ],
  },
  
  // ==================== INTER ====================
  {
    id: 'inter',
    name: 'Banco Inter',
    code: '077',
    color: '#FF7A00',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Descrição',
        amount: 'Valor',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY'],
    },
    ofxConfig: {
      bankId: '077',
      patterns: ['INTER', 'BANCO INTER', 'BCO INTER'],
    },
    categoryPatterns: [
      { pattern: 'marketplace|shop', isRegex: true, categoryName: 'Compras Online', categoryType: 'expense', priority: 10 },
      { pattern: 'cashback|interpag', isRegex: true, categoryName: 'Cashback', categoryType: 'income', priority: 10 },
    ],
  },
  
  // ==================== CAIXA ====================
  {
    id: 'caixa',
    name: 'Caixa Econômica Federal',
    code: '104',
    color: '#005CA9',
    csvConfig: {
      delimiter: ';',
      encoding: 'utf-8',
      skipRows: 1,
      columnMapping: {
        date: 'Data Mov.',
        description: 'Histórico',
        amount: 'Valor',
        balance: 'Saldo',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY'],
    },
    ofxConfig: {
      bankId: '104',
      patterns: ['CAIXA', 'CEF', 'CAIXA ECONOMICA'],
    },
    categoryPatterns: [
      { pattern: 'fgts|seguro.*desemprego', isRegex: true, categoryName: 'Benefícios', categoryType: 'income', priority: 10 },
      { pattern: 'loteria|loterica|mega.*sena', isRegex: true, categoryName: 'Loteria', categoryType: 'expense', priority: 10 },
      { pattern: 'habitacao|financiamento', isRegex: true, categoryName: 'Financiamento', categoryType: 'expense', priority: 10 },
    ],
  },
  
  // ==================== PICPAY ====================
  {
    id: 'picpay',
    name: 'PicPay',
    code: '380',
    color: '#21C25E',
    csvConfig: {
      delimiter: ',',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Descrição',
        amount: 'Valor',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY', 'YYYY-MM-DD'],
    },
    ofxConfig: {
      bankId: '380',
      patterns: ['PICPAY', 'PIC PAY'],
    },
    categoryPatterns: [
      { pattern: 'cashback', isRegex: false, categoryName: 'Cashback', categoryType: 'income', priority: 10 },
      { pattern: 'pagamento.*conta|boleto', isRegex: true, categoryName: 'Boletos', categoryType: 'expense', priority: 10 },
      { pattern: 'recarga.*celular', isRegex: true, categoryName: 'Celular', categoryType: 'expense', priority: 10 },
    ],
  },
  
  // ==================== NEON ====================
  {
    id: 'neon',
    name: 'Neon',
    code: '655',
    color: '#00D9FF',
    csvConfig: {
      delimiter: ',',
      encoding: 'utf-8',
      skipRows: 0,
      columnMapping: {
        date: 'Data',
        description: 'Descrição',
        amount: 'Valor',
        dateFormat: 'DD/MM/YYYY',
      },
      dateFormats: ['DD/MM/YYYY'],
    },
    ofxConfig: {
      bankId: '655',
      patterns: ['NEON', 'BCO NEON'],
    },
    categoryPatterns: [
      { pattern: 'objetivo|cofre', isRegex: true, categoryName: 'Poupança', categoryType: 'expense', priority: 10 },
      { pattern: 'saque', isRegex: false, categoryName: 'Saque', categoryType: 'expense', priority: 10 },
    ],
  },
];

// ==================== PADRÕES DE CATEGORIZAÇÃO GLOBAIS ====================

export const GLOBAL_CATEGORY_PATTERNS: CategoryPattern[] = [
  // ==================== ALIMENTAÇÃO ====================
  // Supermercados e Atacados
  { pattern: 'mercado|supermercado|carrefour|extra|pao de acucar|atacadao|assai|big|walmart|hiper|hipermercado|deposito|atacarejo', isRegex: true, categoryName: 'Alimentação', categoryType: 'expense', priority: 8 },
  
  // Restaurantes, Bares, Padarias
  { pattern: 'restaurante|lanchonete|padaria|panificadora|cafeteria|pizzaria|hamburgueria|sushi|churrascaria|bar e restaurante|bar da|boteco|espetinho|espeto|self.*service|buffet|rodizio', isRegex: true, categoryName: 'Alimentação', categoryType: 'expense', priority: 8 },
  
  // Açougues e Frigoríficos
  { pattern: 'acougue|açougue|frigorifico|carnes|bovinos|suinos|novo boi|casa de carnes', isRegex: true, categoryName: 'Alimentação', categoryType: 'expense', priority: 8 },
  
  // Delivery
  { pattern: 'ifood|rappi|uber.*eats|zé delivery|aiqfome|james', isRegex: true, categoryName: 'Alimentação', categoryType: 'expense', priority: 9 },
  
  // ==================== LAZER & ENTRETENIMENTO ====================
  // Bebidas - Cervejas, Adegas, Bebidas
  { pattern: 'cervejaria|cerveja|adega|distribuidora.*bebidas|bebidas|choperia|chopp|bar.*praia|lounge|pub|emporio.*bebidas', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 8 },
  
  // Festas e Eventos
  { pattern: 'festa|serv.*festa|buffet.*festa|decoracao|eventos|baloes|casamento|formatura|aniversario', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 8 },
  
  // Streaming e Digital
  { pattern: 'netflix', isRegex: false, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'spotify', isRegex: false, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'amazon.*prime|prime.*video', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'disney|star\\+|staplus', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'hbo.*max|max\\.com', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'globoplay', isRegex: false, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'youtube.*premium|youtube.*music', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 10 },
  { pattern: 'steam|playstation|xbox|nintendo|epic.*games|twitch|blizzard', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 8 },
  { pattern: 'cinema|cinemark|uci|kinoplex|teatro|show|ingresso', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 8 },
  
  // ==================== TRANSPORTE ====================
  // Apps de Transporte
  { pattern: 'uber(?!.*eats)|99|cabify|indriver|lyft|99pop|99taxi', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 9 },
  
  // Combustível e Postos
  { pattern: 'combustivel|gasolina|etanol|diesel|posto|shell|ipiranga|br distribuidora|petrobras|graal|rodoviaria|auto.*posto|abastecimento', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  
  // Estacionamento
  { pattern: 'estacionamento|parking|estapar|zona azul|vaga|garagem', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  
  // Pedágio
  { pattern: 'pedagio|autoban|ccr|ecovias|arteris|sem.*parar|conectcar|veloe|move.*mais', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  
  // Transporte Público e Aeroporto
  { pattern: 'metro|bilhete.*unico|sptrans|cptm|onibus|passagem|brt', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  { pattern: 'aeroporto|galeao|guarulhos|congonhas|viracopos|gig|gru|bsb|confins', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  { pattern: 'passagem.*aerea|gol linhas|latam|azul|avianca|american.*air|tap|emirates', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  
  // Veículo
  { pattern: 'ipva|licenciamento|detran|dpvat|multa|cnh|habilitacao', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 9 },
  { pattern: 'mecanica|oficina|borracharia|pneu|troca.*oleo|revisao|conserto.*carro|funilaria|lavagem|lava.*jato|polimento', isRegex: true, categoryName: 'Transporte', categoryType: 'expense', priority: 8 },
  
  // ==================== MORADIA ====================
  { pattern: 'aluguel|locacao|imobiliaria', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'condominio|condominial', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'iptu', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'enel|cemig|eletropaulo|cpfl|copel|celesc|coelba|light|energisa|eletrobras|celpe|energia.*eletrica', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'sabesp|copasa|sanepar|corsan|cedae|embasa|saneago|casan|agua.*esgoto', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'comgas|naturgy|gas natural|ceg|ultragaz|supergasbrás|liquigas', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 10 },
  { pattern: 'material.*construcao|leroy.*merlin|telhanorte|c&c|casa.*show|obra|pedreiro|eletricista|encanador', isRegex: true, categoryName: 'Moradia', categoryType: 'expense', priority: 7 },
  
  // ==================== SAÚDE ====================
  { pattern: 'farmacia|drogaria|raia|drogasil|pacheco|pague.*menos|sao.*joao|panvel|drogaraia|droga.*raia|drogarias', isRegex: true, categoryName: 'Saúde', categoryType: 'expense', priority: 8 },
  { pattern: 'hospital|clinica|medico|consulta|exame|laboratorio|fleury|dasa|hermes.*pardini|cura|diagnostico', isRegex: true, categoryName: 'Saúde', categoryType: 'expense', priority: 8 },
  { pattern: 'unimed|amil|sulamerica|bradesco.*saude|notre.*dame|hapvida|prevent|golden.*cross|saude.*plano', isRegex: true, categoryName: 'Saúde', categoryType: 'expense', priority: 10 },
  { pattern: 'odonto|dentista|dental|ortodontia|implante', isRegex: true, categoryName: 'Saúde', categoryType: 'expense', priority: 8 },
  { pattern: 'psicolog|terapia|psiqu|tratamento', isRegex: true, categoryName: 'Saúde', categoryType: 'expense', priority: 8 },
  
  // ==================== EDUCAÇÃO ====================
  { pattern: 'escola|colegio|faculdade|universidade|curso|udemy|alura|coursera|centro.*educacional|educacao|ensino|aula', isRegex: true, categoryName: 'Educação', categoryType: 'expense', priority: 8 },
  { pattern: 'livro|livraria|saraiva|amazon.*book|kindle|apostila|material.*escolar', isRegex: true, categoryName: 'Educação', categoryType: 'expense', priority: 7 },
  
  // ==================== VESTUÁRIO & BELEZA ====================
  { pattern: 'renner|riachuelo|c&a|zara|forever.*21|marisa|hering|cea|centauro|netshoes|dafiti', isRegex: true, categoryName: 'Vestuário & Beleza', categoryType: 'expense', priority: 8 },
  { pattern: 'salao|cabeleireiro|barbearia|manicure|estetica|spa|maquiagem|cosmetico|perfumaria|boticario|natura|avon', isRegex: true, categoryName: 'Vestuário & Beleza', categoryType: 'expense', priority: 8 },
  
  // ==================== CONTAS & SERVIÇOS ====================
  { pattern: 'vivo|tim|claro|oi|nextel|telefonica|celular|internet|fibra|banda.*larga', isRegex: true, categoryName: 'Contas & Serviços', categoryType: 'expense', priority: 10 },
  { pattern: 'net|sky|directv|tv.*assinatura', isRegex: true, categoryName: 'Contas & Serviços', categoryType: 'expense', priority: 10 },
  { pattern: 'fatura.*cartao|cartao.*credito|pagamento.*fatura|anuidade|taxa.*cartao', isRegex: true, categoryName: 'Contas & Serviços', categoryType: 'expense', priority: 10 },
  { pattern: 'tarifa|taxa.*manutencao|iof|juros|multa.*atraso', isRegex: true, categoryName: 'Contas & Serviços', categoryType: 'expense', priority: 8 },
  
  // ==================== PETS ====================
  { pattern: 'pet.*shop|petshop|petz|cobasi|veterinario|vet|racao|cao|gato|animal', isRegex: true, categoryName: 'Pets', categoryType: 'expense', priority: 8 },
  
  // ==================== FAMÍLIA ====================
  { pattern: 'bebe|fraldas|mamadeira|creche|baba|brinquedo|infantil', isRegex: true, categoryName: 'Família', categoryType: 'expense', priority: 8 },
  
  // ==================== INVESTIMENTOS & POUPANÇA (Despesa) ====================
  { pattern: 'emprestimo|financiamento|parcela.*emprestimo|credito.*pessoal|consignado', isRegex: true, categoryName: 'Investimentos & Poupança', categoryType: 'expense', priority: 10 },
  
  // ==================== COMPRAS ONLINE / OUTROS ====================
  { pattern: 'amazon|mercado.*livre|magalu|magazine.*luiza|americanas|submarino|shopee|aliexpress|shein|wish', isRegex: true, categoryName: 'Outros', categoryType: 'expense', priority: 6 },
  { pattern: 'kabum|pichau|terabyte|dell|lenovo|samsung|apple|huawei', isRegex: true, categoryName: 'Outros', categoryType: 'expense', priority: 7 },
  { pattern: 'adyen|pagseguro|mercado.*pago|picpay|paypal|stripe|getnet|cielo|rede|stone', isRegex: true, categoryName: 'Outros', categoryType: 'expense', priority: 5 },
  
  // ==================== VIAGEM ====================
  { pattern: 'hotel|airbnb|booking|hostel|pousada|resort|hospedagem', isRegex: true, categoryName: 'Lazer & Entretenimento', categoryType: 'expense', priority: 8 },
  
  // ==================== RECEITAS ====================
  { pattern: 'pix.*recebido|recebeu.*pix|transferencia.*recebida|ted.*cr|doc.*cr|deposito.*recebido|credito.*conta', isRegex: true, categoryName: 'Outros Recebimentos', categoryType: 'income', priority: 7 },
  { pattern: 'salario|folha.*pagamento|proventos|holerite|ferias|13.*salario|decimo.*terceiro|adiantamento', isRegex: true, categoryName: 'Salário & Rendimentos', categoryType: 'income', priority: 10 },
  { pattern: 'rendimento|juros|dividendos|cdi|cdb|lci|lca|tesouro|aplicacao|renda.*fixa', isRegex: true, categoryName: 'Investimentos', categoryType: 'income', priority: 9 },
  { pattern: 'cashback|pontos|bonus|rewards|reembolso|estorno', isRegex: true, categoryName: 'Renda Extra', categoryType: 'income', priority: 8 },
  { pattern: 'venda|recebimento|cliente|fatura.*recebida|duplicata', isRegex: true, categoryName: 'Outros Recebimentos', categoryType: 'income', priority: 6 },
];

// ==================== CLASSE DO SERVIÇO ====================

export class BankProfileService {
  
  /**
   * Buscar perfil de banco pelo nome do arquivo ou conteúdo OFX
   */
  detectBankFromFileName(fileName: string): BankProfile | null {
    const nameLower = fileName.toLowerCase();
    
    for (const bank of BANK_PROFILES) {
      // Checar pelo nome do banco no arquivo
      if (nameLower.includes(bank.id) || nameLower.includes(bank.name.toLowerCase())) {
        return bank;
      }
      
      // Checar por código
      if (nameLower.includes(bank.code)) {
        return bank;
      }
    }
    
    return null;
  }
  
  /**
   * Detectar banco a partir do conteúdo OFX
   */
  detectBankFromOFX(content: string): BankProfile | null {
    const contentUpper = content.toUpperCase();
    
    for (const bank of BANK_PROFILES) {
      // Checar BANKID no OFX
      const bankIdMatch = content.match(/<BANKID>(\d+)/i);
      if (bankIdMatch && bankIdMatch[1] === bank.code) {
        return bank;
      }
      
      // Checar ORG ou outros campos
      for (const pattern of bank.ofxConfig.patterns) {
        if (contentUpper.includes(pattern.toUpperCase())) {
          return bank;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Detectar banco a partir do conteúdo CSV
   */
  detectBankFromCSV(content: string, fileName: string): BankProfile | null {
    // Primeiro tentar pelo nome do arquivo
    const fromName = this.detectBankFromFileName(fileName);
    if (fromName) return fromName;
    
    // Analisar estrutura do CSV
    const firstLine = content.split('\n')[0].toLowerCase();
    
    for (const bank of BANK_PROFILES) {
      const mapping = bank.csvConfig.columnMapping;
      
      // Checar se os cabeçalhos esperados existem
      const dateCol = String(mapping.date).toLowerCase();
      const descCol = String(mapping.description).toLowerCase();
      
      if (firstLine.includes(dateCol) && firstLine.includes(descCol)) {
        return bank;
      }
    }
    
    return null;
  }
  
  /**
   * Aplicar categorização inteligente baseada em padrões do banco + globais
   */
  suggestCategoryFromPatterns(
    description: string,
    type: 'income' | 'expense',
    bankProfile?: BankProfile | null
  ): { categoryName: string; confidence: number } | null {
    const descLower = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Coletar todos os padrões aplicáveis
    let patterns: CategoryPattern[] = [...GLOBAL_CATEGORY_PATTERNS];
    
    if (bankProfile) {
      // Adicionar padrões específicos do banco com prioridade maior
      patterns = [
        ...bankProfile.categoryPatterns.map(p => ({ ...p, priority: p.priority + 5 })),
        ...patterns,
      ];
    }
    
    // Filtrar por tipo
    patterns = patterns.filter(p => p.categoryType === type);
    
    // Ordenar por prioridade
    patterns.sort((a, b) => b.priority - a.priority);
    
    // Buscar match
    for (const pattern of patterns) {
      const matched = pattern.isRegex
        ? new RegExp(pattern.pattern, 'i').test(descLower)
        : descLower.includes(pattern.pattern.toLowerCase());
      
      if (matched) {
        return {
          categoryName: pattern.categoryName,
          confidence: pattern.priority / 10, // Normalizar para 0-1
        };
      }
    }
    
    return null;
  }
  
  /**
   * Obter todos os perfis de bancos disponíveis
   */
  getAllProfiles(): BankProfile[] {
    return BANK_PROFILES;
  }
  
  /**
   * Obter perfil por ID
   */
  getProfileById(id: string): BankProfile | null {
    return BANK_PROFILES.find(b => b.id === id) || null;
  }
  
  /**
   * Obter perfil por código FEBRABAN
   */
  getProfileByCode(code: string): BankProfile | null {
    return BANK_PROFILES.find(b => b.code === code) || null;
  }
}

// Exportar instância singleton
export const bankProfileService = new BankProfileService();
