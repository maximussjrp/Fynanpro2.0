import '../setup';
import {
  inferPaymentFromText,
  parseBrazilDateToken,
  parseTransactionIntentFromText,
} from '../../services/chatbot.service';

describe('chatbot natural transaction parser', () => {
  it('extrai despesa completa com pagamento, conta e data relativa', () => {
    const parsed = parseTransactionIntentFromText('paguei 80 no pix da padaria pelo Nubank ontem');

    expect(parsed).toEqual({
      type: 'expense',
      amount: 80,
      description: 'padaria',
      date: expect.any(String),
    });
    expect(inferPaymentFromText('paguei 80 no pix da padaria')).toEqual({
      type: 'pix',
      name: 'PIX',
    });
  });

  it('preserva descricoes comuns com preposicao, como no mercado', () => {
    const parsed = parseTransactionIntentFromText('gastei 50 no mercado');

    expect(parsed?.type).toBe('expense');
    expect(parsed?.amount).toBe(50);
    expect(parsed?.description).toBe('mercado');
  });

  it('interpreta datas relativas a partir de uma data base', () => {
    const base = new Date('2026-06-04T12:00:00');

    expect(parseBrazilDateToken('hoje', base)).toBe('2026-06-04');
    expect(parseBrazilDateToken('ontem', base)).toBe('2026-06-03');
    expect(parseBrazilDateToken('anteontem', base)).toBe('2026-06-02');
  });
});
