import { useRef, useState, type FormEvent } from 'react'
import {
  type Campaign,
  type CampaignEventName,
  createId,
  readCampaigns,
  readEvents,
  saveCampaigns,
  trackCampaignAction,
} from './campaignStore'

const DEMO_EMAIL = 'ravi@brightpath.edu'
const DEMO_PASSWORD = 'cheerio123'

function Brand() {
  return (
    <a className="brand" href="#home" aria-label="Cheerio home">
      <span className="brand-mark" aria-hidden="true">c</span>
      <span>cheerio</span>
    </a>
  )
}

function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (email.trim().toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
      setError('Those details don’t match our demo account. Try the credentials below.')
      return
    }
    onLogin()
  }

  return (
    <main className="login-shell">
      <header className="topbar"><Brand /><span className="topbar-note">Your learning journey, together</span></header>
      <section className="login-layout" aria-labelledby="welcome-heading">
        <div className="welcome-panel">
          <div className="eyebrow"><span className="eyebrow-dot" /> A little support goes a long way</div>
          <h1 id="welcome-heading">Make room for<br /><span>what’s next.</span></h1>
          <p className="welcome-copy">A calmer way to stay on top of school, build good habits, and feel good about your progress.</p>
          <div className="quote-card">
            <div className="quote-symbol" aria-hidden="true">“</div>
            <p>Small steps still move you forward.</p>
            <span>YOUR CHEERIO REMINDER</span>
          </div>
          <div className="welcome-decoration decoration-one" /><div className="welcome-decoration decoration-two" />
        </div>

        <div className="form-wrap">
          <div className="form-heading">
            <div className="mobile-brand"><Brand /></div>
            <div className="eyebrow form-eyebrow">WELCOME BACK</div>
            <h2>Let’s pick up<br />where you left off.</h2>
            <p>Sign in to your Cheerio account to continue.</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="email">Email address</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error)} />
            <div className="password-label"><label htmlFor="password">Password</label></div>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(error)} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="login-button" type="submit">Log in <span aria-hidden="true">→</span></button>
          </form>
          <div className="demo-note">
            <span className="demo-icon" aria-hidden="true">✦</span>
            <div><strong>Demo access</strong><span>{DEMO_EMAIL} · {DEMO_PASSWORD}</span></div>
          </div>
          <p className="privacy-note"><span aria-hidden="true">▣</span> Your information stays private and secure.</p>
        </div>
      </section>
      <footer className="page-footer"><span>© 2026 Cheerio</span><span>Made for your next good day <span className="heart">♥</span></span></footer>
    </main>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readCampaigns(window.localStorage))
  const [events, setEvents] = useState(() => readEvents(window.localStorage))
  const [isCreating, setIsCreating] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [createError, setCreateError] = useState('')
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const createLock = useRef(false)
  const sentCampaignIds = useRef(new Set(campaigns.filter((campaign) => campaign.status === 'sent').map((campaign) => campaign.id)))

  function trackAction(eventName: CampaignEventName, campaign: Campaign) {
    const result = trackCampaignAction(window.localStorage, eventName, campaign)
    setEvents(result.events)
  }

  function toggleCreateForm() {
    if (isCreating) {
      setIsCreating(false)
      return
    }
    createLock.current = false
    setCreateError('')
    setIsCreating(true)
  }

  function handleCreateCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createLock.current) return
    const name = campaignName.trim()
    if (!name) {
      setCreateError('Add a campaign name to continue.')
      return
    }

    createLock.current = true
    try {
      const campaign: Campaign = {
        id: createId('cmp'),
        name,
        audienceSize: 128,
        status: 'draft',
        createdAt: new Date().toISOString(),
      }
      const updated = [campaign, ...campaigns]
      saveCampaigns(window.localStorage, updated)
      setCampaigns(updated)
      trackAction('campaign.created', campaign)
      setCampaignName('')
      setCreateError('')
      setIsCreating(false)
    } catch {
      createLock.current = false
      setCreateError('We couldn’t save that campaign. Please try again.')
    }
  }

  function handleSendCampaign(campaignId: string) {
    if (sentCampaignIds.current.has(campaignId)) return
    const campaign = campaigns.find((item) => item.id === campaignId)
    if (!campaign || campaign.status === 'sent') return

    sentCampaignIds.current.add(campaignId)
    const sentAt = new Date().toISOString()
    const sentCampaign = { ...campaign, status: 'sent' as const, sentAt }
    const updated = campaigns.map((item) => item.id === campaignId ? sentCampaign : item)
    saveCampaigns(window.localStorage, updated)
    setCampaigns(updated)
    trackAction('campaign.sent', sentCampaign)
  }

  function handleViewReport(campaign: Campaign) {
    setActiveReportId(campaign.id)
    const alreadyViewed = events.some((item) => item.campaignId === campaign.id && item.eventName === 'campaign.performance_report_viewed')
    if (!alreadyViewed) trackAction('campaign.performance_report_viewed', campaign)
  }

  const activeReport = campaigns.find((campaign) => campaign.id === activeReportId) ?? null

  return (
    <main className="dashboard-shell campaign-dashboard">
      <header className="topbar dashboard-topbar"><Brand /><button className="logout-button" onClick={onLogout}>Log out</button></header>
      <section className="dashboard-content campaign-content">
        <div className="campaign-heading">
          <div><div className="eyebrow">BRIGHTPATH ACADEMY · CAMPAIGNS</div><h1>Welcome, Ravi Sharma</h1><p className="dashboard-school">Create a campaign, send it to your community, and follow its impact.</p></div>
          <button className="primary-action" onClick={toggleCreateForm}>{isCreating ? 'Close form' : '+ Create Campaign'}</button>
        </div>

        {isCreating && <form className="create-campaign-form" onSubmit={handleCreateCampaign}>
          <div><label htmlFor="campaign-name">Campaign name</label><input id="campaign-name" autoFocus maxLength={80} placeholder="e.g. Spring study tips" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} /></div>
          <p className="form-help">This demo campaign will be sent to 128 BrightPath families.</p>
          {createError && <p className="campaign-error" role="alert">{createError}</p>}
          <button className="primary-action" type="submit">Create draft</button>
        </form>}

        <div className="campaign-columns">
          <section className="campaign-list-section" aria-labelledby="campaigns-heading">
            <div className="section-heading"><div><h2 id="campaigns-heading">Your campaigns</h2><p>{campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}</p></div></div>
            {campaigns.length === 0 ? <div className="empty-campaigns"><span className="empty-icon" aria-hidden="true">✦</span><h3>Your next campaign starts here</h3><p>Create a campaign to share useful updates with the BrightPath community.</p><button className="text-action" onClick={() => setIsCreating(true)}>Create your first campaign <span aria-hidden="true">→</span></button></div> : <div className="campaign-list">{campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}>
              <div className="campaign-card-top"><div className="campaign-avatar" aria-hidden="true">{campaign.name.charAt(0).toUpperCase()}</div><span className={`status-pill status-${campaign.status}`}>{campaign.status === 'sent' ? 'Sent' : 'Draft'}</span></div>
              <h3>{campaign.name}</h3><p className="campaign-meta">{campaign.audienceSize} BrightPath families · Created {formatDate(campaign.createdAt)}</p>
              <div className="campaign-actions"><button className="secondary-action" onClick={() => handleViewReport(campaign)}>View Performance Report <span aria-hidden="true">→</span></button><button className="send-action" disabled={campaign.status === 'sent'} onClick={() => handleSendCampaign(campaign.id)}>{campaign.status === 'sent' ? 'Campaign sent' : 'Send Campaign'}</button></div>
            </article>)}</div>}

            {activeReport && <section className="report-panel" aria-live="polite" aria-labelledby="report-heading">
              <div className="report-title-row"><div><div className="eyebrow">CAMPAIGN REPORT</div><h2 id="report-heading">{activeReport.name}</h2></div><button className="icon-button" aria-label="Close report" onClick={() => setActiveReportId(null)}>×</button></div>
              {activeReport.status === 'sent' ? <><p className="report-subtitle">Sent {formatDate(activeReport.sentAt ?? activeReport.createdAt)} · Demo audience results</p><div className="metric-grid">
                <Metric label="Delivered" value={`${Math.round(activeReport.audienceSize * 0.96)}`} detail={`of ${activeReport.audienceSize} families`} />
                <Metric label="Opened" value={`${Math.round(activeReport.audienceSize * 0.96 * 0.68)}`} detail="68% open rate" />
                <Metric label="Engaged" value={`${Math.round(activeReport.audienceSize * 0.96 * 0.68 * 0.27)}`} detail="27% of readers" />
              </div></> : <div className="report-draft-note"><span aria-hidden="true">✦</span><div><strong>Your report will be ready after sending.</strong><p>Send this campaign to see delivery, opens, and engagement for your demo audience.</p></div></div>}
            </section>}
          </section>

          <aside className="activity-panel" aria-labelledby="activity-heading">
            <div className="section-heading"><div><h2 id="activity-heading">Recent activity</h2><p>Campaign actions, in order</p></div><span className="activity-count">{events.length}</span></div>
            {events.length === 0 ? <div className="activity-empty"><span aria-hidden="true">◷</span><p>Your campaign activity will appear here.</p></div> : <ol className="activity-list">{events.slice(0, 8).map((item) => <li key={item.id}><span className="activity-dot" /><div><p>{item.description}</p><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></div></li>)}</ol>}
          </aside>
        </div>

        <details className="reviewer-panel">
          <summary>Reviewer event log <span>Technical event names, IDs, and timestamps</span></summary>
          {events.length === 0 ? <p className="reviewer-empty">No events have been recorded yet.</p> : <div className="reviewer-table-wrap"><table className="reviewer-table"><thead><tr><th>Event name</th><th>Event ID</th><th>Timestamp</th></tr></thead><tbody>{events.map((item) => <tr key={item.id}><td><code>{item.eventName}</code></td><td><code>{item.id}</code></td><td><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></td></tr>)}</tbody></table></div>}
        </details>
      </section>
      <footer className="page-footer"><span>© 2026 Cheerio</span><span>Made for your next good day <span className="heart">♥</span></span></footer>
    </main>
  )
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  return isLoggedIn ? <Dashboard onLogout={() => setIsLoggedIn(false)} /> : <Login onLogin={() => setIsLoggedIn(true)} />
}
