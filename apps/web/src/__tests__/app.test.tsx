import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from '@/App'
import { queryClient } from '@/lib/queryClient'

function renderAt(route: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App 路由骨架', () => {
  it('渲染着陆页', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('CYBER')
  })

  it('未来里程碑路由渲染占位空状态', () => {
    renderAt('/garden')
    expect(screen.getAllByText('花园').length).toBeGreaterThan(0)
    expect(screen.getByText('M4 · 开发中')).toBeInTheDocument()
  })
})
