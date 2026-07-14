import { Button } from '@/components/ui/button'
import { Check, Copy, Download, Image as ImageIcon, Loader2, RefreshCw, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ResultDrawerProps {
  show: boolean
  onClose: () => void
  result: string
  loading: boolean
  streaming: boolean
  image?: string
  imageLoading?: boolean
  imageError?: string
  onRetryImage?: () => void
  isGenerating?: boolean
  onCancel?: () => void
}

export function ResultDrawer({
  show,
  onClose,
  result,
  loading,
  streaming,
  image = '',
  imageLoading = false,
  imageError = '',
  onRetryImage,
  isGenerating = false,
  onCancel,
}: ResultDrawerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!show) {
      setIsAnimating(false)
      return
    }
    const frameId = requestAnimationFrame(() => setIsAnimating(true))
    return () => cancelAnimationFrame(frameId)
  }, [show])

  useEffect(() => {
    if (!show) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, show])

  // Keep wheel and touch scrolling inside the result dialog.
  useEffect(() => {
    if (!show) return

    const scrollY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const originalBodyStyles = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      paddingRight: body.style.paddingRight,
    }
    const originalRootOverflow = root.style.overflow
    const scrollbarWidth = window.innerWidth - root.clientWidth

    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.top = `-${scrollY}px`
    body.style.width = '100%'
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

    return () => {
      root.style.overflow = originalRootOverflow
      body.style.overflow = originalBodyStyles.overflow
      body.style.position = originalBodyStyles.position
      body.style.top = originalBodyStyles.top
      body.style.width = originalBodyStyles.width
      body.style.paddingRight = originalBodyStyles.paddingRight
      window.scrollTo(0, scrollY)
    }
  }, [show])

  // Start each newly opened result at the top, then leave scrolling entirely
  // under the user's control while text streams and the image appears.
  useEffect(() => {
    if (!show) return
    const timeoutId = window.setTimeout(() => {
      if (containerRef.current) containerRef.current.scrollTop = 0
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [show])

  if (!show) return null

  const copyResult = async () => {
    const documentNode = new DOMParser().parseFromString(result, 'text/html')
    const plainText = documentNode.body.textContent?.trim() || ''
    if (!plainText) return

    try {
      await navigator.clipboard.writeText(plainText)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = plainText
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const downloadImage = () => {
    if (!image) return
    const mimeType = image.match(/^data:([^;]+);/)?.[1] || 'image/png'
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.split('/')[1] || 'png'
    const link = document.createElement('a')
    link.href = image
    link.download = `火山梦绘AI-梦境画面.${extension}`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6">
      <button
        type="button"
        className={`absolute inset-0 bg-[#1e1b2e]/50 backdrop-blur-[2px] transition-opacity duration-200 ${isAnimating ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
        aria-label="关闭梦境解读"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dream-result-title"
        className={`relative z-10 flex h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[1.75rem] bg-card shadow-[0_30px_90px_-30px_rgba(23,19,30,0.55)] transition-all duration-300 md:h-[88vh] md:rounded-[2rem] ${
          isAnimating ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-4 scale-[0.985] opacity-0'
        }`}
      >
        <header className="flex shrink-0 items-center justify-between bg-card px-5 py-4 md:px-11 md:py-6">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Dream reading</p>
              <h2 id="dream-result-title" className="font-editorial mt-1 text-xl font-semibold md:text-2xl">梦境解读</h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {isGenerating && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="gap-2 rounded-[0.9rem] bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">停止生成</span>
              </Button>
            )}
            {result && !isGenerating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void copyResult()}
                className="gap-2 rounded-[0.9rem] bg-muted/70 hover:bg-muted"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                <span className="hidden sm:inline">{copied ? '已复制' : '复制解读'}</span>
              </Button>
            )}
            {image && !isGenerating && (
              <Button
                variant="ghost"
                size="sm"
                onClick={downloadImage}
                className="gap-2 rounded-[0.9rem] bg-muted/70 hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">下载图片</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="关闭"
              className="h-10 w-10 rounded-[0.9rem] bg-muted/70 hover:bg-muted"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div
          ref={containerRef}
          className="min-h-0 flex-1 overscroll-contain overflow-y-auto bg-background/55 px-5 py-6 md:px-10 md:py-8"
        >
          <div className="mx-auto w-full max-w-5xl">
            {loading ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center space-y-5">
                <div className="relative">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary md:h-20 md:w-20" />
                  <Sparkles className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 animate-pulse text-primary md:h-8 md:w-8" />
                </div>
                <div className="space-y-1.5 text-center">
                  <p className="font-medium md:text-lg">正在解读你的梦境</p>
                  <p className="text-sm text-muted-foreground">请稍候，文字完成后会自动绘制梦境画面</p>
                </div>
              </div>
            ) : result ? (
              <div className={streaming ? 'streaming-content' : 'animate-in fade-in duration-300'}>
                <div
                  className="dream-result-prose prose prose-sm mx-auto max-w-4xl dark:prose-invert md:prose-base prose-headings:font-editorial prose-headings:text-foreground prose-p:text-foreground/85 prose-strong:text-foreground prose-ul:text-foreground/85 prose-ol:text-foreground/85"
                  dangerouslySetInnerHTML={{ __html: result }}
                />
                {streaming && <span className="cursor-blink ml-1 inline-flex h-5 w-1.5 rounded-sm bg-primary align-middle" />}

                {(imageLoading || image || imageError) && (
                  <div className="mx-auto mt-10 w-full max-w-2xl md:mt-14">
                    <div className="mb-3 flex items-center justify-between gap-4">
                      <h3 className="flex items-center gap-2 font-editorial text-lg font-semibold">
                        <ImageIcon className="h-5 w-5 text-primary" />
                        梦境画面
                      </h3>
                      <span className="text-[11px] text-muted-foreground">AI 自动生成 · 16:9</span>
                    </div>
                    {imageLoading ? (
                      <div className="flex aspect-video w-full items-center justify-center rounded-3xl bg-muted/60">
                        <div className="text-center">
                          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
                          <p className="mt-3 text-xs text-muted-foreground">正在绘制梦境画面</p>
                        </div>
                      </div>
                    ) : image ? (
                      <img
                        src={image}
                        alt="梦境配图"
                        className="aspect-video w-full rounded-3xl object-cover shadow-[0_18px_50px_-30px_rgba(30,27,46,0.55)]"
                      />
                    ) : (
                      <div className="rounded-3xl bg-destructive/5 p-6 text-center">
                        <p className="text-sm text-destructive">{imageError}</p>
                        {onRetryImage && (
                          <Button variant="outline" size="sm" onClick={onRetryImage} className="mt-4 gap-2 rounded-full">
                            <RefreshCw className="h-4 w-4" />
                            重新生成配图
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="h-14 md:h-20" aria-hidden="true" />
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  )
}
