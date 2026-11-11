import bcrypt from 'bcryptjs';
import prisma, { ensureAuditImmutabilityTriggers } from './client';
import { LedgerService } from '../services/ledger.service';

async function main() {
  console.log('🌱 Ensuring database immutability triggers and checking seed state...');
  await ensureAuditImmutabilityTriggers();

  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log(`ℹ️ Database already contains ${existingUsers} users. Preserving existing ledger and immutable audit records.`);
    return;
  }

  console.log('🌱 Seeding BalanceVault database with verified benchmark records...');

  const salt = await bcrypt.genSalt(10);

  // 1. Create Administrator
  const adminPasswordHash = await bcrypt.hash('AdminPassword@123', salt);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@balancevault.com',
      passwordHash: adminPasswordHash,
      fullName: 'System Administrator',
      role: 'ADMIN',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycDocumentType: 'Executive ID',
      kycDocumentNumber: 'EXEC-99901',
    },
  });

  // 2. Create Auditor
  const auditorPasswordHash = await bcrypt.hash('AuditorPassword@123', salt);
  const auditor = await prisma.user.create({
    data: {
      email: 'auditor@balancevault.com',
      passwordHash: auditorPasswordHash,
      fullName: 'Regulatory Compliance Auditor',
      role: 'AUDITOR',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycDocumentType: 'Compliance Certification',
      kycDocumentNumber: 'COMP-7788',
    },
  });

  // 3. Create Alice (Active Account Holder)
  const alicePasswordHash = await bcrypt.hash('AlicePassword@123', salt);
  const alice = await prisma.user.create({
    data: {
      email: 'alice@balancevault.com',
      passwordHash: alicePasswordHash,
      fullName: 'Alice Martin',
      role: 'USER',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycDocumentType: 'Passport',
      kycDocumentNumber: 'PASS-US-89211',
    },
  });

  const aliceAccount = await prisma.account.create({
    data: {
      accountNumber: 'BV-100101',
      userId: alice.id,
      type: 'CHECKING',
      currency: 'USD',
      cachedBalance: 500000, // $5,000.00
      status: 'ACTIVE',
    },
  });

  // 4. Create Bob (Active Account Holder)
  const bobPasswordHash = await bcrypt.hash('BobPassword@123', salt);
  const bob = await prisma.user.create({
    data: {
      email: 'bob@balancevault.com',
      passwordHash: bobPasswordHash,
      fullName: 'Bob Jenkins',
      role: 'USER',
      status: 'ACTIVE',
      kycStatus: 'APPROVED',
      kycDocumentType: 'Drivers License',
      kycDocumentNumber: 'DL-CA-44910',
    },
  });

  const bobAccount = await prisma.account.create({
    data: {
      accountNumber: 'BV-200202',
      userId: bob.id,
      type: 'CHECKING',
      currency: 'USD',
      cachedBalance: 250000, // $2,500.00
      status: 'ACTIVE',
    },
  });

  // 5. Create Charlie (Suspended Account Holder to test revocation)
  const charliePasswordHash = await bcrypt.hash('CharliePassword@123', salt);
  const charlie = await prisma.user.create({
    data: {
      email: 'charlie@balancevault.com',
      passwordHash: charliePasswordHash,
      fullName: 'Charlie Vance',
      role: 'USER',
      status: 'SUSPENDED',
      kycStatus: 'REJECTED',
    },
  });

  await prisma.account.create({
    data: {
      accountNumber: 'BV-300303',
      userId: charlie.id,
      type: 'CHECKING',
      currency: 'USD',
      cachedBalance: 10000, // $100.00
      status: 'FROZEN',
    },
  });

  console.log('✅ Base users and accounts created successfully.');

  // 6. Execute Seed Transfers to build the verifiable cryptographic ledger chain!
  console.log('⛓️ Executing benchmark transactions to establish cryptographic ledger blocks...');

  // Transaction 1: Alice transfers $300.00 (30000 cents) to Bob
  await LedgerService.executeTransfer({
    initiatedById: alice.id,
    fromAccountId: aliceAccount.id,
    toAccountId: bobAccount.id,
    amount: 30000,
    description: 'Consulting services payment invoice #104',
    ipAddress: '192.168.1.10',
  });

  // Transaction 2: Bob transfers $50.00 (5000 cents) back to Alice
  await LedgerService.executeTransfer({
    initiatedById: bob.id,
    fromAccountId: bobAccount.id,
    toAccountId: aliceAccount.id,
    amount: 5000,
    description: 'Reimbursement for materials',
    ipAddress: '192.168.1.15',
  });

  // Transaction 3: Alice deposits $1,000.00 (100000 cents)
  await LedgerService.executeDeposit({
    initiatedById: alice.id,
    accountId: aliceAccount.id,
    amount: 100000,
    description: 'Synthetic wire deposit',
    ipAddress: '192.168.1.10',
  });

  // Verify the newly seeded chain
  const verification = await LedgerService.verifyLedgerChain();
  console.log('🔍 Cryptographic Chain Verification Result:', verification);

  console.log('\n====================================================');
  console.log('🎉 SEED COMPLETED SUCCESSFULLY');
  console.log('Credentials for Evaluation:');
  console.log('  Admin:   admin@balancevault.com   / AdminPassword@123');
  console.log('  Auditor: auditor@balancevault.com / AuditorPassword@123');
  console.log('  Alice:   alice@balancevault.com   / AlicePassword@123');
  console.log('  Bob:     bob@balancevault.com     / BobPassword@123');
  console.log('  Charlie: charlie@balancevault.com / CharliePassword@123 (SUSPENDED)');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error executing seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

