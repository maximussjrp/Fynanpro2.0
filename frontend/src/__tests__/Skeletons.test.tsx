import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  DashboardCardSkeleton,
  DashboardMetricsSkeleton,
  ChartSkeleton,
  TransactionTableSkeleton,
  ListSkeleton,
  RankingCardSkeleton,
  FormSkeleton,
  DashboardPageSkeleton,
} from '@/components/Skeletons'

describe('Skeleton Components', () => {
  describe('DashboardCardSkeleton', () => {
    it('should render skeleton card', () => {
      const { container } = render(<DashboardCardSkeleton />)
      expect(container.querySelector('.bg-white')).toBeInTheDocument()
    })
  })

  describe('DashboardMetricsSkeleton', () => {
    it('should render 4 skeleton cards', () => {
      const { container } = render(<DashboardMetricsSkeleton />)
      const cards = container.querySelectorAll('.bg-white')
      expect(cards.length).toBe(4)
    })
  })

  describe('ChartSkeleton', () => {
    it('should render with default height', () => {
      const { container } = render(<ChartSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render with custom height', () => {
      const { container } = render(<ChartSkeleton height={500} />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('TransactionTableSkeleton', () => {
    it('should render skeleton structure', () => {
      const { container } = render(<TransactionTableSkeleton />)
      expect(container.querySelector('.bg-white')).toBeInTheDocument()
    })

    it('should render with custom number of rows', () => {
      const { container } = render(<TransactionTableSkeleton rows={10} />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('ListSkeleton', () => {
    it('should render skeleton items', () => {
      const { container } = render(<ListSkeleton />)
      const items = container.querySelectorAll('.bg-white')
      expect(items.length).toBeGreaterThan(0)
    })

    it('should render with custom number of items', () => {
      const { container } = render(<ListSkeleton items={5} />)
      const items = container.querySelectorAll('.bg-white')
      expect(items.length).toBeGreaterThan(0)
    })
  })

  describe('RankingCardSkeleton', () => {
    it('should render with default 5 items', () => {
      const { container } = render(<RankingCardSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render with custom number of items', () => {
      const { container } = render(<RankingCardSkeleton items={10} />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render title placeholder', () => {
      const { container } = render(<RankingCardSkeleton />)
      expect(container.querySelector('.bg-white')).toBeInTheDocument()
    })
  })

  describe('FormSkeleton', () => {
    it('should render with default 3 fields', () => {
      const { container } = render(<FormSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render with custom number of fields', () => {
      const { container } = render(<FormSkeleton fields={5} />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render submit button placeholder', () => {
      const { container } = render(<FormSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })
  })

  describe('DashboardPageSkeleton', () => {
    it('should render complete dashboard skeleton', () => {
      const { container } = render(<DashboardPageSkeleton />)
      expect(container.firstChild).toBeInTheDocument()
    })

    it('should render metrics skeleton', () => {
      const { container } = render(<DashboardPageSkeleton />)
      const cards = container.querySelectorAll('.bg-white')
      expect(cards.length).toBeGreaterThan(0)
    })
  })
})
