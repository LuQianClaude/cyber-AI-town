/**
 * M2 E2E 专用 mock LLM：OpenAI 兼容的 SSE 流式接口。
 * 只监听 127.0.0.1，供全链路测试（注册→配置→居民→聊天流→世界 NPC）使用。
 */
import http from 'node:http'

const PORT = 8377
const HOST = '127.0.0.1'

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    // Playwright webServer 健康检查与存活探针
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('mock-llm ok')
    return
  }
  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      let model = 'mock-model'
      let prompt = ''
      try {
        const parsed = JSON.parse(body)
        model = parsed.model ?? model
        prompt = (parsed.messages ?? []).map((m) => `${m.role}: ${m.content}`).join('\n')
      } catch {
        /* 忽略解析失败，按默认回复 */
      }
      console.log(`[mock-llm] chat request, model=${model}, prompt bytes=${prompt.length}`)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      // OpenAI SSE 流式格式
      const chunks = ['你好呀', '，', '我是', '测试居民，', '很高兴认识你！']
      let i = 0
      const timer = setInterval(() => {
        if (i >= chunks.length) {
          res.write('data: [DONE]\n\n')
          clearInterval(timer)
          res.end()
          return
        }
        const payload = {
          id: 'chatcmpl-mock',
          object: 'chat.completion.chunk',
          choices: [{ delta: { content: chunks[i] } }],
        }
        res.write(`data: ${JSON.stringify(payload)}\n\n`)
        i++
      }, 30)
    })
    return
  }
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, HOST, () => {
  console.log(`[mock-llm] listening on http://${HOST}:${PORT}/v1`)
})
