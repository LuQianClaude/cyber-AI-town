import { useQuery } from '@tanstack/react-query'
import { getHealth, ApiClientError } from '@cyber-universe/api-client'

/** 顶栏后端状态指示。M0 验收用：直观看到前端 ↔ 后端联通。 */
export function ApiStatus() {
  const { data, isError, error, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return <span className="text-xs text-ink/40">连接中…</span>
  }
  if (isError) {
    const msg = error instanceof ApiClientError ? `API ${error.status}` : '网络错误'
    return (
      <span className="rounded bg-pink/40 px-2 py-1 text-xs font-semibold text-wbrown-dark" role="status">
        后端离线 · {msg}
      </span>
    )
  }
  return (
    <span className="rounded bg-sage/30 px-2 py-1 text-xs font-semibold text-sage-dark" role="status">
      API v{data?.version ?? '?'} 在线
    </span>
  )
}
