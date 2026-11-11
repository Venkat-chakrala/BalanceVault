import { z } from 'zod';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACCOUNT_NUM_REGEX = /^BV-\d{6}$/i;

export const registerSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    fullName: z.string().trim().min(2, 'Full name must have at least 2 characters'),
    phone: z.string().trim().max(30, 'Phone number is too long').optional(),
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
    toAccountId: z
      .string()
      .trim()
      .refine(
        (val) => UUID_REGEX.test(val) || ACCOUNT_NUM_REGEX.test(val),
        'Destination must be a valid account UUID or account number (e.g. BV-200202)'
      ),
    amount: z
      .number({ required_error: 'Amount is required' })
      .int('Amount must be an integer in cents')
      .positive('Amount must be strictly greater than 0')
      .max(100_000_000, 'Single transfer limit exceeded ($1,000,000 max)'),
    description: z.string().max(255).optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
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
    idempotencyKey: z.string().min(8).max(128).optional(),
  }),
});

export const openAccountSchema = z.object({
  body: z.object({
    type: z.enum(['CHECKING', 'SAVINGS']).default('SAVINGS'),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2, 'Full name must have at least 2 characters').max(120),
    phone: z.string().trim().max(30, 'Phone number is too long').optional().nullable(),
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

