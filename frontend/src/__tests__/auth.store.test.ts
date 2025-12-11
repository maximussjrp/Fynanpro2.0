import { renderHook, act } from '@testing-library/react'
import { useAuth } from '@/stores/auth'

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useAuth.getState()
    if (store && typeof store.logout === 'function') {
      store.logout()
    }
  })

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.user).toBeNull()
    expect(result.current.tenant).toBeNull()
    expect(result.current.accessToken).toBeNull()
    expect(result.current.refreshToken).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should set auth state correctly', () => {
    const { result } = renderHook(() => useAuth())
    
    const mockUser = {
      id: '1',
      fullName: 'Test User',
      email: 'test@example.com',
      role: 'user',
    }
    
    const mockTenant = {
      id: 'tenant-1',
      name: 'Test Tenant',
      slug: 'test-tenant',
    }
    
    act(() => {
      result.current.setAuth(
        { accessToken: 'access-token', refreshToken: 'refresh-token' },
        mockUser,
        mockTenant
      )
    })
    
    expect(result.current.user).toEqual(mockUser)
    expect(result.current.tenant).toEqual(mockTenant)
    expect(result.current.accessToken).toBe('access-token')
    expect(result.current.refreshToken).toBe('refresh-token')
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should update tokens correctly', () => {
    const { result } = renderHook(() => useAuth())
    
    // First set auth
    act(() => {
      result.current.setAuth(
        { accessToken: 'old-access', refreshToken: 'old-refresh' },
        { id: '1', fullName: 'User', email: 'user@test.com', role: 'user' },
        { id: 'tenant-1', name: 'Tenant', slug: 'tenant' }
      )
    })
    
    // Then update tokens
    act(() => {
      result.current.updateTokens('new-access', 'new-refresh')
    })
    
    expect(result.current.accessToken).toBe('new-access')
    expect(result.current.refreshToken).toBe('new-refresh')
    expect(result.current.user).toBeTruthy() // User should remain
  })

  it('should clear auth state on logout', () => {
    const { result } = renderHook(() => useAuth())
    
    // Set auth first
    act(() => {
      result.current.setAuth(
        { accessToken: 'access-token', refreshToken: 'refresh-token' },
        { id: '1', fullName: 'User', email: 'user@test.com', role: 'user' },
        { id: 'tenant-1', name: 'Tenant', slug: 'tenant' }
      )
    })
    
    // Then logout
    act(() => {
      result.current.logout()
    })
    
    expect(result.current.user).toBeNull()
    expect(result.current.tenant).toBeNull()
    expect(result.current.accessToken).toBeNull()
    expect(result.current.refreshToken).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })

  it('should persist state to localStorage on setAuth', () => {
    const { result } = renderHook(() => useAuth())
    
    const localStorageSpy = jest.spyOn(Storage.prototype, 'setItem')
    
    act(() => {
      result.current.setAuth(
        { accessToken: 'access-token', refreshToken: 'refresh-token' },
        { id: '1', fullName: 'User', email: 'user@test.com', role: 'user' },
        { id: 'tenant-1', name: 'Tenant', slug: 'tenant' }
      )
    })
    
    expect(localStorageSpy).toHaveBeenCalled()
    localStorageSpy.mockRestore()
  })
})
