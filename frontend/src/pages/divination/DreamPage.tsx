import { useCallback, useEffect, useState } from 'react'
import { Lightbulb, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ResultDrawer } from '@/components/ResultDrawer'
import { useDivination } from '@/hooks/useDivination'
import { useGlobalState } from '@/store'
import { DIVINATION_OPTIONS } from '@/config/constants'

const API_BASE = import.meta.env.VITE_API_BASE || ''

interface QuotaInfo {
  enabled: boolean
  limit: number
  used: number
  remaining: number
  window_seconds: number
}

const SCENARIO_CONTENT = {
  dream: {
    eyebrow: '把梦境写下来，听见潜意识的回声',
    headline: '梦里有答案，也有新的画面',
    introduction: '结合传统梦文化与心理学视角，为你的梦生成一份温柔、具体的解读。',
    question: '昨晚，你梦见了什么？',
    placeholder: '尽量写下你记得的画面、人物、情绪和细节……\n\n例如：我梦见自己站在海边，远处有一座正在发光的火山。',
    action: '解读我的梦境',
    textLoading: '解读梦境中',
    imageLoading: '绘制梦境中',
    resultTitle: '梦境解读',
    resultEyebrow: 'Dream reading',
    resultLoading: '正在解读你的梦境',
    resultLoadingDescription: '请稍候，文字完成后会自动绘制梦境画面',
    imageTitle: '梦境画面',
    imageAlt: '梦境配图',
    downloadName: '火山梦绘AI-梦境画面',
    privacy: '梦境内容仅用于本次生成',
    examples: [
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
    ],
  },
  emotion_journal: {
    eyebrow: '把此刻写下来，让情绪被温柔看见',
    headline: '记录今天，也照见内心',
    introduction: '从发生的事情出发，帮你梳理情绪、看见需要，并生成一幅属于此刻的画面。',
    question: '今天，什么事情让你最有感触？',
    placeholder: '写下发生的事情、当时的感受，以及此刻仍留在心里的想法……\n\n例如：今天完成了拖了很久的任务，松了一口气，但又担心下一件事做不好。',
    action: '回应我的此刻',
    textLoading: '梳理情绪中',
    imageLoading: '绘制心情中',
    resultTitle: '情绪回应',
    resultEyebrow: 'Emotional reflection',
    resultLoading: '正在理解你的此刻',
    resultLoadingDescription: '请稍候，文字完成后会自动绘制一幅情绪画面',
    imageTitle: '此刻的画面',
    imageAlt: '情绪日记配图',
    downloadName: '火山梦绘AI-此刻的画面',
    privacy: '日记内容仅用于本次生成',
    examples: [
      {
        label: '有点疲惫',
        content: '今天开了很多会，事情都完成了，但回到家后还是觉得脑子停不下来，很想安静一会儿。',
      },
      {
        label: '值得开心',
        content: '今天收到了一句意外的肯定，开心了很久，也发现自己其实很在意努力有没有被看见。',
      },
      {
        label: '有些纠结',
        content: '我需要在两个选择之间做决定，一边期待改变，一边又担心选错后会后悔。',
      },
    ],
  },
} as const

type ScenarioKey = keyof typeof SCENARIO_CONTENT

export default function DreamPage() {
  const [promptType, setPromptType] = useState<ScenarioKey>('dream')
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
  } = useDivination(promptType)

  const busy = loading || streaming || imageLoading
  const content = SCENARIO_CONTENT[promptType]

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

  const handleScenarioChange = (nextScenario: ScenarioKey) => {
    if (busy || nextScenario === promptType) return
    setPromptType(nextScenario)
    setPrompt('')
    setResultOpen(false)
  }

  return (
    <section className="mx-auto w-full max-w-[900px] pb-4 pt-1 md:pt-2">
      <div className="mx-auto mb-6 max-w-3xl text-center md:mb-7">
        <p className="text-[11px] font-medium tracking-[0.18em] text-primary md:text-[13px]">
          {content.eyebrow}
        </p>
        <h1 className="font-editorial mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.035em] sm:text-4xl md:text-[2.375rem]">
          {content.headline}
        </h1>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-[15px]">
          {content.introduction}
        </p>
        <div className="mx-auto mt-5 inline-flex rounded-[1rem] bg-card p-1 shadow-[0_10px_30px_-22px_rgba(30,27,46,0.45)]">
          {DIVINATION_OPTIONS.map((option) => {
            const Icon = option.icon
            const active = option.key === promptType
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => handleScenarioChange(option.key as ScenarioKey)}
                disabled={busy}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition-colors md:px-5 md:text-sm ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                } disabled:pointer-events-none disabled:opacity-60`}
              >
                <Icon className="h-4 w-4" />
                {option.key === 'dream' ? '梦境解读' : option.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-[1.75rem] bg-card p-[18px] shadow-[0_20px_60px_-34px_rgba(59,43,36,0.32)] md:rounded-[2rem] md:p-7">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-editorial text-lg font-semibold sm:text-xl md:text-[22px]">{content.question}</h2>
          <span className="shrink-0 text-[11px] text-muted-foreground md:text-xs">{prompt.length} / 500</span>
        </div>

        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={content.placeholder}
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
          {content.examples.map((example) => (
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
                {imageLoading ? content.imageLoading : content.textLoading}
              </>
            ) : (
              <>
                <Sparkles className="h-[18px] w-[18px]" />
                {content.action}
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-[11px] text-muted-foreground md:mt-8 md:text-xs">
        <span className="flex items-center gap-2">
          <i className="h-1.5 w-1.5 rounded-full bg-primary" />
          {quota?.enabled
            ? `每个 IP 每 24 小时限 ${quota.limit} 次 · 剩余 ${quota.remaining} 次`
            : settings.enable_rate_limit
              ? `每个 IP 免费 ${settings.rate_limit}`
              : '描述越具体，解读越准确'}
        </span>
        <span className="flex items-center gap-2"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />结果仅用于记录与自我反思</span>
        <span className="hidden items-center gap-2 sm:flex"><i className="h-1.5 w-1.5 rounded-full bg-muted-foreground/45" />{content.privacy}</span>
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
        title={content.resultTitle}
        eyebrow={content.resultEyebrow}
        imageTitle={content.imageTitle}
        imageAlt={content.imageAlt}
        downloadName={content.downloadName}
        loadingTitle={content.resultLoading}
        loadingDescription={content.resultLoadingDescription}
      />
    </section>
  )
}
