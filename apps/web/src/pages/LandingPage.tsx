import { Link } from 'react-router-dom'
import { PixelButton } from '@cyber-universe/ui'

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <p className="font-pixel text-[10px] tracking-widest text-sage-dark">AI LIFE SIMULATION</p>
      <h1 className="font-pixel text-2xl leading-relaxed text-wbrown sm:text-3xl">
        CYBER
        <br />
        UNIVERSE
      </h1>
      <p className="max-w-md text-base leading-relaxed text-ink/70">
        一座浮空小岛，一群有记忆的 AI 居民。创建角色、组建家庭、种下花园、写下信件——
        你的世界在你离开时也依然生活。
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PixelButton to="/login">进入世界</PixelButton>
        <PixelButton to="/world" variant="outline">
          先看看小镇
        </PixelButton>
      </div>
      <Link to="/login" className="text-xs text-ink/40 underline-offset-4 hover:underline">
        已有账户？直接登录
      </Link>
    </div>
  )
}
