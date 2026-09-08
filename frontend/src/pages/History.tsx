import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Calendar, Download, Image as ImageIcon } from 'lucide-react'
import {
  clearHistory,
  deleteHistoryItem,
  DivinationHistoryItem,
  getHistoryByType,
  getHistoryMetadata,
  markHistoryImageSaved,
} from '@/utils/divinationHistory'
import { ResultDrawer } from '@/components/ResultDrawer'
import { toast } from 'sonner'
import MarkdownIt from 'markdown-it'
import { getHistoryImage, saveHistoryImage } from '@/utils/divinationImageStore'

const md = new MarkdownIt()
const HISTORY_ACTION_TOAST_ID = 'history-action'
const API_BASE = import.meta.env.VITE_API_BASE || ''

export default function HistoryPage() {
  const navigate = useNavigate()
  const type = 'dream'
  const [history, setHistory] = useState<DivinationHistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<DivinationHistoryItem | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    loadHistory()
  }, [type])

  const loadHistory = () => {
    setHistory(getHistoryByType(type))
  }

  const handleDelete = (id: string) => {
    deleteHistoryItem(id, type)
    loadHistory()
    toast.success('已删除', {
      id: HISTORY_ACTION_TOAST_ID,
      duration: 2000,
    })
  }

  const handleClearAll = () => {
    if (confirm('确定要清空所有历史记录吗？')) {
      clearHistory()
      loadHistory()
      toast.success('已清空所有历史记录', {
        id: HISTORY_ACTION_TOAST_ID,
        duration: 2000,
      })
    }
  }

  const handleViewResult = async (item: DivinationHistoryItem) => {
    setSelectedItem(item)
    setSelectedImage('')
    setImageError('')
    setShowDrawer(true)
    if (!item.hasImage) {
      setImageError('这条梦境还没有配图')
      return
    }

    setImageLoading(true)
    try {
      const savedImage = await getHistoryImage(item.id)
      setSelectedImage(savedImage)
      if (!savedImage) setImageError('已保存的配图无法读取，可以重新生成')
    } catch (error) {
      console.error('Failed to load history image:', error)
    } finally {
      setImageLoading(false)
    }
  }

  const handleExport = async () => {
    const exportedHistory = await Promise.all(history.map(async (item) => ({
      ...item,
      ...getHistoryMetadata(item),
      image: item.hasImage ? await getHistoryImage(item.id).catch(() => '') : '',
    })))
    const blob = new Blob(
      [JSON.stringify({ exportedAt: Date.now(), dreams: exportedHistory }, null, 2)],
      { type: 'application/json;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `火山梦绘-梦境档案-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    toast.success('梦境档案已导出', {
      id: HISTORY_ACTION_TOAST_ID,
      duration: 2000,
    })
  }

  const regenerateSelectedImage = async () => {
    if (!selectedItem || imageLoading) return
    setImageLoading(true)
    setImageError('')
    try {
      const tokenResponse = await fetch(`${API_BASE}/api/dream-image/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dream: selectedItem.prompt,
          interpretation: selectedItem.analysis?.image_prompt || selectedItem.result,
        }),
      })
      if (!tokenResponse.ok) throw new Error('无法重新创建配图任务')
      const { token } = await tokenResponse.json()
      const imageResponse = await fetch(`${API_BASE}/api/dream-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const imageData = await imageResponse.json().catch(() => null)
      if (!imageResponse.ok || !imageData?.image) {
        throw new Error(imageData?.detail || '梦境配图生成失败')
      }
      await saveHistoryImage(selectedItem.id, imageData.image)
      markHistoryImageSaved(selectedItem.id, selectedItem.type)
      setSelectedImage(imageData.image)
      setSelectedItem((current) => current ? { ...current, hasImage: true } : current)
      loadHistory()
    } catch (error) {
      setImageError(error instanceof Error ? error.message : '梦境配图生成失败')
    } finally {
      setImageLoading(false)
    }
  }

  // 将 markdown 渲染成 HTML
  const renderedResult = useMemo(() => {
    if (!selectedItem) return ''
    return md.render(selectedItem.result)
  }, [selectedItem])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`

    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="mx-auto max-w-5xl animate-in fade-in duration-500">
      <div className="mb-10 pb-4">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Dream archive</p>
            <h1 className="font-editorial mt-2 text-4xl font-semibold md:text-5xl">解梦记录</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              当前浏览器保存了 {history.length} 条记录
            </p>
          </div>
          {history.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void handleExport()} variant="outline" size="sm" className="gap-2 rounded-full">
                <Download className="h-4 w-4" />
                导出档案
              </Button>
              <Button onClick={handleClearAll} variant="outline" size="sm" className="gap-2 rounded-full text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
                清空所有
              </Button>
            </div>
          )}
        </div>
      </div>

      <div>
          {history.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-border py-20 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-5 h-12 w-12 opacity-40" />
              <p className="font-editorial text-xl text-foreground">还没有梦境记录</p>
              <p className="mt-2 text-sm">完成第一次解梦后会自动保存在这里</p>
              <Button onClick={() => navigate('/')} className="mt-6 rounded-full bg-foreground text-background hover:bg-foreground/85">
                去记录一个梦
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {history.map((item) => {
                const metadata = getHistoryMetadata(item)
                return (
                <Card
                  key={item.id}
                  className="group cursor-pointer rounded-2xl border-border bg-card shadow-none transition-all hover:-translate-y-0.5 hover:border-foreground/25"
                  onClick={() => void handleViewResult(item)}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex min-h-32 items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="mb-5 flex flex-wrap items-center gap-2">
                          <span className="font-editorial text-base font-semibold text-foreground">{metadata.title}</span>
                          <span className="text-xs text-muted-foreground">· {formatDate(item.timestamp)}</span>
                          {item.status === 'interrupted' && (
                            <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">未完成</span>
                          )}
                          {item.hasImage && (
                            <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-1 text-xs text-secondary">
                              <ImageIcon className="h-3 w-3" />
                              配图
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-2 text-sm leading-6 text-foreground/85">
                          {item.prompt}
                        </p>
                        {(metadata.mood || metadata.symbols.length > 0) && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {metadata.mood && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">{metadata.mood}</span>
                            )}
                            {metadata.symbols.map((symbol) => (
                              <span key={symbol} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{symbol}</span>
                            ))}
                          </div>
                        )}
                        {metadata.summary && (
                          <p className="mt-4 line-clamp-3 text-xs leading-5 text-muted-foreground">
                            {metadata.summary}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(item.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                )
              })}
            </div>
          )}
      </div>

      {/* 结果抽屉 */}
      {selectedItem && (
        <ResultDrawer
          show={showDrawer}
          onClose={() => setShowDrawer(false)}
          result={renderedResult}
          loading={false}
          streaming={false}
          image={selectedImage}
          imageLoading={imageLoading}
          imageError={imageError}
          analysis={selectedItem.analysis}
          onRetryImage={() => void regenerateSelectedImage()}
        />
      )}
    </div>
  )
}
