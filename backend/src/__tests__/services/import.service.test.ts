import { mockPrisma } from '../setup';
import { importService } from '../../services/import.service';
import { transactionService } from '../../services/transaction.service';

describe('import.service', () => {
  const ofxContent = `
<OFX>
  <BANKTRANLIST>
    <STMTTRN>
      <DTPOSTED>20260513
      <TRNAMT>-10.00
      <FITID>fit-1
      <NAME>Padaria Central
    </STMTTRN>
  </BANKTRANLIST>
</OFX>`;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockPrisma.transaction.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.category.findFirst as jest.Mock).mockResolvedValue(null);
  });

  it('nao duplica saldo ao confirmar item ja importado com mesma chave externa', async () => {
    (mockPrisma.transaction.findFirst as jest.Mock).mockResolvedValue(null);

    const preview = await importService.createOFXPreview(
      'tenant-123',
      'user-123',
      'extrato.ofx',
      ofxContent
    );

    (mockPrisma.import.create as jest.Mock).mockResolvedValue({ id: 'import-1' });
    (mockPrisma.import.update as jest.Mock).mockResolvedValue({});
    (mockPrisma.transaction.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-tx' });

    const result = await importService.confirmImport(
      'tenant-123',
      'user-123',
      preview.id,
      'bank-123'
    );

    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('desfaz importacao removendo cada transacao pelo delete financeiro central', async () => {
    (mockPrisma.import.findFirst as jest.Mock).mockResolvedValue({ id: 'import-1' });
    (mockPrisma.transaction.findMany as jest.Mock).mockResolvedValue([
      { id: 'tx-1' },
      { id: 'tx-2' },
    ]);
    (mockPrisma.import.update as jest.Mock).mockResolvedValue({});

    const deleteSpy = jest.spyOn(transactionService, 'delete').mockResolvedValue({
      deletedCount: 1,
      hasPaidTransactions: false,
    });

    const deleted = await importService.undoImport('tenant-123', 'import-1');

    expect(deleted).toBe(2);
    expect(deleteSpy).toHaveBeenNthCalledWith(1, 'tx-1', 'tenant-123', false, 'all');
    expect(deleteSpy).toHaveBeenNthCalledWith(2, 'tx-2', 'tenant-123', false, 'all');
  });
});
