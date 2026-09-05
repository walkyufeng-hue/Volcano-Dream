import { ReactNode, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { History, Info, LogIn, LogOut, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { useGlobalState } from '@/store'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { settings, setJwt } = useGlobalState()

  const logOut = () => {
    setJwt('')
    window.location.reload()
  }

  const navClass = (active: boolean) => (
    `text-sm transition-colors ${active ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`
  )

  const closeMobileMenu = () => setMobileMenuOpen(false)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground selection:bg-primary/20">
      <div className="pointer-events-none fixed -right-48 -top-56 h-[38rem] w-[38rem] rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

      <header className="sticky top-0 z-50 px-4 pt-4 md:px-8 md:pt-6">
        <div className="relative mx-auto flex h-[58px] w-full max-w-6xl items-center justify-between rounded-[1.25rem] bg-card/95 px-3.5 shadow-[0_10px_34px_-22px_rgba(30,27,46,0.45)] backdrop-blur-xl md:h-[72px] md:rounded-3xl md:px-[22px]">
          <Link to="/" className="group flex items-center gap-2.5 md:gap-3" aria-label="火山梦绘AI首页">
            <img
              src="/volcano-dream-logo.png"
              alt=""
              className="h-8 w-8 rounded-xl object-cover ring-1 ring-foreground/10 transition-transform group-hover:-rotate-3 md:h-9 md:w-9"
            />
            <div className="leading-none">
              <p className="font-editorial text-base font-semibold md:text-lg">火山梦绘AI</p>
              <p className="mt-1 hidden text-[9px] uppercase tracking-[0.22em] text-primary sm:block">
                Volcano Dream AI
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="主要导航">
            <Link to="/" className={navClass(location.pathname === '/')}>首页</Link>
            <Link to="/history" className={navClass(location.pathname.startsWith('/history'))}>探索记录</Link>
            <Link to="/about" className={navClass(location.pathname === '/about')}>关于</Link>
          </nav>

          <div className="flex items-center gap-1">
            {settings.enable_login && (
              settings.user_name ? (
                <Button variant="ghost" size="sm" onClick={logOut} className="hidden gap-2 md:flex">
                  <LogOut className="h-4 w-4" />
                  登出
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden gap-2 md:flex">
                  <LogIn className="h-4 w-4" />
                  登录
                </Button>
              )
            )}
            <div className="[&_button]:h-10 [&_button]:w-10 [&_button]:rounded-[0.9rem] [&_button]:bg-muted/70 [&_button]:hover:bg-muted">
              <FeedbackDialog />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-[0.9rem] bg-muted/70 hover:bg-muted md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {mobileMenuOpen && (
            <div className="absolute inset-x-0 top-[66px] rounded-2xl bg-card p-2 shadow-[0_24px_60px_-28px_rgba(30,27,46,0.5)] md:hidden">
              <Link to="/" onClick={closeMobileMenu} className="flex items-center rounded-xl px-4 py-3 text-sm hover:bg-muted">首页</Link>
              <Link to="/history" onClick={closeMobileMenu} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm hover:bg-muted">
                <History className="h-4 w-4" />探索记录
              </Link>
              <Link to="/about" onClick={closeMobileMenu} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm hover:bg-muted">
                <Info className="h-4 w-4" />关于
              </Link>
              {settings.enable_login && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    closeMobileMenu()
                    if (settings.user_name) logOut()
                    else navigate('/login')
                  }}
                >
                  {settings.user_name ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                  {settings.user_name ? '登出' : '登录'}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="relative mx-auto min-h-[calc(100vh-8rem)] w-full max-w-7xl px-4 py-8 md:px-8 md:py-12">
        {children}
      </main>

      <footer className="relative">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-7 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-0">
          <p>© 2026 火山 · Volcano Dream AI</p>
          <p>AI回应仅供记录与自我反思，不构成专业建议。</p>
        </div>
      </footer>
    </div>
  )
}
