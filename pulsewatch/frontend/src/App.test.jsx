import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./hooks/useMetrics', () => ({
  useMetrics: () => ({
    metrics: [],
    system: null,
    alerts: [],
    settings: null,
    loading: false,
    connection: 'offline',
    error: '',
    refresh: vi.fn(),
    saveSettings: vi.fn(),
  }),
}))

describe('PulseWatch dashboard', () => {
  it('renders the offline empty state and navigates to settings', () => {
    render(<App />)
    expect(screen.getByText('Waiting for your first metrics')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('heading', { name: 'Alert thresholds' })).toBeInTheDocument()
  })
})
