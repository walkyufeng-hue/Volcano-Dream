import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Settings {
  fetched: boolean
  error: string | null
  user_name?: string
  login_type?: string
  enable_login?: boolean
  enable_rate_limit?: boolean
  rate_limit?: string
}

interface GlobalState {
  isDark: boolean
  jwt: string
  settings: Settings
  toggleDark: () => void
  setJwt: (jwt: string) => void
  setSettings: (settings: Partial<Settings>) => void
}

export const useGlobalState = create<GlobalState>()(
  persist(
    (set) => ({
      isDark: false,
      jwt: '',
      settings: { fetched: false, error: null },
      toggleDark: () => set((state) => ({ isDark: !state.isDark })),
      setJwt: (jwt) => set({ jwt }),
      setSettings: (settings) =>
        set((state) => ({ settings: { ...state.settings, ...settings } })),
    }),
    { name: 'global-state' }
  )
)
