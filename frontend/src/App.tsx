import { useEffect, useState } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useGlobalState } from '@/store'
import AboutPage from '@/pages/About'
import LoginPage from '@/pages/Login'
import HistoryPage from '@/pages/History'
import DreamPage from '@/pages/divination/DreamPage'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles } from 'lucide-react'
import MainLayout from '@/layouts/MainLayout'

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
        {settings.fetched && !settings.error ? (
          <Routes>
            <Route path="/" element={<DreamPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/divination/dream" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/:login_type" element={<LoginPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/history/dream" element={<Navigate to="/history" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        ) : settings.error ? (
          <Alert variant="destructive" className="glass">
            <AlertDescription>{settings.error}</AlertDescription>
          </Alert>
        ) : null}
      </MainLayout>
      <Toaster />
    </>
  )
}

export default App
