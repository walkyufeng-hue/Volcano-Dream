import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
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
  service_available?: boolean
}

const MIN_DREAM_LENGTH = 20
const DREAM_DRAFT_KEY = 'volcano_dream_draft'

const readDreamDraft = () => {
  try {
    return window.localStorage.getItem(DREAM_DRAFT_KEY) || ''
  } catch {
    return ''
  }
}

const persistDreamDraft = (value: string) => {
  try {
    if (value) window.localStorage.setItem(DREAM_DRAFT_KEY, value)
    else window.localStorage.removeItem(DREAM_DRAFT_KEY)
  } catch {
    // Keep the input usable when browser storage is unavailable.
  }
}

export default function DreamPage() {
  const [prompt, setPrompt] = useState(readDreamDraft)
  const [resultOpen, setResultOpen] = useState(false)
  const [quota, setQuota] = useState<QuotaInfo | null>(null)
  const [quotaError, setQuotaError] = useState(false)
  const { settings, jwt } = useGlobalState()
  const {
    result,
    loading,
    resultLoading,
    streaming,
    image,
    imageLoading,
    imageError,
    textCompleted,
    analysis,
    loadingMessage,
    onSubmit,
    cancelGeneration,
    retryImage,
  } = useDivination('dream')

  const textBusy = loading || streaming
  const generationBusy = textBusy || imageLoading
  const dreamLength = Array.from(prompt.trim()).length
  const quotaExhausted = Boolean(quota?.enabled && quota.remaining <= 0)
  const serviceUnavailable = quota?.service_available === false
  const canSubmit = (
    dreamLength >= MIN_DREAM_LENGTH
    && !textBusy
    && !quotaExhausted
    && !serviceUnavailable
  )

  const loadQuota = useCallback(async () => {
    setQuotaError(false)
    try {
      const response = await fetch(`${API_BASE}/api/v1/quota`, {
        headers: { Authorization: `Bearer ${jwt || 'xxx'}` },
      })
      if (!response.ok) {
        setQuota(null)
        setQuotaError(true)
        return
      }
      setQuota(await response.json())
    } catch {
      setQuota(null)
      setQuotaError(true)
    }
  }, [jwt])

  useEffect(() => {
    void loadQuota()
  }, [loadQuota])

  const updatePrompt = (value: string) => {
    // Persist in the input event itself so an immediate refresh cannot happen
    // before a delayed React effect has written the latest draft.
    persistDreamDraft(value)
    setPrompt(value)
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    setResultOpen(true)
    setQuota((current) => current ? {
      ...current,
      used: Math.min(current.used + 1, current.limit),
      remaining: Math.max(current.remaining - 1, 0),
    } : current)
    void onSubmit({ prompt: prompt.trim() }).finally(() => void loadQuota())
  }

  const handleCloseResult = () => {
    if (textBusy) {
      const shouldClose = window.confirm(
        '解读仍在进行，关闭将停止生成。你写下的梦会保留在输入框中，确定关闭吗？',
      )
      if (!shouldClose) return
      cancelGeneration()
    }
    setResultOpen(false)
    if (textCompleted) updatePrompt('')
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
        <div className="mb-4">
          <h2 className="font-editorial text-lg font-semibold sm:text-xl md:text-[22px]">昨晚，你梦见了什么？</h2>
        </div>

        <Textarea
          value={prompt}
          onChange={(event) => updatePrompt(event.target.value)}
          placeholder="写下你还记得的画面、人物、情绪和细节……"
          maxLength={500}
          rows={7}
          className="min-h-[210px] resize-none rounded-[1.15rem] border border-border/75 bg-background/70 px-5 py-5 text-[15px] leading-7 shadow-none placeholder:text-muted-foreground/75 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 md:min-h-[210px]"
          disabled={textBusy}
        />

        <div className="mt-3 flex items-center justify-between gap-4 text-[11px] text-muted-foreground md:text-xs">
          <span>{dreamLength} / {MIN_DREAM_LENGTH}</span>
          <span>至少写 {MIN_DREAM_LENGTH} 字</span>
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            size="lg"
            className="h-[52px] min-w-[188px] gap-2.5 rounded-[1.1rem] bg-primary px-7 text-primary-foreground shadow-none hover:bg-primary/90"
          >
            {textBusy ? (
              <>
                <Loader2 className="h-[18px] w-[18px] animate-spin" />
                解读梦境中
              </>
            ) : serviceUnavailable ? (
              '今日服务额度已用完'
            ) : quotaExhausted ? (
              '今日免费次数已用完'
            ) : (
              <>
                <Sparkles className="h-[18px] w-[18px]" />
                解读梦境
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[11px] text-muted-foreground md:mt-8 md:text-xs">
        <span className="flex items-center gap-2">
          <i className="h-1.5 w-1.5 rounded-full bg-primary" />
          {quotaError
            ? '额度状态暂时无法查询，提交时会实时校验'
            : quota?.service_available === false
              ? '今日服务额度已用完，请明天再试'
              : quota?.enabled
                ? `每个 IP 每 24 小时限 ${quota.limit} 次 · 剩余 ${quota.remaining} 次`
                : settings.enable_rate_limit
                  ? `每个 IP 免费 ${settings.rate_limit}`
                  : '描述越具体，解读越准确'}
        </span>
        <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />结果仅供娱乐与自我反思</span>
        <span className="hidden items-center gap-2 sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />内容会发送给 AI，记录仅保存在当前浏览器</span>
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
        analysis={analysis}
        loadingMessage={loadingMessage}
        isGenerating={generationBusy}
        onCancel={cancelGeneration}
        onRetryImage={() => void retryImage()}
      />
    </section>
  )
}
