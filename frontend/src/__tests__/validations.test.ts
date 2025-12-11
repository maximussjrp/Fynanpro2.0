import { z } from 'zod'
import {
  transactionSchema,
  categorySchema,
  bankAccountSchema,
  paymentMethodSchema,
  loginSchema,
  registerSchema,
} from '@/schemas/validations'

describe('Validation Schemas', () => {
  describe('transactionSchema', () => {
    it('should validate a valid transaction', () => {
      const validTransaction = {
        type: 'income' as const,
        description: 'Salary',
        amount: 5000,
        transactionDate: '2025-11-27',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountId: '550e8400-e29b-41d4-a716-446655440001',
      }
      
      const result = transactionSchema.safeParse(validTransaction)
      expect(result.success).toBe(true)
    })

    it('should reject transaction with negative amount', () => {
      const invalidTransaction = {
        type: 'income' as const,
        description: 'Test',
        amount: -100,
        transactionDate: '2025-11-27',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountId: '550e8400-e29b-41d4-a716-446655440001',
      }
      
      const result = transactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should reject transaction with empty description', () => {
      const invalidTransaction = {
        type: 'expense' as const,
        description: '',
        amount: 100,
        transactionDate: '2025-11-27',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountId: '550e8400-e29b-41d4-a716-446655440001',
      }
      
      const result = transactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })

    it('should reject transaction with invalid type', () => {
      const invalidTransaction = {
        type: 'invalid',
        description: 'Test',
        amount: 100,
        transactionDate: '2025-11-27',
        categoryId: '550e8400-e29b-41d4-a716-446655440000',
        bankAccountId: '550e8400-e29b-41d4-a716-446655440001',
      }
      
      const result = transactionSchema.safeParse(invalidTransaction)
      expect(result.success).toBe(false)
    })
  })

  describe('categorySchema', () => {
    it('should validate a valid category', () => {
      const validCategory = {
        name: 'Alimentação',
        type: 'expense' as const,
        icon: 'food',
      }
      
      const result = categorySchema.safeParse(validCategory)
      expect(result.success).toBe(true)
    })

    it('should reject category with short name', () => {
      const invalidCategory = {
        name: 'A',
        type: 'expense' as const,
        icon: 'food',
      }
      
      const result = categorySchema.safeParse(invalidCategory)
      expect(result.success).toBe(false)
    })
  })

  describe('bankAccountSchema', () => {
    it('should validate a valid bank account', () => {
      const validAccount = {
        name: 'Nubank',
        type: 'bank' as const,
      }
      
      const result = bankAccountSchema.safeParse(validAccount)
      expect(result.success).toBe(true)
    })

    it('should accept optional fields', () => {
      const minimalAccount = {
        name: 'Cash',
        type: 'cash' as const,
      }
      
      const result = bankAccountSchema.safeParse(minimalAccount)
      expect(result.success).toBe(true)
    })
  })

  describe('paymentMethodSchema', () => {
    it('should validate a credit card payment method', () => {
      const validPaymentMethod = {
        name: 'Visa',
        type: 'credit_card' as const,
      }
      
      const result = paymentMethodSchema.safeParse(validPaymentMethod)
      expect(result.success).toBe(true)
    })

    it('should accept debit card', () => {
      const validDebitCard = {
        name: 'Debit Card',
        type: 'debit_card' as const,
      }
      
      const result = paymentMethodSchema.safeParse(validDebitCard)
      expect(result.success).toBe(true)
    })
  })

  describe('loginSchema', () => {
    it('should validate a valid login', () => {
      const validLogin = {
        email: 'user@example.com',
        password: 'password123',
      }
      
      const result = loginSchema.safeParse(validLogin)
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const invalidLogin = {
        email: 'not-an-email',
        password: 'password123',
      }
      
      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })

    it('should reject short password', () => {
      const invalidLogin = {
        email: 'user@example.com',
        password: '123',
      }
      
      const result = loginSchema.safeParse(invalidLogin)
      expect(result.success).toBe(false)
    })
  })

  describe('registerSchema', () => {
    it('should validate a valid registration', () => {
      const validRegister = {
        fullName: 'John Doe',
        email: 'john@example.com',
        password: 'SecurePass123',
        tenantName: 'John Family',
      }
      
      const result = registerSchema.safeParse(validRegister)
      expect(result.success).toBe(true)
    })

    it('should reject short name', () => {
      const invalidRegister = {
        fullName: 'Jo',
        email: 'john@example.com',
        password: 'SecurePass123',
        tenantName: 'John Family',
      }
      
      const result = registerSchema.safeParse(invalidRegister)
      expect(result.success).toBe(false)
    })
  })
})
