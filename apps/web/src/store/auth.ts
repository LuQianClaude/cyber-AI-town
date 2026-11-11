import { create } from 'zustand'
import { api, defaultSession, type AuthTokens, type UserOut } from '@cyber-universe/api-client'

interface AuthState {
  user: UserOut | null
  ready: boolean
  bootstrap: () => Promise<void>
  applyTokens: (tokens: AuthTokens) => void
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  bootstrap: async () => {
    if (!defaultSession.storage.getRefresh()) {
      set({ ready: true })
      return
    }
    try {
      const user = await api.auth.me()
      set({ user, ready: true })
    } catch {
      defaultSession.storage.clear()
      set({ user: null, ready: true })
    }
  },
  applyTokens: (tokens) => {
    defaultSession.storage.setTokens(tokens.access_token, tokens.refresh_token)
    set({ user: tokens.user })
  },
  logout: async () => {
    defaultSession.storage.clear()
    set({ user: null })
  },
}))
