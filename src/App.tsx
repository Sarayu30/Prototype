import { useRef, useState, type FormEvent } from 'react'
import {
  type Campaign,
  type CampaignEventName,
  createId,
  readCampaigns,
  readEvents,
  saveCampaigns,
  shouldRecommendAnalytics,
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


type Section = 'Dashboard' | 'Campaigns' | 'Student Leads' | 'Conversations' | 'Analytics' | 'Recommendations' | 'Activated Features'
const sections: Section[] = ['Dashboard', 'Campaigns', 'Student Leads', 'Conversations', 'Analytics', 'Recommendations', 'Activated Features']
const sectionIcons = ['⌂', '◫', '♙', '◌', '▥', '✧', '✓']

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [section, setSection] = useState<Section>('Dashboard')
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readCampaigns(window.localStorage))
  const [events, setEvents] = useState(() => readEvents(window.localStorage))
  const sentCampaignIds = useRef(new Set(campaigns.filter((campaign) => campaign.status === 'sent').map((campaign) => campaign.id)))
  const analyticsRecommended = shouldRecommendAnalytics(campaigns, events)

  function trackAction(eventName: CampaignEventName, campaign: Campaign, actionToken?: string) {
    setEvents(trackCampaignAction(window.localStorage, eventName, campaign, actionToken).events)
  }

  function createCampaign(name: string) {
    const campaign: Campaign = { id: createId('cmp'), name, audienceSize: 128, status: 'draft', createdAt: new Date().toISOString() }
    const updated = [campaign, ...campaigns]
    saveCampaigns(window.localStorage, updated)
    setCampaigns(updated)
    trackAction('campaign.created', campaign)
  }

  function sendCampaign(campaignId: string) {
    if (sentCampaignIds.current.has(campaignId)) return
    const campaign = campaigns.find((item) => item.id === campaignId)
    if (!campaign || campaign.status === 'sent') return
    sentCampaignIds.current.add(campaignId)
    const sentCampaign = { ...campaign, status: 'sent' as const, sentAt: new Date().toISOString() }
    const updated = campaigns.map((item) => item.id === campaignId ? sentCampaign : item)
    saveCampaigns(window.localStorage, updated)
    setCampaigns(updated)
    trackAction('campaign.sent', sentCampaign)
  }

  function viewReport(campaign: Campaign) {
    trackAction('campaign.performance_report_viewed', campaign, createId('view'))
  }

  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <div className="sidebar-school"><span className="school-avatar">B</span><span><strong>BrightPath Academy</strong><small>School workspace</small></span><span className="school-chevron">⌄</span></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{sections.map((item, index) => <button key={item} className={'nav-item ' + (section === item ? 'nav-item-active' : '')} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}><span className="nav-icon" aria-hidden="true">{sectionIcons[index]}</span><span>{item}</span>{item === 'Recommendations' && analyticsRecommended && <span className="nav-indicator" aria-label="New recommendation" />}</button>)}</nav>
      <div className="sidebar-profile"><span className="profile-avatar">RS</span><span><strong>Ravi Sharma</strong><small>Administrator</small></span><button aria-label="Log out" onClick={onLogout}>↗</button></div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div><span className="topbar-context">BrightPath Academy</span><span className="topbar-divider">/</span><strong>{section}</strong></div><button className="logout-button" onClick={onLogout}>Log out</button></header>
      <div className="workspace-page">
        {section === 'Dashboard' && <DashboardHome campaigns={campaigns} events={events} recommended={analyticsRecommended} onNavigate={setSection} />}
        {section === 'Campaigns' && <CampaignsPage campaigns={campaigns} events={events} onCreate={createCampaign} onSend={sendCampaign} onViewReport={viewReport} />}
        {section === 'Student Leads' && <StudentLeadsPage />}
        {section === 'Conversations' && <ConversationsPage />}
        {section === 'Analytics' && <PlaceholderPage section="Analytics" title="A clearer view is on the way" description="Set up Analytics to understand how your school’s outreach is performing. This preview will become your place for campaign and engagement insights." />}
        {section === 'Recommendations' && <RecommendationsPage recommended={analyticsRecommended} onExplore={() => setSection('Analytics')} />}
        {section === 'Activated Features' && <ActivatedFeaturesPage />}
      </div>
      <footer className="workspace-footer"><span>© 2026 Cheerio</span><span>Made for your next good day <span className="heart">♥</span></span></footer>
    </div>
  </main>
}

function DashboardHome({ campaigns, events, recommended, onNavigate }: { campaigns: Campaign[]; events: ReturnType<typeof readEvents>; recommended: boolean; onNavigate: (section: Section) => void }) {
  const sent = campaigns.filter((campaign) => campaign.status === 'sent')
  const familiesReached = sent.reduce((sum, campaign) => sum + campaign.audienceSize, 0)
  return <>
    <div className="page-heading"><div><div className="eyebrow">{formatToday()}</div><h1>Welcome back, Ravi</h1><p>Here’s what’s happening at BrightPath Academy.</p></div><button className="primary-action" onClick={() => onNavigate('Campaigns')}>Go to campaigns <span>→</span></button></div>
    <div className="summary-grid"><SummaryCard label="Campaigns created" value={String(campaigns.length)} detail={sent.length + ' sent'} icon="◫" /><SummaryCard label="Families reached" value={familiesReached.toLocaleString()} detail="Across sent campaigns" icon="♙" /><SummaryCard label="Recent activity" value={String(events.length)} detail="Campaign actions tracked" icon="◷" /></div>
    <div className="home-columns">
      <section className="home-panel"><div className="section-heading"><div><h2>Recent activity</h2><p>Your latest campaign actions</p></div><button className="text-action" onClick={() => onNavigate('Campaigns')}>View campaigns →</button></div>{events.length ? <ol className="activity-list">{events.slice(0, 5).map((item) => <li key={item.id}><span className="activity-dot" /><div><p>{item.description}</p><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></div></li>)}</ol> : <div className="home-empty"><span>◷</span><p>Your campaign activity will appear here as you get started.</p></div>}</section>
      <section className="home-panel recommendation-home"><div className="section-heading"><div><h2>Recommendations</h2><p>Practical next steps for your workspace</p></div><span className="recommendation-sparkle">✧</span></div>{recommended ? <div className="recommendation-card"><span className="recommendation-icon">▥</span><div><span className="recommendation-tag">READY TO EXPLORE</span><h3>Set up Analytics</h3><p>Your team is actively reviewing campaign results. Analytics can help you spot what’s working.</p><button className="text-action" onClick={() => onNavigate('Recommendations')}>Explore recommendation →</button></div></div> : <div className="recommendation-empty"><span className="recommendation-icon">✧</span><div><strong>Recommendations will appear as you work</strong><p>Send a campaign and review its report to discover helpful next steps.</p></div></div>}</section>
    </div>
  </>
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return <article className="summary-card"><span className="summary-icon">{icon}</span><div><span className="summary-label">{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

function CampaignsPage({ campaigns, events, onCreate, onSend, onViewReport }: { campaigns: Campaign[]; events: ReturnType<typeof readEvents>; onCreate: (name: string) => void; onSend: (id: string) => void; onViewReport: (campaign: Campaign) => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [reportId, setReportId] = useState<string | null>(null)
  const createLock = useRef(false)
  const report = campaigns.find((campaign) => campaign.id === reportId) ?? null

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createLock.current) return
    if (!name.trim()) { setError('Add a campaign name to continue.'); return }
    createLock.current = true
    try { onCreate(name.trim()); setName(''); setError(''); setIsCreating(false) }
    catch { createLock.current = false; setError('We couldn’t save that campaign. Please try again.') }
  }
  function toggleCreate() {
    if (isCreating) { setIsCreating(false); return }
    createLock.current = false
    setError('')
    setIsCreating(true)
  }
  function openReport(campaign: Campaign) {
    if (reportId === campaign.id) return
    setReportId(campaign.id)
    onViewReport(campaign)
  }

  return <>
    <div className="campaign-heading"><div><div className="eyebrow">BRIGHTPATH ACADEMY · CAMPAIGNS</div><h1>Your campaigns</h1><p className="dashboard-school">Create a campaign, send it to your community, and follow its impact.</p></div><button className="primary-action" onClick={toggleCreate}>{isCreating ? 'Close form' : '+ Create Campaign'}</button></div>
    {isCreating && <form className="create-campaign-form" onSubmit={submit}><div><label htmlFor="campaign-name">Campaign name</label><input id="campaign-name" autoFocus maxLength={80} placeholder="e.g. Spring study tips" value={name} onChange={(event) => setName(event.target.value)} /></div><p className="form-help">This demo campaign will be sent to 128 BrightPath families.</p>{error && <p className="campaign-error" role="alert">{error}</p>}<button className="primary-action" type="submit">Create draft</button></form>}
    <div className="campaign-columns"><section className="campaign-list-section" aria-labelledby="campaigns-heading"><div className="section-heading"><div><h2 id="campaigns-heading">Your campaigns</h2><p>{campaigns.length} {campaigns.length === 1 ? 'campaign' : 'campaigns'}</p></div></div>
      {campaigns.length === 0 ? <div className="empty-campaigns"><span className="empty-icon">✦</span><h3>Your next campaign starts here</h3><p>Create a campaign to share useful updates with the BrightPath community.</p><button className="text-action" onClick={toggleCreate}>Create your first campaign →</button></div> : <div className="campaign-list">{campaigns.map((campaign) => <article className="campaign-card" key={campaign.id}><div className="campaign-card-top"><div className="campaign-avatar">{campaign.name.charAt(0).toUpperCase()}</div><span className={'status-pill status-' + campaign.status}>{campaign.status === 'sent' ? 'Sent' : 'Draft'}</span></div><h3>{campaign.name}</h3><p className="campaign-meta">{campaign.audienceSize} BrightPath families · Created {formatDate(campaign.createdAt)}</p><div className="campaign-actions"><button className="secondary-action" onClick={() => openReport(campaign)}>View Performance Report →</button><button className="send-action" disabled={campaign.status === 'sent'} onClick={() => onSend(campaign.id)}>{campaign.status === 'sent' ? 'Campaign sent' : 'Send Campaign'}</button></div></article>)}</div>}
      {report && <section className="report-panel" aria-live="polite" aria-labelledby="report-heading"><div className="report-title-row"><div><div className="eyebrow">CAMPAIGN REPORT</div><h2 id="report-heading">{report.name}</h2></div><button className="icon-button" aria-label="Close report" onClick={() => setReportId(null)}>×</button></div>{report.status === 'sent' ? <><p className="report-subtitle">Sent {formatDate(report.sentAt ?? report.createdAt)} · Demo audience results</p><div className="metric-grid"><Metric label="Delivered" value={String(Math.round(report.audienceSize * 0.96))} detail={'of ' + report.audienceSize + ' families'} /><Metric label="Opened" value={String(Math.round(report.audienceSize * 0.96 * 0.68))} detail="68% open rate" /><Metric label="Engaged" value={String(Math.round(report.audienceSize * 0.96 * 0.68 * 0.27))} detail="27% of readers" /></div></> : <div className="report-draft-note"><span>✦</span><div><strong>Your report will be ready after sending.</strong><p>Send this campaign to see delivery, opens, and engagement for your demo audience.</p></div></div>}</section>}
      </section><aside className="activity-panel"><div className="section-heading"><div><h2>Recent activity</h2><p>Campaign actions, in order</p></div><span className="activity-count">{events.length}</span></div>{events.length === 0 ? <div className="activity-empty"><span>◷</span><p>Your campaign activity will appear here.</p></div> : <ol className="activity-list">{events.slice(0, 8).map((item) => <li key={item.id}><span className="activity-dot" /><div><p>{item.description}</p><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></div></li>)}</ol>}</aside></div>
    <details className="reviewer-panel"><summary>Reviewer event log <span>Technical event names, IDs, and timestamps</span></summary>{events.length === 0 ? <p className="reviewer-empty">No events have been recorded yet.</p> : <div className="reviewer-table-wrap"><table className="reviewer-table"><thead><tr><th>Event name</th><th>Event ID</th><th>Timestamp</th></tr></thead><tbody>{events.map((item) => <tr key={item.id}><td><code>{item.eventName}</code></td><td><code>{item.id}</code></td><td><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></td></tr>)}</tbody></table></div>}</details>
  </>
}

function StudentLeadsPage() {
  const leads = [
    { name: 'Aarav Mehta', grade: 'Grade 8', interest: 'Study skills', status: 'New', updated: 'Today, 9:42 AM' },
    { name: 'Nisha Iyer', grade: 'Grade 9', interest: 'Math support', status: 'Contacted', updated: 'Yesterday' },
    { name: 'Ananya Rao', grade: 'Grade 10', interest: 'Science program', status: 'Interested', updated: 'Oct 10' },
    { name: 'Kabir Shah', grade: 'Grade 9', interest: 'Study skills', status: 'New', updated: 'Oct 9' },
  ]
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Student Leads" description="A quick look at families who are exploring BrightPath." /><section className="data-panel"><div className="section-heading"><div><h2>Recent leads</h2><p>Demo student inquiries</p></div><span className="activity-count">{leads.length}</span></div><div className="table-scroll"><table className="leads-table"><thead><tr><th>Student</th><th>Interest</th><th>Status</th><th>Last updated</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.name}><td><strong>{lead.name}</strong><small>{lead.grade}</small></td><td>{lead.interest}</td><td><span className={'lead-status lead-' + lead.status.toLowerCase()}>{lead.status}</span></td><td>{lead.updated}</td></tr>)}</tbody></table></div></section></>
}

function ConversationsPage() {
  const conversations = [
    { initials: 'PM', name: 'Priya Mehta', topic: 'Question about the Grade 8 study program', preview: 'Thanks for sharing the schedule. Could you tell me…', time: '10:24 AM', unread: true },
    { initials: 'SI', name: 'Sanjay Iyer', topic: 'Math support sessions', preview: 'That sounds helpful for Nisha. We’d like to learn more.', time: 'Yesterday', unread: true },
    { initials: 'AR', name: 'Ananya Rao', topic: 'BrightPath summer programs', preview: 'I’ll review the details with my family this weekend.', time: 'Oct 10', unread: false },
  ]
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Conversations" description="Recent family conversations in your workspace." /><section className="data-panel conversation-panel"><div className="section-heading"><div><h2>Recent messages</h2><p>Demo conversation preview</p></div></div>{conversations.map((item) => <article className="conversation-row" key={item.name}><span className="conversation-avatar">{item.initials}</span><div className="conversation-copy"><div><strong>{item.name}</strong><span>{item.time}</span></div><b>{item.topic}</b><p>{item.preview}</p></div>{item.unread && <span className="unread-dot" aria-label="Unread" />}</article>)}</section></>
}

function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading simple-page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div></div>
}

function PlaceholderPage({ section, title, description }: { section: string; title: string; description: string }) {
  return <><PageHeader eyebrow={'BRIGHTPATH ACADEMY · ' + section.toUpperCase()} title={section} description={description} /><section className="placeholder-card"><span className="placeholder-icon">{section === 'Analytics' ? '▥' : '✧'}</span><h2>{title}</h2><p>This section is a preview for your BrightPath workspace. Your existing campaign workflow is ready to use while this area takes shape.</p><span className="coming-soon">COMING SOON</span></section></>
}

function RecommendationsPage({ recommended, onExplore }: { recommended: boolean; onExplore: () => void }) {
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Recommendations" description="Next steps based on how your team is using Cheerio." />{recommended ? <section className="recommendation-detail"><div className="recommendation-detail-icon">▥</div><div className="recommendation-detail-copy"><span className="recommendation-tag">BASED ON YOUR CAMPAIGN ACTIVITY</span><h2>Set up Analytics</h2><p>You’ve sent a campaign and reviewed its performance report three times within seven days. Analytics can help your team see trends across future outreach.</p><button className="primary-action" onClick={onExplore}>Explore <span>→</span></button></div></section> : <section className="placeholder-card recommendation-none"><span className="placeholder-icon">✧</span><h2>No recommendations yet</h2><p>Keep using campaigns and their reports. Helpful next steps will appear here when your activity points to them.</p></section>}</>
}

function ActivatedFeaturesPage() {
  const features = [{ name: 'Campaigns', status: 'Active', icon: '◫' }, { name: 'Student Leads', status: 'Preview', icon: '♙' }, { name: 'Conversations', status: 'Preview', icon: '◌' }, { name: 'Analytics', status: 'Not set up', icon: '▥' }]
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Activated Features" description="A simple overview of the tools in your workspace." /><div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.name}><span className="feature-icon">{feature.icon}</span><div><h2>{feature.name}</h2><p>{feature.status === 'Active' ? 'Ready to use in your workspace' : feature.status === 'Preview' ? 'Demo preview available' : 'Setup will be available later'}</p></div><span className={'feature-status ' + (feature.status === 'Active' ? 'feature-active' : '')}>{feature.status}</span></article>)}</div></>
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

function formatToday() {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase()
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  return isLoggedIn ? <Dashboard onLogout={() => setIsLoggedIn(false)} /> : <Login onLogin={() => setIsLoggedIn(true)} />
}
