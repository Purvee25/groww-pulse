import { useState, useEffect, useRef } from 'react'
import api from '../lib/api'

interface WatchlistInfo {
  id: number
  name: string
  created_at: string
  item_count: number
}

interface Props {
  activeId: number | null
  onChange: (id: number | null) => void
}

export function WatchlistPicker({ activeId, onChange }: Props) {
  const [lists, setLists] = useState<WatchlistInfo[]>([])
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    try {
      const res = await api.get('/watchlists')
      setLists(res.data)
      // Auto-select the first list if nothing is selected
      if (activeId === null && res.data.length > 0) {
        onChange(null) // null = all lists
      }
    } catch {
      // silently fail — REST watchlist still works without named lists
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setEditingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const activeName = lists.find(l => l.id === activeId)?.name ?? 'All Lists'

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      const res = await api.post('/watchlists', { name: newName.trim() })
      setLists(prev => [...prev, res.data])
      onChange(res.data.id)
      setNewName('')
      setCreating(false)
      setOpen(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Could not create watchlist')
    }
  }

  const handleRename = async (id: number) => {
    if (!editName.trim()) { setEditingId(null); return }
    try {
      const res = await api.patch(`/watchlists/${id}`, { name: editName.trim() })
      setLists(prev => prev.map(l => l.id === id ? { ...l, name: res.data.name } : l))
      setEditingId(null)
    } catch { setEditingId(null) }
  }

  const handleArchive = async (id: number) => {
    if (!confirm('Archive this watchlist? Items will be unassigned.')) return
    try {
      await api.delete(`/watchlists/${id}`)
      setLists(prev => prev.filter(l => l.id !== id))
      if (activeId === id) onChange(null)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      alert(msg ?? 'Could not archive watchlist')
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: 'var(--surface-2, var(--surface))',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          padding: '0.4rem 0.75rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        📂 {activeName} <span style={{ opacity: 0.5, fontSize: '0.75rem' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 50,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          minWidth: '220px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          padding: '0.5rem',
        }}>
          {/* All lists option */}
          <button
            onClick={() => { onChange(null); setOpen(false) }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: 'none',
              background: activeId === null ? 'var(--info-bg, rgba(83,103,255,0.12))' : 'transparent',
              color: activeId === null ? 'var(--brand)' : 'var(--text)',
              cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            All Lists
          </button>

          <div style={{ height: '1px', background: 'var(--border)', margin: '0.4rem 0' }} />

          {lists.map(wl => (
            <div key={wl.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {editingId === wl.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRename(wl.id)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(wl.id); if (e.key === 'Escape') setEditingId(null) }}
                  style={{
                    flex: 1, background: 'var(--surface-2, var(--surface))',
                    border: '1px solid var(--brand)', borderRadius: '0.4rem',
                    color: 'var(--text)', padding: '0.35rem 0.5rem', fontSize: '0.875rem',
                  }}
                />
              ) : (
                <button
                  onClick={() => { onChange(wl.id); setOpen(false) }}
                  onDoubleClick={() => { setEditingId(wl.id); setEditName(wl.name) }}
                  style={{
                    flex: 1, textAlign: 'left', padding: '0.5rem 0.75rem',
                    borderRadius: '0.4rem', border: 'none',
                    background: activeId === wl.id ? 'var(--info-bg, rgba(83,103,255,0.12))' : 'transparent',
                    color: activeId === wl.id ? 'var(--brand)' : 'var(--text)',
                    cursor: 'pointer', fontSize: '0.875rem',
                  }}
                >
                  {wl.name}
                  <span style={{ opacity: 0.45, fontSize: '0.75rem', marginLeft: '0.35rem' }}>
                    ({wl.item_count})
                  </span>
                </button>
              )}
              {lists.length > 1 && (
                <button
                  onClick={() => handleArchive(wl.id)}
                  title="Archive"
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: '0.25rem', fontSize: '0.8rem',
                    borderRadius: '0.25rem',
                  }}
                >🗑</button>
              )}
            </div>
          ))}

          <div style={{ height: '1px', background: 'var(--border)', margin: '0.4rem 0' }} />

          {creating ? (
            <div style={{ display: 'flex', gap: '0.4rem', padding: '0.25rem 0.5rem' }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewName('') } }}
                placeholder="List name"
                style={{
                  flex: 1, background: 'var(--surface-2, var(--surface))',
                  border: '1px solid var(--border)', borderRadius: '0.4rem',
                  color: 'var(--text)', padding: '0.35rem 0.5rem', fontSize: '0.875rem',
                }}
              />
              <button
                onClick={handleCreate}
                style={{
                  background: 'var(--brand)', color: 'white', border: 'none',
                  borderRadius: '0.4rem', padding: '0.35rem 0.6rem', fontSize: '0.8rem',
                  fontWeight: 700, cursor: 'pointer',
                }}
              >+</button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '0.5rem 0.75rem', borderRadius: '0.4rem', border: 'none',
                background: 'transparent', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              + New list
            </button>
          )}
        </div>
      )}
    </div>
  )
}
