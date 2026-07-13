import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Loader2, MessageSquareText, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useGlobalState } from '@/store'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export function FeedbackDialog() {
  const { jwt } = useGlobalState()
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (content.trim().length < 2) return

    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt || 'xxx'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: content.trim(), contact: contact.trim() }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || '提交失败，请稍后再试')
      }

      setSuccess(true)
      setContent('')
      setContact('')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }

  const openDialog = () => {
    setError('')
    setSuccess(false)
    setOpen(true)
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={openDialog}
        title="意见反馈"
        aria-label="意见反馈"
      >
        <MessageSquareText className="h-5 w-5" />
      </Button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-6 shadow-[0_30px_100px_-35px_rgba(0,0,0,0.65)] md:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-primary">Feedback</p>
                <h2 id="feedback-title" className="font-editorial mt-2 text-2xl font-semibold">意见反馈</h2>
                <p className="mt-1 text-sm text-muted-foreground">你的建议会帮助火山梦绘AI变得更好。</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} title="关闭">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {success ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
                <p className="mt-4 text-lg font-medium">反馈已收到</p>
                <p className="mt-1 text-sm text-muted-foreground">感谢你的认真建议。</p>
                <Button className="mt-6 rounded-full bg-foreground text-background hover:bg-foreground/85" onClick={() => setOpen(false)}>完成</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="feedback-content" className="mb-2 block text-sm font-medium">
                    反馈内容
                  </label>
                  <Textarea
                    id="feedback-content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="请描述你的建议、遇到的问题或希望增加的功能……"
                    maxLength={1000}
                    rows={6}
                    className="resize-none rounded-2xl bg-muted/45 px-4 py-3 focus-visible:ring-1 focus-visible:ring-primary"
                    autoFocus
                  />
                  <p className="mt-1 text-right text-xs text-muted-foreground">{content.length}/1000</p>
                </div>

                <div>
                  <label htmlFor="feedback-contact" className="mb-2 block text-sm font-medium">
                    联系方式 <span className="font-normal text-muted-foreground">（选填）</span>
                  </label>
                  <Input
                    id="feedback-contact"
                    value={contact}
                    onChange={(event) => setContact(event.target.value)}
                    placeholder="邮箱、微信或其他联系方式"
                    maxLength={100}
                    className="rounded-full bg-muted/45 px-4"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setOpen(false)}>取消</Button>
                  <Button type="submit" disabled={loading || content.trim().length < 2} className="gap-2 rounded-full bg-foreground text-background hover:bg-foreground/85">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    提交反馈
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
