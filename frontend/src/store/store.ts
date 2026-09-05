import { create } from 'zustand'
import type { BriefItem } from '../components/StockDetail'

interface User {
  email: string
}

interface WatchlistItem {
  symbol: string
  thesis_note?: string
  added_at: string
}

interface Store {
  user: User | null
  setUser: (user: User | null) => void
  watchlist: WatchlistItem[]
  setWatchlist: (items: WatchlistItem[]) => void
  brief: BriefItem[]
  setBrief: (items: BriefItem[]) => void
  selectedTab: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PORTFOLIO'
  setSelectedTab: (tab: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'PORTFOLIO') => void
}

export const useStore = create<Store>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  watchlist: [],
  setWatchlist: (items) => set({ watchlist: items }),
  brief: [],
  setBrief: (items) => set({ brief: items }),
  selectedTab: 'ALL',
  setSelectedTab: (tab) => set({ selectedTab: tab }),
}))
