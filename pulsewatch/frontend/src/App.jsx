import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Bell, Check,
  ChevronDown, CircleHelp, Cpu, Database, Gauge, HardDrive, LayoutDashboard,
  Menu, Moon, Network, RefreshCw, Server, Settings as SettingsIcon, ShieldCheck,
  Sun, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useMetrics } from './hooks/useMetrics'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard, target: 'overview' },
  { label: 'Systems', icon: Server, target: 'systems' },
  { label: 'Alerts', icon: Bell, target: 'alerts' },
  { label: 'Settings', icon: SettingsIcon, target: 'settings' },
]

const ranges = [
  { label: '5 minutes', value: 5 * 60 * 1000 },
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
]

function formatBytes(bytes) {
  if (bytes == null || !Number.isFinite(Number(bytes))) return '—'
  const value = Number(bytes)
  if (value < 1024) return `${value.toFixed(0)} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let amount = value
  let index = -1
  do {
    amount /= 1024
    index += 1
  } while (amount >= 1024 && index < units.length - 1)
  return `${amount.toFixed(amount < 10 ? 1 : 0)} ${units[index]}`
}

function formatRate(rate) {
  return rate == null ? '—' : `${formatBytes(rate)}/s`
}

function formatUptime(seconds) {
  if (seconds == null) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return days ? `${days}d ${hours}h` : `${hours}h ${minutes}m`
}

function formatTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function connectionCopy(status) {
  return {
    live: ['Live', 'status-live'],
    connecting: ['Connecting', 'status-connecting'],
    reconnecting: ['Reconnecting', 'status-connecting'],
    offline: ['Offline', 'status-offline'],
  }[status] || ['Offline', 'status-offline']
}

function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

function MetricCard({ title, value, unit, icon: Icon, tone, helper, loading }) {
  return (
    <article className="metric-card card">
      <div className="metric-card-top">
        <span className="metric-label">{title}</span>
        <span className={`metric-icon ${tone}`}><Icon size={18} strokeWidth={2} /></span>
      </div>
      {loading ? <Skeleton className="metric-skeleton" /> : (
        <div className="metric-value">{value}<span>{unit}</span></div>
      )}
      <div className="metric-helper">{helper}</div>
    </article>
  )
}

function EmptyState({ icon: Icon = Activity, title, detail }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={20} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  )
}

function HistoryChart({ metrics, loading }) {
  const [range, setRange] = useState(ranges[1])
  const chartData = useMemo(() => {
    const cutoff = Date.now() - range.value
    return metrics
      .filter((item) => item.timestamp && new Date(item.timestamp).getTime() >= cutoff)
      .map((item) => ({
        ...item,
        timeLabel: formatTime(item.timestamp),
      }))
  }, [metrics, range])

  return (
    <section className="card chart-card" aria-labelledby="history-heading">
      <div className="section-heading chart-heading">
        <div>
          <div className="eyebrow">PERFORMANCE</div>
          <h2 id="history-heading">Resource utilization</h2>
          <p>CPU and memory usage over time</p>
        </div>
        <div className="range-tabs" role="group" aria-label="Chart time range">
          {ranges.map((item) => (
            <button
              className={range.label === item.label ? 'range-tab selected' : 'range-tab'}
              key={item.label}
              onClick={() => setRange(item)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div className="chart-skeleton"><Skeleton /></div> : chartData.length ? (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cpuFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6558f5" stopOpacity={0.19} />
                  <stop offset="95%" stopColor="#6558f5" stopOpacity={0.005} />
                </linearGradient>
                <linearGradient id="memoryFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#21b8a6" stopOpacity={0.16} />
                  <stop offset="95%" stopColor="#21b8a6" stopOpacity={0.005} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" strokeDasharray="3 5" vertical={false} />
              <XAxis dataKey="timeLabel" axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} minTickGap={32} />
              <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: 'var(--subtle)', fontSize: 11 }} tickFormatter={(value) => `${value}%`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--text)', boxShadow: '0 8px 24px rgba(16,24,40,.1)' }}
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === 'cpu_percent' ? 'CPU' : 'Memory']}
                labelStyle={{ color: 'var(--muted)', marginBottom: 5 }}
              />
              <Area type="monotone" dataKey="cpu_percent" name="cpu_percent" stroke="#6558f5" strokeWidth={2.25} fill="url(#cpuFill)" connectNulls />
              <Area type="monotone" dataKey="memory_percent" name="memory_percent" stroke="#21b8a6" strokeWidth={2.25} fill="url(#memoryFill)" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title="Waiting for your first metrics"
          detail="As soon as PulseWatch receives samples from your server, CPU and memory history will appear here."
        />
      )}
      <div className="chart-legend">
        <span><i className="legend-dot cpu-dot" />CPU usage</span>
        <span><i className="legend-dot memory-dot" />Memory usage</span>
        <span className="chart-sample">{chartData.length ? `${chartData.length} samples` : 'No samples yet'}</span>
      </div>
    </section>
  )
}

function NetworkPanel({ metric }) {
  return (
    <section className="card network-card">
      <div className="section-heading">
        <div>
          <div className="eyebrow">TRAFFIC</div>
          <h2>Network activity</h2>
          <p>Current throughput and cumulative transfer</p>
        </div>
        <span className="heading-icon"><Network size={18} /></span>
      </div>
      {metric ? (
        <>
          <div className="traffic-rates">
            <div className="traffic-rate">
              <span className="traffic-label"><ArrowDownToLine size={15} /> Inbound</span>
              <strong>{formatRate(metric.network_recv_rate)}</strong>
              <span className="traffic-caption">Receiving</span>
            </div>
            <div className="traffic-rate">
              <span className="traffic-label outbound"><ArrowUpFromLine size={15} /> Outbound</span>
              <strong>{formatRate(metric.network_sent_rate)}</strong>
              <span className="traffic-caption">Sending</span>
            </div>
          </div>
          <div className="transfer-total">
            <div><span>Total received</span><strong>{formatBytes(metric.network_bytes_recv)}</strong></div>
            <div><span>Total sent</span><strong>{formatBytes(metric.network_bytes_sent)}</strong></div>
          </div>
        </>
      ) : (
        <EmptyState icon={Network} title="No network sample yet" detail="Traffic details will show when the first server sample arrives." />
      )}
    </section>
  )
}

function SystemPanel({ system, metric }) {
  const details = [
    ['Hostname', metric?.hostname || system?.hostname],
    ['Operating system', system ? `${system.platform} ${system.platform_release}` : null],
    ['Architecture', system?.architecture],
    ['Processor cores', metric?.cpu_count],
    ['Python version', system?.python_version],
    ['Uptime', formatUptime(metric?.uptime_seconds)],
  ]
  return (
    <section className="card system-card" id="systems">
      <div className="section-heading">
        <div>
          <div className="eyebrow">INFRASTRUCTURE</div>
          <h2>System information</h2>
          <p>Details reported by the monitored host</p>
        </div>
        <span className="heading-icon"><Server size={18} /></span>
      </div>
      {system || metric ? (
        <div className="system-grid">
          {details.map(([label, value]) => (
            <div className="system-detail" key={label}>
              <span>{label}</span>
              <strong>{value == null || value === '—' ? '—' : value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Server} title="Host information unavailable" detail="System details appear once the backend is reachable." />
      )}
    </section>
  )
}

function AlertsPanel({ alerts }) {
  const recent = alerts.slice(0, 5)
  return (
    <section className="card alerts-card" id="alerts">
      <div className="section-heading">
        <div>
          <div className="eyebrow">ACTIVITY</div>
          <h2>Recent alerts</h2>
          <p>Threshold events reported by your server</p>
        </div>
        <span className="alert-count">{alerts.filter((item) => item.active).length} active</span>
      </div>
      {recent.length ? (
        <div className="alerts-list">
          {recent.map((alert) => (
            <div className="alert-row" key={alert.id}>
              <span className={alert.active ? 'alert-symbol active' : 'alert-symbol'}>
                {alert.active ? <AlertTriangle size={17} /> : <Check size={17} />}
              </span>
              <div className="alert-copy">
                <strong>{alert.message}</strong>
                <span>{alert.metric_type} · {new Date(alert.triggered_at).toLocaleString()}</span>
              </div>
              <span className={alert.active ? 'alert-state is-active' : 'alert-state'}>{alert.active ? 'Active' : 'Resolved'}</span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={ShieldCheck} title="All clear" detail="No alerts have been reported. Threshold notifications will appear here." />
      )}
    </section>
  )
}

function SettingsPanel({ settings, saveSettings }) {
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const update = (key, value) => {
    setNotice('')
    setForm((current) => ({ ...current, [key]: value }))
  }
  const submit = async (event) => {
    event.preventDefault()
    if (!form) return
    setSaving(true)
    setNotice('')
    try {
      await saveSettings({
        ...form,
        cpu_threshold: Number(form.cpu_threshold),
        memory_threshold: Number(form.memory_threshold),
        disk_threshold: Number(form.disk_threshold),
        cooldown_seconds: Number(form.cooldown_seconds),
        retention_count: Number(form.retention_count),
        sample_interval_seconds: Number(form.sample_interval_seconds),
      })
      setNotice('Your settings have been saved.')
    } catch (error) {
      setNotice(error.message || 'Could not save your settings.')
    } finally {
      setSaving(false)
    }
  }
  const thresholds = [
    ['cpu_threshold', 'CPU usage', 'Alert when processor usage reaches this level.'],
    ['memory_threshold', 'Memory usage', 'Alert when memory usage reaches this level.'],
    ['disk_threshold', 'Disk usage', 'Alert when disk usage reaches this level.'],
  ]

  return (
    <section className="card settings-card" id="settings">
      <div className="section-heading">
        <div>
          <div className="eyebrow">PREFERENCES</div>
          <h2>Alert thresholds</h2>
          <p>Configure monitoring and notification behavior</p>
        </div>
        <span className="heading-icon"><SettingsIcon size={18} /></span>
      </div>
      {form ? (
        <form onSubmit={submit}>
          <div className="threshold-list">
            {thresholds.map(([key, label, description]) => (
              <label className="threshold-row" key={key}>
                <span><strong>{label}</strong><small>{description}</small></span>
                <span className="threshold-input"><input aria-label={label} type="number" min="0" max="100" step="1" value={form[key]} onChange={(event) => update(key, event.target.value)} required /><i>%</i></span>
              </label>
            ))}
          </div>
          <div className="settings-options">
            <label>Alert cooldown (seconds)<input type="number" min="0" max="86400" value={form.cooldown_seconds} onChange={(event) => update('cooldown_seconds', event.target.value)} /></label>
            <label>Sample interval (seconds)<input type="number" min="1" max="60" value={form.sample_interval_seconds} onChange={(event) => update('sample_interval_seconds', event.target.value)} /></label>
            <label>Metric retention (samples)<input type="number" min="1" max="100000" value={form.retention_count} onChange={(event) => update('retention_count', event.target.value)} /></label>
          </div>
          <div className="settings-footer">
            <span className={notice.includes('saved') ? 'settings-notice success' : 'settings-notice'} role="status">{notice}</span>
            <button className="primary-button" disabled={saving} type="submit">{saving ? <RefreshCw className="spin" size={15} /> : <Check size={15} />}{saving ? 'Saving…' : 'Save changes'}</button>
          </div>
        </form>
      ) : (
        <div className="settings-loading"><Skeleton /><Skeleton /><Skeleton /></div>
      )}
    </section>
  )
}

export default function App() {
  const { metrics, system, alerts, settings, loading, connection, error, refresh, saveSettings } = useMetrics()
  const [dark, setDark] = useState(false)
  const [activeNav, setActiveNav] = useState('overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const current = metrics[metrics.length - 1]
  const [statusText, statusClass] = connectionCopy(connection)

  const navigate = (target) => {
    setActiveNav(target)
    setMobileOpen(false)
    const section = document.getElementById(target)
    if (section && 'scrollIntoView' in section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className={`app-shell${dark ? ' theme-dark' : ''}`}>
      <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Activity size={21} strokeWidth={2.5} /></span>
          <span>pulse<span>watch</span></span>
          <button className="mobile-close icon-button" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="host-switcher">
          <span className="host-avatar"><Server size={16} /></span>
          <span className="host-switcher-copy"><strong>{current?.hostname || 'Your server'}</strong><small>Single host</small></span>
          <ChevronDown size={15} className="host-chevron" />
        </div>
        <div className="nav-label">MONITORING</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon, target }) => (
            <button className={activeNav === target ? 'nav-item active' : 'nav-item'} key={target} onClick={() => navigate(target)}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
              {target === 'alerts' && alerts.some((alert) => alert.active) && <i className="nav-alert-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><CircleHelp size={17} /><span>Need a hand?</span><ChevronDown size={14} /></div>
          <div className="profile">
            <div className="profile-avatar">PW</div>
            <div><strong>PulseWatch</strong><small>Monitoring workspace</small></div>
            <span className="profile-menu">···</span>
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <main className="main-content">
        <header className="topbar">
          <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><i>/</i><strong>Overview</strong></div>
          <div className="topbar-actions">
            <span className={`connection-pill ${statusClass}`}><i />{statusText}</span>
            <span className="topbar-divider" />
            <button className="icon-button theme-button" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setDark(!dark)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button refresh-button" aria-label="Refresh dashboard" onClick={refresh}><RefreshCw size={17} /></button>
            <div className="user-avatar">PW</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-title-row" id="overview">
            <div>
              <div className="title-overline"><span className="title-pulse" /> SERVER MONITORING</div>
              <h1>Overview</h1>
              <p>Welcome back. Here's what's happening with your server.</p>
            </div>
            <div className="updated-label"><span>Last updated</span><strong>{current ? formatTime(current.timestamp) : '—'}</strong></div>
          </section>

          {error && <div className="inline-error" role="alert"><AlertTriangle size={16} />{error}<button onClick={refresh}>Retry</button></div>}

          {connection !== 'live' && (
            <div className={`connection-banner ${connection}`}>
              <span className="banner-dot" />
              <span>
                <strong>{connection === 'connecting' ? 'Connecting to your server…' : connection === 'reconnecting' ? 'Connection interrupted — retrying automatically' : 'Server is offline'}</strong>
                <small>{connection === 'offline' ? 'Showing the latest data received. New metrics will appear when the connection is restored.' : 'Live updates will appear as soon as the monitoring service is available.'}</small>
              </span>
              {connection === 'offline' && <button onClick={refresh}>Try again</button>}
            </div>
          )}

          <section className="metrics-grid" aria-label="Current metrics">
            <MetricCard title="CPU usage" value={current?.cpu_percent == null ? '—' : Number(current.cpu_percent).toFixed(1)} unit={current?.cpu_percent == null ? '' : '%'} icon={Cpu} tone="purple" helper={current ? `${current.cpu_count ?? '—'} cores available` : 'Waiting for metric data'} loading={loading} />
            <MetricCard title="Memory usage" value={current?.memory_percent == null ? '—' : Number(current.memory_percent).toFixed(1)} unit={current?.memory_percent == null ? '' : '%'} icon={Database} tone="teal" helper={current ? `${formatBytes(current.memory_used_bytes)} of ${formatBytes(current.memory_total_bytes)}` : 'Waiting for metric data'} loading={loading} />
            <MetricCard title="Disk usage" value={current?.disk_percent == null ? '—' : Number(current.disk_percent).toFixed(1)} unit={current?.disk_percent == null ? '' : '%'} icon={HardDrive} tone="amber" helper={current ? `${formatBytes(current.disk_used_bytes)} of ${formatBytes(current.disk_total_bytes)}` : 'Waiting for metric data'} loading={loading} />
            <MetricCard title="System uptime" value={current ? formatUptime(current.uptime_seconds) : '—'} unit="" icon={Gauge} tone="blue" helper={current?.hostname || 'Waiting for host information'} loading={loading} />
          </section>

          <div className="primary-grid">
            <HistoryChart metrics={metrics} loading={loading} />
            <NetworkPanel metric={current} />
          </div>
          <div className="secondary-grid">
            <SystemPanel system={system} metric={current} />
            <AlertsPanel alerts={alerts} />
          </div>
          <SettingsPanel settings={settings} saveSettings={saveSettings} />
          <footer className="page-footer"><span><span className="footer-mark"><Activity size={14} /></span> PulseWatch</span><span>Real-time visibility for your infrastructure</span><span>Data from your monitoring agent</span></footer>
        </div>
      </main>
    </div>
  )
}
