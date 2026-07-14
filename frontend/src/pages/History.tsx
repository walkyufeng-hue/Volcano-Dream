import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Heart, Image as ImageIcon, Moon, Trash2 } from 'lucide-react'
import { deleteHistoryItem, DivinationHistoryItem, getHistory } from '@/utils/divinationHistory'
import { ResultDrawer } from '@/components/ResultDrawer'
import { toast } from 'sonner'
import MarkdownIt from 'markdown-it'
import { getHistoryImage } from '@/utils/divinationImageStore'
import { getDivinationOption } from '@/config/constants'

const md = new MarkdownIt()
const HISTORY_ACTION_TOAST_ID = 'history-action'
type HistoryCategory = 'dream' | 'emotion_journal'

const HISTORY_CATEGORIES = [
  {
    key: 'dream',
    label: '梦境解读',
    emptyTitle: '还没有梦境记录',
    emptyDescription: '完成第一次梦境解读后会自动保存在这里',
    clearLabel: '清空梦境',
    icon: Moon,
  },
  {
    key: 'emotion_journal',
    label: '情绪日记',
    emptyTitle: '还没有情绪日记',
    emptyDescription: '完成第一次情绪回应后会自动保存在这里',
    clearLabel: '清空日记',
    icon: Heart,
  },
] as const

export default function HistoryPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState<HistoryCategory>('dream')
  const [history, setHistory] = useState<DivinationHistoryItem[]>([])
  const [selectedItem, setSelectedItem] = useState<DivinationHistoryItem | null>(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedImage, setSelectedImage] = useState('')
  const [imageLoading, setImageLoading] = useState(false)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    setHistory(getHistory())
  }

  const filteredHistory = useMemo(
    () => history.filter(item => item.type === activeCategory),
    [activeCategory, history],
  )

  const categoryCounts = useMemo(() => ({
    dream: history.filter(item => item.type === 'dream').length,
    emotion_journal: history.filter(item => item.type === 'emotion_journal').length,
  }), [history])

  const activeCategoryConfig = HISTORY_CATEGORIES.find(
    category => category.key === activeCategory,
  ) || HISTORY_CATEGORIES[0]

  const handleDelete = (id: string, type: string) => {
    deleteHistoryItem(id, type)
    loadHistory()
    toast.success('已删除', {
      id: HISTORY_ACTION_TOAST_ID,
      duration: 2000,
    })
  }

  const handleClearAll = () => {
    if (confirm(`确定要${activeCategoryConfig.clearLabel}记录吗？`)) {
      filteredHistory.forEach(item => deleteHistoryItem(item.id, item.type))
      loadHistory()
      toast.success(`已${activeCategoryConfig.clearLabel}`, {
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

  const selectedConfig = useMemo(() => {
    if (!selectedItem) return undefined
    return getDivinationOption(selectedItem.type)
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
            <p className="text-xs uppercase tracking-[0.22em] text-primary">Emotional archive</p>
            <h1 className="font-editorial mt-2 text-4xl font-semibold md:text-5xl">探索记录</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              当前分类保存了 {filteredHistory.length} 条记录
            </p>
          </div>
          {filteredHistory.length > 0 && (
            <Button onClick={handleClearAll} variant="outline" size="sm" className="gap-2 rounded-full text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              {activeCategoryConfig.clearLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-7 inline-flex w-full rounded-2xl bg-card p-1.5 shadow-[0_12px_36px_-28px_rgba(30,27,46,0.45)] sm:w-auto">
        {HISTORY_CATEGORIES.map((category) => {
          const Icon = category.icon
          const active = category.key === activeCategory
          return (
            <button
              key={category.key}
              type="button"
              onClick={() => setActiveCategory(category.key)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors sm:min-w-40 ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {category.label}
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                active ? 'bg-primary-foreground/15' : 'bg-muted'
              }`}>
                {categoryCounts[category.key]}
              </span>
            </button>
          )
        })}
      </div>

      <div>
          {filteredHistory.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-border py-20 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-5 h-12 w-12 opacity-40" />
              <p className="font-editorial text-xl text-foreground">{activeCategoryConfig.emptyTitle}</p>
              <p className="mt-2 text-sm">{activeCategoryConfig.emptyDescription}</p>
              <Button onClick={() => navigate('/')} className="mt-6 rounded-full bg-foreground text-background hover:bg-foreground/85">
                返回首页
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredHistory.map((item) => (
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
                          handleDelete(item.id, item.type)
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
          title={selectedItem.type === 'emotion_journal' ? '情绪回应' : '梦境解读'}
          eyebrow={selectedItem.type === 'emotion_journal' ? 'Emotional reflection' : 'Dream reading'}
          imageTitle={selectedItem.type === 'emotion_journal' ? '此刻的画面' : '梦境画面'}
          imageAlt={selectedItem.type === 'emotion_journal' ? '情绪日记配图' : '梦境配图'}
          downloadName={`火山梦绘AI-${selectedConfig?.title || '探索记录'}`}
        />
      )}
    </div>
  )
}
