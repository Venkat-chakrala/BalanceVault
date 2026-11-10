import request from 'supertest';
import app from '../app';
import prisma from '../prisma/client';
import { LedgerService } from '../services/ledger.service';

describe('Verifiable Ledger & Cryptographic Integrity Tests', () => {
  let auditorToken = '';

  beforeAll(async () => {
    const auditorRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auditor@balancevault.com', password: 'AuditorPassword@123' });
    auditorToken = auditorRes.body.data.token;
  });

  it('should verify that all double-entry ledger records strictly balance (Debits == Credits)', async () => {
    // For every completed transaction, the sum of debits must equal the sum of credits
    const transactions = await prisma.transaction.findMany({
      where: { type: 'TRANSFER' },
      include: { entries: true },
    });

    for (const tx of transactions) {
      const debits = tx.entries
        .filter((e) => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + e.amount, 0);

      const credits = tx.entries
        .filter((e) => e.entryType === 'CREDIT')
        .reduce((sum, e) => sum + e.amount, 0);

      expect(debits).toBe(credits);
      expect(debits).toBe(tx.amount);
    }
  });

  it('should successfully verify the valid cryptographic SHA-256 hash chain', async () => {
    const res = await request(app)
      .get('/api/admin/ledger/verify')
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isValid).toBe(true);
    expect(res.body.data.totalBlocks).toBeGreaterThan(0);
  });

  it('should generate a cryptographic proof receipt for a valid transaction', async () => {
    const tx = await prisma.transaction.findFirst({
      where: { type: 'TRANSFER' },
    });

    const res = await request(app)
      .get(`/api/transfers/proof/${tx!.reference}`)
      .set('Authorization', `Bearer ${auditorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reference).toBe(tx!.reference);
    expect(res.body.data.doubleEntry.balanced).toBe(true);
    expect(res.body.data.cryptographicProof.blockHash).toBeDefined();
    expect(res.body.data.cryptographicProof.algorithm).toBe('SHA-256');
  });

  it('should IMMEDIATELY detect data tampering if an attacker maliciously alters a transaction row directly in the database', async () => {
    // Find an existing block to tamper with
    const targetBlock = await prisma.ledgerBlock.findFirst({
      orderBy: { sequenceNumber: 'desc' },
      include: { transaction: true },
    });

    expect(targetBlock).toBeDefined();
    const originalAmount = targetBlock!.transaction.amount;

    // Simulate an attacker modifying the transaction amount directly in DB bypassing the API
    await prisma.transaction.update({
      where: { id: targetBlock!.transactionId },
      data: { amount: originalAmount + 999999 },
    });

    // Run cryptographic verification
    const verification = await LedgerService.verifyLedgerChain();

    // The ledger MUST detect the tampering!
    expect(verification.isValid).toBe(false);
    expect(verification.tamperedBlockSequence).toBe(targetBlock!.sequenceNumber);
    expect(verification.details).toContain('Data tampering detected');

    // Clean up: Restore the original value
    await prisma.transaction.update({
      where: { id: targetBlock!.transactionId },
      data: { amount: originalAmount },
    });

    // Verify ledger is valid again
    const postRestoreVerification = await LedgerService.verifyLedgerChain();
    expect(postRestoreVerification.isValid).toBe(true);
  });
});
