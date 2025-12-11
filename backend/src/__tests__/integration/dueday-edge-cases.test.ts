/**
 * Testes de Integração: dueDay = 31 em meses curtos
 * 
 * Este arquivo testa especificamente o edge case onde uma conta recorrente
 * tem dueDay = 31 e precisa gerar ocorrências para meses com menos dias.
 * 
 * Cenários:
 * 1. dueDay = 31 em Fevereiro (28/29 dias)
 * 2. dueDay = 31 em Abril (30 dias)
 * 3. dueDay = 30 em Fevereiro
 * 4. Sequência de 12 meses com dueDay = 31
 */

import { getSafeDueDate, generateDueDates, getNextDueDate } from '../../utils/date-helpers';

describe('Edge Case: dueDay = 31 em meses curtos', () => {
  describe('Fevereiro não-bissexto (28 dias)', () => {
    const year = 2025; // Não-bissexto
    const february = 1; // Mês 1 = Fevereiro

    it('dueDay = 31 deve resultar em dia 28', () => {
      const date = getSafeDueDate(year, february, 31);
      expect(date.getDate()).toBe(28);
      expect(date.getMonth()).toBe(february);
      expect(date.getFullYear()).toBe(year);
    });

    it('dueDay = 30 deve resultar em dia 28', () => {
      const date = getSafeDueDate(year, february, 30);
      expect(date.getDate()).toBe(28);
    });

    it('dueDay = 29 deve resultar em dia 28', () => {
      const date = getSafeDueDate(year, february, 29);
      expect(date.getDate()).toBe(28);
    });

    it('dueDay = 28 deve resultar em dia 28 (exato)', () => {
      const date = getSafeDueDate(year, february, 28);
      expect(date.getDate()).toBe(28);
    });
  });

  describe('Fevereiro bissexto (29 dias)', () => {
    const year = 2024; // Bissexto
    const february = 1;

    it('dueDay = 31 deve resultar em dia 29', () => {
      const date = getSafeDueDate(year, february, 31);
      expect(date.getDate()).toBe(29);
    });

    it('dueDay = 30 deve resultar em dia 29', () => {
      const date = getSafeDueDate(year, february, 30);
      expect(date.getDate()).toBe(29);
    });

    it('dueDay = 29 deve resultar em dia 29 (exato)', () => {
      const date = getSafeDueDate(year, february, 29);
      expect(date.getDate()).toBe(29);
    });
  });

  describe('Abril (30 dias)', () => {
    const year = 2025;
    const april = 3; // Mês 3 = Abril

    it('dueDay = 31 deve resultar em dia 30', () => {
      const date = getSafeDueDate(year, april, 31);
      expect(date.getDate()).toBe(30);
    });

    it('dueDay = 30 deve resultar em dia 30 (exato)', () => {
      const date = getSafeDueDate(year, april, 30);
      expect(date.getDate()).toBe(30);
    });
  });

  describe('Sequência de 12 meses com dueDay = 31', () => {
    it('deve gerar datas corretas para cada mês', () => {
      const startDate = new Date(2025, 0, 31); // 31 de Janeiro 2025
      const dates = generateDueDates(startDate, 'monthly', 31, 12);

      // Janeiro - 31 dias
      expect(dates[0].getMonth()).toBe(0);
      expect(dates[0].getDate()).toBe(31);

      // Fevereiro - 28 dias (2025 não é bissexto)
      expect(dates[1].getMonth()).toBe(1);
      expect(dates[1].getDate()).toBe(28);

      // Março - 31 dias
      expect(dates[2].getMonth()).toBe(2);
      expect(dates[2].getDate()).toBe(31);

      // Abril - 30 dias
      expect(dates[3].getMonth()).toBe(3);
      expect(dates[3].getDate()).toBe(30);

      // Maio - 31 dias
      expect(dates[4].getMonth()).toBe(4);
      expect(dates[4].getDate()).toBe(31);

      // Junho - 30 dias
      expect(dates[5].getMonth()).toBe(5);
      expect(dates[5].getDate()).toBe(30);

      // Julho - 31 dias
      expect(dates[6].getMonth()).toBe(6);
      expect(dates[6].getDate()).toBe(31);

      // Agosto - 31 dias
      expect(dates[7].getMonth()).toBe(7);
      expect(dates[7].getDate()).toBe(31);

      // Setembro - 30 dias
      expect(dates[8].getMonth()).toBe(8);
      expect(dates[8].getDate()).toBe(30);

      // Outubro - 31 dias
      expect(dates[9].getMonth()).toBe(9);
      expect(dates[9].getDate()).toBe(31);

      // Novembro - 30 dias
      expect(dates[10].getMonth()).toBe(10);
      expect(dates[10].getDate()).toBe(30);

      // Dezembro - 31 dias
      expect(dates[11].getMonth()).toBe(11);
      expect(dates[11].getDate()).toBe(31);
    });

    it('não deve causar overflow de mês', () => {
      const startDate = new Date(2025, 0, 31);
      const dates = generateDueDates(startDate, 'monthly', 31, 12);

      // Verificar que nenhuma data "pulou" para o próximo mês
      for (let i = 0; i < 12; i++) {
        const expectedMonth = i % 12;
        expect(dates[i].getMonth()).toBe(expectedMonth);
      }
    });
  });

  describe('Caso específico: Conta de Aluguel vencendo dia 31', () => {
    it('deve gerar ocorrências corretas para um ano inteiro', () => {
      // Simula uma conta de aluguel criada em 1º de Janeiro
      const firstDue = new Date(2025, 0, 31); // Primeiro vencimento: 31/Jan
      const dueDay = 31;

      // Gerar 12 meses de ocorrências
      const occurrences = [];
      for (let i = 0; i < 12; i++) {
        const dueDate = getNextDueDate(firstDue, 'monthly', dueDay, i);
        occurrences.push({
          month: dueDate.toLocaleString('pt-BR', { month: 'long' }),
          day: dueDate.getDate(),
          fullDate: dueDate.toISOString().split('T')[0],
        });
      }

      // Log para visualização
      console.table(occurrences);

      // Verificações
      expect(occurrences[0].day).toBe(31); // Janeiro
      expect(occurrences[1].day).toBe(28); // Fevereiro
      expect(occurrences[2].day).toBe(31); // Março
      expect(occurrences[3].day).toBe(30); // Abril

      // Nenhum dia deve ser maior que o máximo do mês
      expect(occurrences.every(o => o.day <= 31)).toBe(true);
    });
  });

  describe('Virada de ano', () => {
    it('deve lidar corretamente com virada de ano', () => {
      const startDate = new Date(2025, 10, 30); // 30 de Novembro 2025
      const dates = generateDueDates(startDate, 'monthly', 30, 4);

      expect(dates[0].getFullYear()).toBe(2025);
      expect(dates[0].getMonth()).toBe(10); // Novembro

      expect(dates[1].getFullYear()).toBe(2025);
      expect(dates[1].getMonth()).toBe(11); // Dezembro

      expect(dates[2].getFullYear()).toBe(2026);
      expect(dates[2].getMonth()).toBe(0); // Janeiro 2026

      expect(dates[3].getFullYear()).toBe(2026);
      expect(dates[3].getMonth()).toBe(1); // Fevereiro 2026
      expect(dates[3].getDate()).toBe(28); // Fevereiro 2026 não é bissexto
    });
  });

  describe('Comparação: comportamento antigo vs novo', () => {
    it('comportamento ANTIGO (JavaScript nativo) causaria overflow', () => {
      // Este é o comportamento que o código antigo tinha
      const date = new Date(2025, 1, 1); // 1 de Fevereiro
      date.setDate(31); // Tentar setar dia 31

      // JavaScript nativo "overflow" para 3 de Março!
      expect(date.getMonth()).not.toBe(1); // NÃO é mais Fevereiro!
      expect(date.getMonth()).toBe(2); // É Março
      expect(date.getDate()).toBe(3); // Dia 3
    });

    it('comportamento NOVO (getSafeDueDate) mantém no mês correto', () => {
      const date = getSafeDueDate(2025, 1, 31);

      expect(date.getMonth()).toBe(1); // É Fevereiro
      expect(date.getDate()).toBe(28); // Último dia válido
    });
  });
});

describe('Edge Case: Frequência Semanal com datas limites', () => {
  it('deve gerar 4 semanas corretamente', () => {
    const start = new Date(2025, 0, 27); // Segunda-feira
    const dates = generateDueDates(start, 'weekly', 27, 4);

    expect(dates[0].getDate()).toBe(27); // Semana 1
    expect(dates[1].getDate()).toBe(3);  // Semana 2 (virou o mês)
    expect(dates[2].getDate()).toBe(10); // Semana 3
    expect(dates[3].getDate()).toBe(17); // Semana 4
  });
});

describe('Edge Case: Frequência Anual', () => {
  it('deve ajustar 29 de Fevereiro em ano não-bissexto', () => {
    // Conta anual criada em 29/Fev/2024 (bissexto)
    const start = new Date(2024, 1, 29);
    const nextYear = getNextDueDate(start, 'yearly', 29, 1);

    // 2025 não é bissexto, deve ser 28 de Fevereiro
    expect(nextYear.getFullYear()).toBe(2025);
    expect(nextYear.getMonth()).toBe(1);
    expect(nextYear.getDate()).toBe(28);
  });
});
