import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2, Calendar, Image as ImageIcon } from 'lucide-react'
import { getHistoryByType, deleteHistoryItem, DivinationHistoryItem } from '@/utils/divinationHistory'
import { ResultDrawer } from '@/components/ResultDrawer'
import { toast } from 'sonner'
import MarkdownIt from 'markdown-it'
import { getHistoryImage } from '@/utils/divinationImageStore'

const md = new MarkdownIt()
const HISTORY_ACTION_TOAST_ID = 'history-action'

export default function HistoryPage() {
  const navigate = useNavigate()
  const type = 'dream'
  const [history, setHistory] = useState<DivinationHistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<DivinationHistoryItem | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [imageLoading, setImageLoading] = useState(false)

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
      // 清空该类型的所有记录
      const allHistory = getHistoryByType(type)
      allHistory.forEach(item => deleteHistoryItem(item.id, type))
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
    setShowDrawer(true)
    if (!item.hasImage) return

    setImageLoading(true)
    try {
      setSelectedImage(await getHistoryImage(item.id))
    } catch (error) {
      console.error('Failed to load history image:', error)
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
            <Button onClick={handleClearAll} variant="outline" size="sm" className="gap-2 rounded-full text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              清空所有
            </Button>
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
              {history.map((item) => (
                <Card
                  key={item.id}
                  className="group cursor-pointer rounded-2xl border-border bg-card shadow-none transition-all hover:-translate-y-0.5 hover:border-foreground/25"
                  onClick={() => void handleViewResult(item)}
                >
                  <CardContent className="p-5 md:p-6">
                    <div className="flex min-h-32 items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="mb-5 flex flex-wrap items-center gap-2">
                          <span className="text-xs uppercase tracking-[0.16em] text-primary">{item.title}</span>
                          <span className="text-xs text-muted-foreground">· {formatDate(item.timestamp)}</span>
                          {item.hasImage && (
                            <span className="flex items-center gap-1 rounded-full bg-secondary/10 px-2 py-1 text-xs text-secondary">
                              <ImageIcon className="h-3 w-3" />
                              配图
                            </span>
                          )}
                        </div>
                        <p className="line-clamp-3 font-editorial text-lg leading-7 text-foreground/85">
                          {item.prompt}
                        </p>
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
              ))}
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
        />
      )}
    </div>
  )
}
