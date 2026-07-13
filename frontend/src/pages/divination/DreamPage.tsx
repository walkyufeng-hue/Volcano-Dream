import { useCallback, useEffect, useState } from 'react'
import { Lightbulb, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ResultDrawer } from '@/components/ResultDrawer'
import { useDivination } from '@/hooks/useDivination'
import { useGlobalState } from '@/store'

const API_BASE = import.meta.env.VITE_API_BASE || ''

interface QuotaInfo {
  enabled: boolean
  limit: number
  used: number
  remaining: number
  window_seconds: number
}

const DREAM_EXAMPLES = [
  {
    label: '梦见飞翔',
    content: '我梦见自己从城市上空飞过，开始有些害怕，后来越来越轻松，最后落在一片安静的草地上。',
  },
  {
    label: '梦见迷路',
    content: '我梦见自己在一座陌生的大楼里反复寻找出口，走廊很长，但一路上总能听见熟悉的人在叫我。',
  },
  {
    label: '梦见大海',
    content: '我梦见自己站在夜晚的海边，远处有一座发光的火山，海面很平静，我既期待又有一点紧张。',
  },
]

export default function DreamPage() {
  const [prompt, setPrompt] = useState('')
  const [resultOpen, setResultOpen] = useState(false)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const { settings, jwt } = useGlobalState()
  const {
    result,
    loading,
    resultLoading,
    streaming,
    image,
    imageLoading,
    imageError,
    onSubmit,
    cancelGeneration,
    retryImage,
  } = useDivination('dream')

  const busy = loading || streaming || imageLoading

  const loadQuota = useCallback(async () => {
    if (!settings.enable_rate_limit) return
    try {
      const response = await fetch(`${API_BASE}/api/v1/quota`, {
        headers: { Authorization: `Bearer ${jwt || 'xxx'}` },
      })
      if (!response.ok) return
      setQuota(await response.json())
    } catch {
      // The static rate-limit label remains visible if quota lookup fails.
    }
  }, [jwt, settings.enable_rate_limit])

  useEffect(() => {
    void loadQuota()
  }, [loadQuota])

  const handleSubmit = () => {
    if (!prompt.trim() || busy) return
    setResultOpen(true)
    setQuota((current) => current ? {
      ...current,
      used: Math.min(current.used + 1, current.limit),
      remaining: Math.max(current.remaining - 1, 0),
    } : current)
    void onSubmit({ prompt: prompt.trim() }).finally(() => void loadQuota())
  }

  const handleCloseResult = () => {
    if (busy) cancelGeneration()
    setResultOpen(false)
    setPrompt('')
  }

  return (
    <section className="mx-auto w-full max-w-[900px] pb-4 pt-1 md:pt-2">
      <div className="mx-auto mb-6 max-w-3xl text-center md:mb-7">
        <p className="text-[11px] font-medium tracking-[0.18em] text-primary md:text-[13px]">
          把梦境写下来，听见潜意识的回声
        </p>
        <h1 className="font-editorial mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.035em] sm:text-4xl md:text-[2.375rem]">
          梦里有答案，也有新的画面
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-[15px]">
          结合传统梦文化与心理学视角，为你的梦生成一份温柔、具体的解读。
        </p>
      </div>

      <div className="rounded-[1.75rem] bg-card p-[18px] shadow-[0_20px_60px_-34px_rgba(59,43,36,0.32)] md:rounded-[2rem] md:p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-editorial text-lg font-semibold sm:text-xl md:text-[22px]">昨晚，你梦见了什么？</h2>
          <span className="shrink-0 text-[11px] text-muted-foreground md:text-xs">{prompt.length} / 500</span>
        </div>

        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={'尽量写下你记得的画面、人物、情绪和细节……\n\n例如：我梦见自己站在海边，远处有一座正在发光的火山。'}
          maxLength={500}
          rows={7}
          className="min-h-[210px] resize-none rounded-[1.15rem] border border-border/75 bg-background/70 px-5 py-5 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 md:min-h-[210px]"
          disabled={busy}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            试试示例
          </span>
          {DREAM_EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => setPrompt(example.content)}
              disabled={busy}
              className="rounded-full bg-muted/65 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
            >
              {example.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={busy || !prompt.trim()}
            size="lg"
            className="h-[52px] min-w-[188px] gap-2.5 rounded-[1.1rem] bg-primary px-7 text-primary-foreground shadow-none hover:bg-primary/90"
          >
            {busy ? (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
                {imageLoading ? '绘制梦境中' : '解读梦境中'}
              </>
            ) : (
              <>
                <Sparkles className="h-[18px] w-[18px]" />
                解读我的梦境
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[11px] text-muted-foreground md:mt-8 md:text-xs">
        <span className="flex items-center gap-2">
          <i className="h-1.5 w-1.5 rounded-full bg-primary" />
          {quota?.enabled
            ? `今日还可解梦 ${quota.remaining} 次`
            : settings.enable_rate_limit
              ? `每个 IP 免费 ${settings.rate_limit}`
              : '描述越具体，解读越准确'}
        </span>
        <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />结果仅供娱乐与自我反思</span>
        <span className="hidden items-center gap-2 sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />梦境内容仅用于本次生成</span>
      </div>

      <ResultDrawer
        show={resultOpen}
        onClose={handleCloseResult}
        result={result}
        loading={resultLoading && !result}
        streaming={streaming}
        image={image}
        imageLoading={imageLoading}
        imageError={imageError}
        isGenerating={busy}
        onCancel={cancelGeneration}
        onRetryImage={() => void retryImage()}
      />
    </section>
  )
}
