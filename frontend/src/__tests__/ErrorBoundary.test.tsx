import React from 'react'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Suppress console.error for cleaner test output
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render fallback UI when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument()
    expect(screen.getByText('Test error')).toBeInTheDocument()
  })

  it('should show action buttons in fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(screen.getByText('Tentar Novamente')).toBeInTheDocument()
    expect(screen.getByText('Voltar ao Início')).toBeInTheDocument()
  })

  it('should show stack trace in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    // Check if details element exists (stack trace is in a details/summary)
    const detailsElement = screen.getByText(/Stack Trace/i)
    expect(detailsElement).toBeInTheDocument()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should log error to console', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error')
    
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )
    
    expect(consoleErrorSpy).toHaveBeenCalled()
  })
})
