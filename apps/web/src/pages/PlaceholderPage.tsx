import { PixelCard } from '@cyber-universe/ui'

export function PlaceholderPage({ title, milestone }: { title: string; milestone: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <PixelCard className="w-full max-w-md text-center">
        <p className="font-pixel text-[10px] text-sage-dark">{milestone} · 开发中</p>
        <h1 className="mt-3 font-pixel text-sm text-wbrown">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink/60">
          这里还没有内容。按照里程碑计划，该模块将在对应阶段实现，届时你会第一个知道。
        </p>
      </PixelCard>
    </div>
  )
}
