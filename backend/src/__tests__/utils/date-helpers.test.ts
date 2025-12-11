/**
 * Testes para date-helpers
 * Verifica tratamento de dueDay > dias do mês
 */

import {
  getLastDayOfMonth,
  getSafeDueDate,
  getNextDueDate,
  generateDueDates,
  isSameDay,
  diffInDays,
} from '../../utils/date-helpers';

describe('date-helpers', () => {
  describe('getLastDayOfMonth', () => {
    it('deve retornar 31 para Janeiro', () => {
      expect(getLastDayOfMonth(2025, 0)).toBe(31); // Janeiro
    });

    it('deve retornar 28 para Fevereiro em ano não-bissexto', () => {
      expect(getLastDayOfMonth(2025, 1)).toBe(28); // Fevereiro 2025
    });

    it('deve retornar 29 para Fevereiro em ano bissexto', () => {
      expect(getLastDayOfMonth(2024, 1)).toBe(29); // Fevereiro 2024
    });

    it('deve retornar 30 para Abril', () => {
      expect(getLastDayOfMonth(2025, 3)).toBe(30); // Abril
    });
  });

  describe('getSafeDueDate', () => {
    it('deve retornar a data correta quando dueDay é válido', () => {
      const date = getSafeDueDate(2025, 0, 15); // 15 de Janeiro
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('deve ajustar dueDay 31 para 28 em Fevereiro não-bissexto', () => {
      const date = getSafeDueDate(2025, 1, 31); // Fevereiro 2025, dueDay 31
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(1);
      expect(date.getDate()).toBe(28); // Último dia de Fevereiro
    });

    it('deve ajustar dueDay 31 para 29 em Fevereiro bissexto', () => {
      const date = getSafeDueDate(2024, 1, 31); // Fevereiro 2024, dueDay 31
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(1);
      expect(date.getDate()).toBe(29); // Último dia de Fevereiro bissexto
    });

    it('deve ajustar dueDay 31 para 30 em Abril', () => {
      const date = getSafeDueDate(2025, 3, 31); // Abril 2025, dueDay 31
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(3);
      expect(date.getDate()).toBe(30); // Último dia de Abril
    });

    it('deve manter dueDay 31 em Janeiro', () => {
      const date = getSafeDueDate(2025, 0, 31); // Janeiro 2025, dueDay 31
      expect(date.getDate()).toBe(31);
    });
  });

  describe('getNextDueDate', () => {
    describe('frequency: monthly', () => {
      it('deve calcular próximo mês corretamente', () => {
        const base = new Date(2025, 0, 15); // 15 de Janeiro
        const next = getNextDueDate(base, 'monthly', 15, 1);
        expect(next.getMonth()).toBe(1); // Fevereiro
        expect(next.getDate()).toBe(15);
      });

      it('deve ajustar dueDay quando mês seguinte tem menos dias', () => {
        const base = new Date(2025, 0, 31); // 31 de Janeiro
        const next = getNextDueDate(base, 'monthly', 31, 1);
        expect(next.getMonth()).toBe(1); // Fevereiro
        expect(next.getDate()).toBe(28); // Ajustado para último dia
      });

      it('deve calcular 3 meses à frente', () => {
        const base = new Date(2025, 0, 15); // 15 de Janeiro
        const next = getNextDueDate(base, 'monthly', 15, 3);
        expect(next.getMonth()).toBe(3); // Abril
        expect(next.getDate()).toBe(15);
      });

      it('deve lidar com virada de ano', () => {
        const base = new Date(2025, 10, 15); // 15 de Novembro
        const next = getNextDueDate(base, 'monthly', 15, 3);
        expect(next.getFullYear()).toBe(2026);
        expect(next.getMonth()).toBe(1); // Fevereiro
      });
    });

    describe('frequency: weekly', () => {
      it('deve calcular próxima semana', () => {
        const base = new Date(2025, 0, 1); // 1 de Janeiro
        const next = getNextDueDate(base, 'weekly', 1, 1);
        expect(next.getDate()).toBe(8);
      });

      it('deve calcular 4 semanas à frente', () => {
        const base = new Date(2025, 0, 1);
        const next = getNextDueDate(base, 'weekly', 1, 4);
        expect(next.getDate()).toBe(29);
      });
    });

    describe('frequency: yearly', () => {
      it('deve calcular próximo ano', () => {
        const base = new Date(2025, 5, 15); // 15 de Junho
        const next = getNextDueDate(base, 'yearly', 15, 1);
        expect(next.getFullYear()).toBe(2026);
        expect(next.getMonth()).toBe(5);
      });
    });
  });

  describe('generateDueDates', () => {
    it('deve gerar 3 datas mensais', () => {
      const start = new Date(2025, 0, 15);
      const dates = generateDueDates(start, 'monthly', 15, 3);
      
      expect(dates).toHaveLength(3);
      expect(dates[0].getMonth()).toBe(0); // Janeiro
      expect(dates[1].getMonth()).toBe(1); // Fevereiro
      expect(dates[2].getMonth()).toBe(2); // Março
    });

    it('deve ajustar dueDay 31 em sequência de meses', () => {
      const start = new Date(2025, 0, 31); // 31 de Janeiro
      const dates = generateDueDates(start, 'monthly', 31, 4);
      
      expect(dates[0].getDate()).toBe(31); // Janeiro = 31
      expect(dates[1].getDate()).toBe(28); // Fevereiro = 28
      expect(dates[2].getDate()).toBe(31); // Março = 31
      expect(dates[3].getDate()).toBe(30); // Abril = 30
    });
  });

  describe('isSameDay', () => {
    it('deve retornar true para mesma data', () => {
      const d1 = new Date(2025, 0, 15, 10, 30);
      const d2 = new Date(2025, 0, 15, 18, 45);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it('deve retornar false para datas diferentes', () => {
      const d1 = new Date(2025, 0, 15);
      const d2 = new Date(2025, 0, 16);
      expect(isSameDay(d1, d2)).toBe(false);
    });
  });

  describe('diffInDays', () => {
    it('deve retornar 0 para mesmo dia', () => {
      const d1 = new Date(2025, 0, 15, 10, 0);
      const d2 = new Date(2025, 0, 15, 18, 0);
      expect(diffInDays(d1, d2)).toBe(0);
    });

    it('deve retornar positivo quando date1 > date2 (atrasado)', () => {
      const d1 = new Date(2025, 0, 20); // Pagamento
      const d2 = new Date(2025, 0, 15); // Vencimento
      expect(diffInDays(d1, d2)).toBe(5); // 5 dias atrasado
    });

    it('deve retornar negativo quando date1 < date2 (antecipado)', () => {
      const d1 = new Date(2025, 0, 10); // Pagamento
      const d2 = new Date(2025, 0, 15); // Vencimento
      expect(diffInDays(d1, d2)).toBe(-5); // 5 dias antecipado
    });
  });
});
