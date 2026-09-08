import { useEffect, useState } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useGlobalState } from '@/store'
import AboutPage from '@/pages/About'
import LoginPage from '@/pages/Login'
import HistoryPage from '@/pages/History'
import DreamPage from '@/pages/divination/DreamPage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RefreshCw, Sparkles } from 'lucide-react'
import MainLayout from '@/layouts/MainLayout'
import { Button } from '@/components/ui/button'

const API_BASE = import.meta.env.VITE_API_BASE || ''

function App() {
  const {
    jwt,
    setSettings,
    settings
  } = useGlobalState()

  const [loading, setLoading] = useState(false)

  const fetchSettings = async () => {
    setLoading(true)
    setSettings({ error: null })
    try {
      const response = await fetch(`${API_BASE}/api/v1/settings`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt || 'xxx'}`,
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const data = await response.json()
        setSettings({ ...data, fetched: true, error: null })
      } else {
        setSettings({
          fetched: true,
          error: `Failed to fetch settings: ${response.status} ${response.statusText}`,
        })
      }
    } catch (error: unknown) {
      console.error(error)
      const message = error instanceof Error ? error.message : '未知错误'
      setSettings({
        fetched: true,
        error: `Failed to fetch settings: ${message}`,
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary/20 border-t-primary mx-auto"></div>
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-primary animate-pulse" />
            </div>
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              星辰指引中...
            </p>
          </div>
        </div>
      )}

      <MainLayout>
        {settings.error && (
          <Alert variant="destructive" className="mx-auto mb-5 max-w-5xl bg-card">
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>暂时无法获取服务状态。你仍可浏览页面，也可以重新连接。</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-2"
                onClick={() => void fetchSettings()}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                重新连接
              </Button>
            </AlertDescription>
          </Alert>
        )}
        <Routes>
          <Route path="/" element={<DreamPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/divination/dream" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/login/:login_type" element={<LoginPage />} />
          <Route path="/history/dream" element={<HistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MainLayout>
      <Toaster />
    </>
  )
}

export default App
