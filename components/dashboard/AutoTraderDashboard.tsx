"use client"
import { useMemo, useState } from 'react'
import { useAutoTrader, AutoPosition, AutoTrade } from '../../lib/useAutoTrader'

// ── Formatting helpers (mirror auto-trader-ui.js) ────────────────────────────
function fmt(n: number, dec = 2): string {
  const v = Number(n)
  return isNaN(v) ? '—' : v.toFixed(dec)
}
function fmtUsd(n: number): string {
  const v = Number(n)
  if (isNaN(v)) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}$${Math.abs(v).toFixed(2)}`
}
function pnlColor(n: number): string {
  const v = Number(n)
  if (isNaN(v) || v === 0) return 'var(--slate)'
  return v > 0 ? 'var(--green)' : 'var(--red)'
}
function timeSince(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  if (isNaN(diff)) return '—'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

type Tab = 'overview' | 'positions' | 'trades'

export default function AutoTraderDashboard() {
  const { state, loading, acting, refetch, runAction } = useAutoTrader(5000)
  const [tab, setTab] = useState<Tab>('overview')

  const s = state
  const stats = s?.stats
  const cfg = s?.config
  const winRate = stats && stats.totalTrades > 0 ? (stats.wins / stats.totalTrades) * 100 : 0
  const positions = s?.positions ?? []
  const trades = s?.recentTrades ?? []

  const totalPosPnl = useMemo(
    () => positions.reduce((acc, p) => acc + (Number(p.pnlUsd) || 0), 0),
    [positions]
  )

  const mode = useMemo(() => {
    if (!s) return { label: 'SCANNING', cls: 'offline', sub: 'Menghubungkan ke engine auto-trader…' }
    if (s.circuitBreaker)
      return { label: 'CIRCUIT BREAKER', cls: 'error', sub: 'Trading dihentikan otomatis — reset untuk lanjut' }
    if (!s.running) return { label: 'PAUSED', cls: 'warn', sub: 'Bot terhubung tapi sedang dijeda' }
    if (s.dryRun) return { label: 'PAPER TRADING', cls: 'paper', sub: 'Mode simulasi — tidak ada dana nyata' }
    return { label: 'LIVE', cls: 'live', sub: 'Mode live — menggunakan dana nyata' }
  }, [s])

  const regimeColor = (r: string) => {
    switch ((r || '').toLowerCase()) {
      case 'bull': return 'var(--green)'
      case 'bear': return 'var(--red)'
      case 'ranging': return 'var(--amber)'
      default: return 'var(--slate)'
    }
  }

  const equityDelta = s ? s.totalEquity - (s.peakEquity || s.totalEquity) : 0
  const equityPct = s && s.peakEquity > 0 ? ((equityDelta / s.peakEquity) * 100) : 0

  return (
    <div className="at-dash">
      {/* ── Profile Header ─────────────────────────────────────────────── */}
      <section className="at-profile">
        <div className="at-profile-id">
          <div className="at-avatar">
            <div className="at-avatar-ring" />
            {/* Foto profil dashboard — diganti dari teks "WR" ke ic_icon.png
                (gambar yang sama dengan yang dulu dipakai logo Navbar). */}
            <span className="at-avatar-core">
              <img src="/assets/ic_icon.png" alt="WhaleRadar profile" />
            </span>
          </div>
          <div className="at-profile-meta">
            <div className="at-profile-name">
              WhaleRadar Trader
              <span className={`at-mode-dot ${mode.cls}`} />
            </div>
            <div className="at-profile-sub">{mode.sub}</div>
          </div>
        </div>
        <div className="at-profile-right">
          <span className={`at-status-pill at-status-${mode.cls}`}>
            <span className="at-dot" />
            {mode.label}
          </span>
          <button
            className="at-btn at-btn-ghost"
            onClick={() => refetch()}
            disabled={loading}
            title="Refresh state"
          >
            ↻
          </button>
        </div>
      </section>

      {/* ── PNL + Saldo (below the profile) ───────────────────────────── */}
      <section className="at-balance-strip">
        <div className="at-kpi at-kpi-primary">
          <div className="at-kpi-label">Saldo / Equity</div>
          <div className="at-kpi-value">${fmt(s?.totalEquity ?? 0)}</div>
          <div
            className="at-kpi-sub"
            style={{ color: equityDelta >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {fmtUsd(equityDelta)} ({fmt(equityPct)}%) dari peak
          </div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi-label">Peak Equity</div>
          <div className="at-kpi-value">${fmt(s?.peakEquity ?? 0)}</div>
          <div className="at-kpi-sub">All-time high</div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi-label">Daily P&L</div>
          <div className="at-kpi-value" style={{ color: pnlColor(s?.dailyPnl ?? 0) }}>
            {fmtUsd(s?.dailyPnl ?? 0)}
          </div>
          <div className="at-kpi-sub">Hari ini</div>
        </div>
        <div className="at-kpi">
          <div className="at-kpi-label">Total P&L</div>
          <div className="at-kpi-value" style={{ color: pnlColor(s?.totalPnl ?? 0) }}>
            {fmtUsd(s?.totalPnl ?? 0)}
          </div>
          <div className="at-kpi-sub">Semua waktu</div>
        </div>
      </section>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <section className="at-card">
        <div className="at-tabs">
          {(['overview', 'positions', 'trades'] as Tab[]).map((t) => (
            <button
              key={t}
              className={`at-tab ${tab === t ? 'is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'overview' && 'Overview'}
              {t === 'positions' && `Posisi (${positions.length})`}
              {t === 'trades' && `Riwayat (${trades.length})`}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="at-overview">
            {/* Performance metrics */}
            <div className="at-stat-grid">
              <div className="at-stat">
                <span className="at-stat-k">Win Rate</span>
                <span className="at-stat-v" style={{ color: winRate >= 50 ? 'var(--green)' : 'var(--red)' }}>
                  {stats && stats.totalTrades > 0 ? `${winRate.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="at-stat">
                <span className="at-stat-k">Wins / Losses</span>
                <span className="at-stat-v neutral">
                  {stats ? `${stats.wins}W / ${stats.losses}L` : '—'}
                </span>
              </div>
              <div className="at-stat">
                <span className="at-stat-k">Best Trade</span>
                <span className="at-stat-v" style={{ color: 'var(--green)' }}>
                  {fmtUsd(stats?.bestTrade ?? 0)}
                </span>
              </div>
              <div className="at-stat">
                <span className="at-stat-k">Worst Trade</span>
                <span className="at-stat-v" style={{ color: 'var(--red)' }}>
                  {fmtUsd(stats?.worstTrade ?? 0)}
                </span>
              </div>
              <div className="at-stat">
                <span className="at-stat-k">Drawdown</span>
                <span className="at-stat-v" style={{ color: (s?.drawdownPct ?? 0) > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {fmt(s?.drawdownPct ?? 0)}%
                </span>
              </div>
              <div className="at-stat">
                <span className="at-stat-k">Market Regime</span>
                <span className="at-stat-v" style={{ color: regimeColor(s?.marketRegime || '') }}>
                  {(s?.marketRegime || 'unknown').toUpperCase()}
                </span>
              </div>
            </div>

            {/* Strategy & risk config */}
            <div className="at-cfg">
              <div className="at-cfg-head">
                <span className="at-cfg-title">Konfigurasi Bot</span>
                <span className="at-cfg-badge">{s?.dryRun ? 'SIMULASI' : 'LIVE'}</span>
              </div>
              <div className="at-cfg-row">
                <div className="at-cfg-item">
                  <div className="at-cfg-k">Risk / Trade</div>
                  <div className="at-cfg-v">{(cfg?.riskPct ?? 1.5).toFixed(1)}%</div>
                </div>
                <div className="at-cfg-item">
                  <div className="at-cfg-k">Max Positions</div>
                  <div className="at-cfg-v">{cfg?.maxPositions ?? 5}</div>
                </div>
                <div className="at-cfg-item">
                  <div className="at-cfg-k">Max Daily Loss</div>
                  <div className="at-cfg-v">{(cfg?.maxDailyLoss ?? 5).toFixed(0)}%</div>
                </div>
                <div className="at-cfg-item">
                  <div className="at-cfg-k">Leverage</div>
                  <div className="at-cfg-v">{cfg?.leverage ? `${cfg.leverage}x` : '—'}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="at-actions">
              {s?.circuitBreaker ? (
                <button
                  className="at-btn at-btn-warn"
                  onClick={() => runAction('reset-circuit')}
                  disabled={acting === 'reset-circuit'}
                >
                  {acting === 'reset-circuit' ? '…' : 'Reset Circuit Breaker'}
                </button>
              ) : (
                <div className="at-action-note">
                  <span className={`at-dot ${mode.cls}`} />
                  Bot {s?.running ? 'berjalan' : 'dijeda'} · {mode.cls === 'live' ? 'LIVE' : 'PAPER'} ·{' '}
                  {positions.length}/{cfg?.effectiveMaxPos ?? cfg?.maxPositions ?? 5} posisi aktif
                </div>
              )}
              <button
                className="at-btn at-btn-danger"
                onClick={() => runAction('close-all')}
                disabled={positions.length === 0 || acting === 'close-all'}
              >
                {acting === 'close-all' ? 'Menutup…' : 'Tutup Semua Posisi'}
              </button>
            </div>
          </div>
        )}

        {tab === 'positions' && (
          <AtPositions positions={positions} />
        )}

        {tab === 'trades' && (
          <AtTrades trades={trades} />
        )}
      </section>

      <div className="at-footer-note">
        <span className={`at-dot ${mode.cls}`} />
        Sumber: <code>{s?.source ?? '…'}</code> · auto-refresh 5s ·{' '}
        {positions.length} posisi · {trades.length} riwayat
      </div>
    </div>
  )
}

function AtPositions({ positions }: { positions: AutoPosition[] }) {
  return (
    <div className="at-table-wrap">
      {positions.length === 0 ? (
        <div className="at-empty">Tidak ada posisi terbuka.</div>
      ) : (
        <table className="at-table">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Sisi</th>
              <th className="num">Entry</th>
              <th className="num">Mark</th>
              <th className="num">P&L</th>
              <th className="num">Stop Loss</th>
              <th className="num">TP1</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const pnl = Number(p.pnlUsd || 0)
              const pnlPct = p.sizeUsd ? (pnl / p.sizeUsd) * 100 : 0
              return (
                <tr key={`${p.coinId}-${p.side}`}>
                  <td>
                    <b>{p.coinSymbol?.toUpperCase() || '?'}</b>
                  </td>
                  <td>
                    <span className={`at-side ${p.side === 'buy' ? 'long' : 'short'}`}>
                      {p.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="num">${fmt(p.entryPrice, 6)}</td>
                  <td className="num">${fmt(p.currentPrice || p.entryPrice, 6)}</td>
                  <td className="num" style={{ color: pnlColor(pnl), fontWeight: 700 }}>
                    {fmtUsd(pnl)} ({pnlPct.toFixed(2)}%)
                    {p.tp1Hit && <span className="at-tp-chip">TP1✓</span>}
                    {p.tp2Hit && <span className="at-tp-chip">TP2✓</span>}
                  </td>
                  <td className="num">
                    ${fmt(p.stopLoss, 6)}
                    {p.trailActive && <span className="at-trail">↻</span>}
                  </td>
                  <td className="num">${fmt(p.tp1, 6)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

function AtTrades({ trades }: { trades: AutoTrade[] }) {
  return (
    <div className="at-table-wrap">
      {trades.length === 0 ? (
        <div className="at-empty">Belum ada riwayat trade.</div>
      ) : (
        <table className="at-table">
          <thead>
            <tr>
              <th>Coin</th>
              <th>Sisi</th>
              <th className="num">Entry</th>
              <th className="num">Exit</th>
              <th className="num">P&L</th>
              <th>Alasan</th>
              <th>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const pnl = Number(t.pnlUsd || 0)
              return (
                <tr key={`${t.coinId}-${i}`}>
                  <td>
                    <b>{t.coinSymbol?.toUpperCase() || '?'}</b>
                  </td>
                  <td>
                    <span className={`at-side ${t.side === 'buy' ? 'long' : 'short'}`}>
                      {t.side === 'buy' ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="num">${fmt(t.entryPrice, 6)}</td>
                  <td className="num">${fmt(t.exitPrice, 6)}</td>
                  <td className="num" style={{ color: pnlColor(pnl), fontWeight: 700 }}>
                    {fmtUsd(pnl)} ({fmt(t.pnlPct, 2)}%)
                  </td>
                  <td className="muted">{t.reason || '—'}</td>
                  <td className="muted">{timeSince(t.closedAt)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}