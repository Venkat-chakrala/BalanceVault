import { z } from 'zod';

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    fullName: z.string().min(2, 'Full name must have at least 2 characters'),
    phone: z.string().optional(),
    role: z.enum(['USER', 'ADMIN', 'AUDITOR']).optional(),
    initialDepositCents: z.number().int().nonnegative().optional(),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const transferSchema = z.object({
  body: z.object({
    fromAccountId: z.string().uuid('Invalid source account ID format'),
    toAccountId: z.string().uuid('Invalid destination account ID format'),
    amount: z
      .number({ required_error: 'Amount is required' })
      .int('Amount must be an integer in cents')
      .positive('Amount must be strictly greater than 0')
      .max(100_000_000, 'Single transfer limit exceeded ($1,000,000 max)'),
    description: z.string().max(255).optional(),
  }).refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Self-transfers are not allowed. Source and destination accounts must differ.',
    path: ['toAccountId'],
  }),
});

export const depositSchema = z.object({
  body: z.object({
    accountId: z.string().uuid('Invalid account ID format'),
    amount: z
      .number({ required_error: 'Amount is required' })
      .int('Amount must be an integer in cents')
      .positive('Amount must be strictly greater than 0')
      .max(100_000_000, 'Deposit exceeds maximum allowable limit'),
    description: z.string().max(255).optional(),
  }),
});

export const kycSubmitSchema = z.object({
  body: z.object({
    documentType: z.string().min(2, 'Document type is required (e.g. Passport, National ID)'),
    documentNumber: z.string().min(4, 'Document identification number is required'),
  }),
});

export const userStatusUpdateSchema = z.object({
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).optional(),
    role: z.enum(['USER', 'ADMIN', 'AUDITOR']).optional(),
    kycStatus: z.enum(['UNSUBMITTED', 'PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
});
