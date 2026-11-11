import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PixelButton, PixelCard, PixelInput } from '../index'

describe('PixelButton', () => {
  it('渲染为按钮并可点击', () => {
    let clicked = 0
    render(<PixelButton onClick={() => clicked++}>点我</PixelButton>)
    fireEvent.click(screen.getByRole('button', { name: '点我' }))
    expect(clicked).toBe(1)
  })

  it('提供 to 时渲染为链接', () => {
    render(
      <MemoryRouter>
        <PixelButton to="/world">去世界</PixelButton>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: '去世界' })).toHaveAttribute('href', '/world')
  })

  it('disabled 时不触发点击', () => {
    let clicked = 0
    render(
      <PixelButton disabled onClick={() => clicked++}>
        禁用
      </PixelButton>,
    )
    fireEvent.click(screen.getByRole('button', { name: '禁用' }))
    expect(clicked).toBe(0)
  })
})

describe('PixelCard', () => {
  it('渲染内容与自定义类名', () => {
    render(<PixelCard className="extra">卡片内容</PixelCard>)
    const card = screen.getByText('卡片内容')
    expect(card.className).toContain('extra')
  })
})

describe('PixelInput', () => {
  it('必填校验时显示错误提示', () => {
    render(
      <form>
        <PixelInput label="邮箱" required name="email" />
        <button type="submit">提交</button>
      </form>,
    )
    fireEvent.click(screen.getByRole('button', { name: '提交' }))
    expect(screen.getByRole('alert').textContent!.length).toBeGreaterThan(0)
  })
})
