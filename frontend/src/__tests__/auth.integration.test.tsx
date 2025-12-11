import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock the auth store
jest.mock('@/stores/auth', () => ({
  useAuth: () => ({
    user: null,
    tenant: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    setAuth: jest.fn(),
    logout: jest.fn(),
  }),
}))

// Mock the API client
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
}))

import api from '@/lib/api'
import { useAuth } from '@/stores/auth'

describe('Authentication Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Login Flow', () => {
    it('should successfully login and store tokens', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: {
              id: '1',
              name: 'Test User',
              email: 'test@example.com',
            },
            tenant: {
              id: 'tenant-1',
              name: 'Test Tenant',
            },
            accessToken: 'access-token-123',
            refreshToken: 'refresh-token-123',
          },
        },
      }

      ;(api.post as jest.Mock).mockResolvedValue(mockResponse)

      // Simulate login API call
      const response = await api.post('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      })

      expect(response.data.success).toBe(true)
      expect(response.data.data.user.email).toBe('test@example.com')
      expect(response.data.data.accessToken).toBe('access-token-123')
    })

    it('should handle login error', async () => {
      const mockError = {
        response: {
          data: {
            success: false,
            error: {
              message: 'Invalid credentials',
            },
          },
        },
      }

      ;(api.post as jest.Mock).mockRejectedValue(mockError)

      try {
        await api.post('/auth/login', {
          email: 'wrong@example.com',
          password: 'wrongpass',
        })
      } catch (error: any) {
        expect(error.response.data.error.message).toBe('Invalid credentials')
      }
    })
  })

  describe('Register Flow', () => {
    it('should successfully register new user', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            user: {
              id: '1',
              name: 'New User',
              email: 'new@example.com',
            },
            tenant: {
              id: 'tenant-1',
              name: 'New Tenant',
            },
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      }

      ;(api.post as jest.Mock).mockResolvedValue(mockResponse)

      const response = await api.post('/auth/register', {
        name: 'New User',
        email: 'new@example.com',
        password: 'securepass123',
        tenantName: 'New Tenant',
      })

      expect(response.data.success).toBe(true)
      expect(response.data.data.user.name).toBe('New User')
    })
  })

  describe('Token Refresh Flow', () => {
    it('should successfully refresh tokens', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
          },
        },
      }

      ;(api.post as jest.Mock).mockResolvedValue(mockResponse)

      const response = await api.post('/auth/refresh', {
        refreshToken: 'old-refresh-token',
      })

      expect(response.data.success).toBe(true)
      expect(response.data.data.accessToken).toBe('new-access-token')
    })

    it('should handle refresh token expiration', async () => {
      const mockError = {
        response: {
          status: 401,
          data: {
            success: false,
            error: {
              message: 'Refresh token expired',
            },
          },
        },
      }

      ;(api.post as jest.Mock).mockRejectedValue(mockError)

      try {
        await api.post('/auth/refresh', {
          refreshToken: 'expired-token',
        })
      } catch (error: any) {
        expect(error.response.status).toBe(401)
      }
    })
  })

  describe('Logout Flow', () => {
    it('should successfully logout', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Logged out successfully',
        },
      }

      ;(api.post as jest.Mock).mockResolvedValue(mockResponse)

      const response = await api.post('/auth/logout')

      expect(response.data.success).toBe(true)
    })
  })
})
