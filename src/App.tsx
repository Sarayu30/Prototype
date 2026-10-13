import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  type AnalyticsRecommendation,
  type Campaign,
  type CampaignEventName,
  createId,
  dismissAnalyticsRecommendation,
  evaluateAnalyticsRecommendations,
  readDemoSession,
  readCampaigns,
  readEvents,
  saveAnalyticsRecommendationDiagnostics,
  saveAnalyticsRecommendationExplanation,
  saveCampaigns,
  saveDemoSession,
  shouldRecommendAnalytics,
  trackCampaignAction,
} from './campaignStore'
import { pathForSection, sectionForPath, sections, type Section } from './navigation'
import { activateAnalyticsSetup, readAnalyticsSetup, startAnalyticsSetup, updateAnalyticsSetup, type AnalyticsMetric, type AnalyticsSetup, type ReportFrequency } from './analyticsSetup'
import { createPendingAnalyticsDiagnostics, requestAnalyticsExplanation } from './analyticsExplanation'

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


function SidebarIcon({ section }: { section: Section }) {
  const icon = {
    Dashboard: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
    Campaigns: <><path d="m3 11 18-5-5 13-3-6-6-2z" /><path d="m13 13 3 6" /></>,
    'Student Leads': <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    Conversations: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>,
    Analytics: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /></>,
    Recommendations: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z" /><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z" /></>,
    'Activated Features': <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" /><path d="m9 12 2 2 4-4" /></>,
  }[section]

  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
}

function ExplanationModeLabel({ recommendation }: { recommendation: AnalyticsRecommendation }) {
  if (recommendation.explanationMode === 'fallback') return null
  const label = recommendation.explanationMode === 'groq' ? 'GROQ PERSONALIZED' : 'PREPARING EXPLANATION'
  return <span className={'ai-explanation-label ai-explanation-' + (recommendation.explanationMode ?? 'pending')}>{label}</span>
}

function ReviewerAiDiagnostics({ recommendation }: { recommendation: AnalyticsRecommendation | null }) {
  const diagnostics = recommendation?.aiDiagnostics
  return <section className="reviewer-ai-diagnostics" aria-label="Groq explanation diagnostics">
    <h3>Groq explanation diagnostics</h3>
    {!recommendation ? <p>No Analytics recommendation has qualified, so no Groq request was made.</p> : !diagnostics ? <p>Recommendation qualified. Waiting for the server request to start.</p> : <dl>
      <div><dt>Status</dt><dd>{diagnostics.status}</dd></div>
      <div><dt>Key loaded on server</dt><dd>{diagnostics.keyConfigured === null ? 'Unknown — app API was unreachable' : diagnostics.keyConfigured ? 'Yes (value hidden)' : 'No'}</dd></div>
      <div><dt>Requested model</dt><dd>{diagnostics.requestedModel ?? diagnostics.model ?? 'Not reported by server'}</dd></div>
      <div><dt>Model</dt><dd>{diagnostics.model ?? 'Not reported by server'}</dd></div>
      {diagnostics.modelFallback && <div><dt>Model fallback</dt><dd>Scout unavailable; used {diagnostics.model}</dd></div>}
      <div><dt>HTTP status</dt><dd>{diagnostics.httpStatus ?? '—'}</dd></div>
      <div><dt>Error code</dt><dd>{diagnostics.errorCode ?? '—'}</dd></div>
      <div><dt>Attempted</dt><dd>{formatDateTime(diagnostics.attemptedAt)}</dd></div>
      {diagnostics.completedAt && <div><dt>Completed</dt><dd>{formatDateTime(diagnostics.completedAt)}</dd></div>}
      <div className="reviewer-ai-message"><dt>Details</dt><dd>{diagnostics.message}</dd></div>
    </dl>}
  </section>
}

type CampaignFormValues = Pick<Campaign, 'name' | 'label' | 'type' | 'channels' | 'audience' | 'audienceSize' | 'message' | 'scheduledAt'> & { channels: string[] }

function Dashboard({ section, onNavigate, onLogout }: { section: Section; onNavigate: (section: Section) => void; onLogout: () => void }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => readCampaigns(window.localStorage))
  const [events, setEvents] = useState(() => readEvents(window.localStorage))
  const [recommendations, setRecommendations] = useState(() => evaluateAnalyticsRecommendations(window.localStorage, readCampaigns(window.localStorage), readEvents(window.localStorage)))
  const [analyticsSetup, setAnalyticsSetup] = useState<AnalyticsSetup | null>(() => readAnalyticsSetup(window.localStorage))
  const [analyticsSetupOpen, setAnalyticsSetupOpen] = useState(false)
  const sentCampaignIds = useRef(new Set(campaigns.filter((campaign) => campaign.status === 'sent').map((campaign) => campaign.id)))
  const requestedExplanationIds = useRef(new Set<string>())
  const activeRecommendation = recommendations.find((recommendation) => !recommendation.dismissedAt) ?? null
  const analyticsRecommended = activeRecommendation !== null

  useEffect(() => {
    if (section !== 'Analytics') setAnalyticsSetupOpen(false)
  }, [section])

  useEffect(() => {
    if (!activeRecommendation || (activeRecommendation.explanationMode !== 'pending' && activeRecommendation.explanationMode !== 'fallback') || requestedExplanationIds.current.has(activeRecommendation.id)) return
    const campaign = campaigns.find((item) => item.id === activeRecommendation.campaignId)
    if (!campaign?.sentAt) return
    const sentAt = Date.parse(campaign.sentAt)
    if (!Number.isFinite(sentAt)) return
    const sevenDaysLater = sentAt + 7 * 24 * 60 * 60 * 1000
    const reportViewTimestamps = events.filter((event) => {
      if (event.campaignId !== campaign.id || event.eventName !== 'campaign.performance_report_viewed') return false
      const viewedAt = Date.parse(event.timestamp)
      return Number.isFinite(viewedAt) && viewedAt >= sentAt && viewedAt <= sevenDaysLater
    }).map((event) => event.timestamp)
    const reportViews = reportViewTimestamps.length
    if (reportViews < 3 || !shouldRecommendAnalytics([campaign], events)) return
    requestedExplanationIds.current.add(activeRecommendation.id)
    const recommendationId = activeRecommendation.id
    const pendingDiagnostics = createPendingAnalyticsDiagnostics()
    setRecommendations(saveAnalyticsRecommendationDiagnostics(window.localStorage, recommendationId, pendingDiagnostics))
    void requestAnalyticsExplanation({ campaignName: campaign.name, sentAt: campaign.sentAt, reportViewTimestamps }).then((result) => {
      setRecommendations(saveAnalyticsRecommendationExplanation(window.localStorage, recommendationId, result.description, result.explanationMode, result.aiDiagnostics))
    })
  }, [activeRecommendation, campaigns, events])

  function trackAction(eventName: CampaignEventName, campaign: Campaign, actionToken?: string) {
    const updatedEvents = trackCampaignAction(window.localStorage, eventName, campaign, actionToken).events
    setEvents(updatedEvents)
    setRecommendations(evaluateAnalyticsRecommendations(window.localStorage, readCampaigns(window.localStorage), updatedEvents))
  }

  function createCampaign(values: CampaignFormValues, sendNow: boolean) {
    const createdAt = new Date().toISOString()
    const draft: Campaign = { ...values, id: createId('cmp'), status: 'draft', createdAt, channel: values.channels[0] }
    const drafts = [draft, ...campaigns]
    saveCampaigns(window.localStorage, drafts)
    setCampaigns(drafts)
    trackAction('campaign.created', draft)
    if (sendNow) {
      const campaign = { ...draft, status: 'sent' as const, sentAt: new Date().toISOString() }
      sentCampaignIds.current.add(campaign.id)
      const updated = drafts.map((item) => item.id === campaign.id ? campaign : item)
      saveCampaigns(window.localStorage, updated)
      setCampaigns(updated)
      trackAction('campaign.sent', campaign)
    }
  }

  function updateCampaign(campaignId: string, values: CampaignFormValues) {
    const currentCampaigns = readCampaigns(window.localStorage)
    const updated = currentCampaigns.map((campaign) => campaign.id === campaignId && campaign.status === 'draft'
      ? { ...campaign, ...values, channel: values.channels[0] }
      : campaign)
    saveCampaigns(window.localStorage, updated)
    setCampaigns(updated)
  }

  function sendCampaign(campaignId: string) {
    if (sentCampaignIds.current.has(campaignId)) return
    const campaign = readCampaigns(window.localStorage).find((item) => item.id === campaignId)
    if (!campaign || campaign.status === 'sent') return
    sentCampaignIds.current.add(campaignId)
    const sentCampaign = { ...campaign, status: 'sent' as const, sentAt: new Date().toISOString() }
    const updated = readCampaigns(window.localStorage).map((item) => item.id === campaignId ? sentCampaign : item)
    saveCampaigns(window.localStorage, updated)
    setCampaigns(updated)
    trackAction('campaign.sent', sentCampaign)
  }

  function viewReport(campaign: Campaign) {
    trackAction('campaign.performance_report_viewed', campaign, createId('view'))
  }

  function dismissRecommendation(recommendationId: string) {
    setRecommendations(dismissAnalyticsRecommendation(window.localStorage, recommendationId))
  }

  function exploreRecommendation(recommendationId: string) {
    dismissRecommendation(recommendationId)
    const setup = startAnalyticsSetup(window.localStorage)
    setAnalyticsSetup(setup)
    setAnalyticsSetupOpen(setup.status !== 'activated')
    onNavigate('Analytics')
  }

  function beginAnalyticsSetup() {
    const setup = startAnalyticsSetup(window.localStorage)
    setAnalyticsSetup(setup)
    setAnalyticsSetupOpen(setup.status !== 'activated')
  }

  function updateSetup(changes: Partial<Pick<AnalyticsSetup, 'step' | 'metrics' | 'frequency'>>) {
    const setup = analyticsSetup ?? startAnalyticsSetup(window.localStorage)
    const updated = updateAnalyticsSetup(window.localStorage, setup, changes)
    setAnalyticsSetup(updated)
  }

  function finishAnalyticsSetup() {
    const setup = analyticsSetup ?? startAnalyticsSetup(window.localStorage)
    setAnalyticsSetup(activateAnalyticsSetup(window.localStorage, setup))
    setAnalyticsSetupOpen(false)
  }

  return <main className="workspace-shell">
    <aside className="workspace-sidebar">
      <div className="sidebar-brand"><Brand /></div>
      <div className="sidebar-school"><span className="school-avatar">B</span><span><strong>BrightPath Academy</strong><small>School workspace</small></span><span className="school-chevron">⌄</span></div>
      <div className="sidebar-label">WORKSPACE</div>
      <nav className="sidebar-nav" aria-label="Main navigation">{sections.map((item) => <a key={item} href={pathForSection(item)} className={'nav-item ' + (section === item ? 'nav-item-active' : '')} aria-current={section === item ? 'page' : undefined} onClick={(event) => { event.preventDefault(); onNavigate(item) }}><span className="nav-icon"><SidebarIcon section={item} /></span><span>{item}</span>{item === 'Recommendations' && analyticsRecommended && <span className="nav-indicator" aria-label="New recommendation" />}</a>)}</nav>
      <div className="sidebar-profile"><span className="profile-avatar">RS</span><span><strong>Ravi Sharma</strong><small>Administrator</small></span><button aria-label="Log out" onClick={onLogout}>↗</button></div>
    </aside>
    <div className="workspace-main">
      <header className="workspace-topbar"><div><span className="topbar-context">BrightPath Academy</span><span className="topbar-divider">/</span><strong>{section}</strong></div><button className="logout-button" onClick={onLogout}>Log out</button></header>
      <div className="workspace-page">
        {section === 'Dashboard' && <DashboardHome campaigns={campaigns} events={events} recommendation={activeRecommendation} analyticsSetup={analyticsSetup} onNavigate={onNavigate} onResumeAnalyticsSetup={() => { setAnalyticsSetupOpen(true); onNavigate('Analytics') }} onExploreRecommendation={() => activeRecommendation && exploreRecommendation(activeRecommendation.id)} onDismissRecommendation={() => activeRecommendation && dismissRecommendation(activeRecommendation.id)} />}
        {section === 'Campaigns' && <CampaignsPage campaigns={campaigns} events={events} recommendation={activeRecommendation} debugRecommendation={activeRecommendation ?? recommendations[0] ?? null} onCreate={createCampaign} onUpdate={updateCampaign} onSend={sendCampaign} onViewReport={viewReport} onExploreRecommendation={() => activeRecommendation && exploreRecommendation(activeRecommendation.id)} onDismissRecommendation={() => activeRecommendation && dismissRecommendation(activeRecommendation.id)} />}
        {section === 'Student Leads' && <StudentLeadsPage />}
        {section === 'Conversations' && <ConversationsPage />}
        {section === 'Analytics' && <AnalyticsSetupPage setup={analyticsSetup} isOpen={analyticsSetupOpen} onStart={beginAnalyticsSetup} onResume={() => setAnalyticsSetupOpen(true)} onUpdate={updateSetup} onActivate={finishAnalyticsSetup} />}
        {section === 'Recommendations' && <RecommendationsPage recommendation={recommendations[0] ?? null} onExplore={() => { const recommendation = recommendations[0]; if (recommendation) exploreRecommendation(recommendation.id) }} />}
        {section === 'Activated Features' && <ActivatedFeaturesPage analyticsSetup={analyticsSetup} />}
      </div>
      <footer className="workspace-footer"><span>© 2026 Cheerio</span><span>Made for your next good day <span className="heart">♥</span></span></footer>
    </div>
  </main>
}

function DashboardHome({ campaigns, events, recommendation, analyticsSetup, onNavigate, onResumeAnalyticsSetup, onExploreRecommendation, onDismissRecommendation }: { campaigns: Campaign[]; events: ReturnType<typeof readEvents>; recommendation: AnalyticsRecommendation | null; analyticsSetup: AnalyticsSetup | null; onNavigate: (section: Section) => void; onResumeAnalyticsSetup: () => void; onExploreRecommendation: () => void; onDismissRecommendation: () => void }) {
  const sent = campaigns.filter((campaign) => campaign.status === 'sent')
  const familiesReached = sent.reduce((sum, campaign) => sum + campaign.audienceSize, 0)
  return <>
    <div className="page-heading"><div><div className="eyebrow">{formatToday()}</div><h1>Welcome back, Ravi</h1><p>Here’s what’s happening at BrightPath Academy.</p></div><button className="primary-action" onClick={() => onNavigate('Campaigns')}>Go to campaigns <span>→</span></button></div>
    <div className="summary-grid"><SummaryCard label="Campaigns created" value={String(campaigns.length)} detail={sent.length + ' sent'} icon="◫" /><SummaryCard label="Families reached" value={familiesReached.toLocaleString()} detail="Across sent campaigns" icon="♙" /><SummaryCard label="Recent activity" value={String(events.length)} detail="Campaign actions tracked" icon="◷" /></div>
    <div className="home-columns">
      <section className="home-panel recent-activity-home"><div className="section-heading"><div><h2>Recent activity</h2><p>Your latest campaign actions</p></div><button className="text-action" onClick={() => onNavigate('Campaigns')}>View campaigns →</button></div>{events.length ? <ol className="activity-list">{events.slice(0, 5).map((item) => <li key={item.id}><span className="activity-dot" /><div><p>{item.description}</p><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></div></li>)}</ol> : <div className="home-empty"><span>◷</span><p>Your campaign activity will appear here as you get started.</p></div>}</section>
      <section className="home-panel recommendation-home"><div className="section-heading"><div><h2>Recommendations</h2><p>{analyticsSetup?.status === 'in-progress' ? 'Analytics setup in progress' : 'Practical next steps for your workspace'}</p></div><span className="recommendation-sparkle">✧</span></div>{recommendation ? <div className="recommendation-card analytics-highlight-card"><span className="recommendation-icon analytics-recommendation-icon" aria-label="Analytics">▥</span><div><span className="recommendation-tag">READY TO EXPLORE</span><h3>Set up Analytics</h3><ExplanationModeLabel recommendation={recommendation} /><p>{recommendation.description}</p><div className="recommendation-banner-actions"><button className="secondary-action" onClick={onExploreRecommendation}>Explore</button><button className="text-action" onClick={onDismissRecommendation}>Not now</button></div></div></div> : analyticsSetup?.status === 'in-progress' ? <div className="recommendation-card analytics-highlight-card"><span className="recommendation-icon analytics-recommendation-icon" aria-label="Analytics">▥</span><div><h3>Resume Analytics Setup</h3><span className="feature-status feature-in-progress">Setup in progress · Step {analyticsSetup.step} of 2</span><p>Your saved metrics and report frequency are ready to continue.</p><button className="primary-action" onClick={onResumeAnalyticsSetup}>Resume Setup</button></div></div> : analyticsSetup?.status === 'activated' ? <div className="recommendation-card"><span className="recommendation-icon">✓</span><div><span className="feature-status feature-active">Activated</span><h3>Analytics is active</h3><p>Your campaign reports are set up to track the metrics you selected.</p><button className="text-action" onClick={() => onNavigate('Analytics')}>View Analytics →</button></div></div> : <div className="recommendation-empty"><span className="recommendation-icon">✧</span><div><strong>Recommendations will appear as you work</strong><p>Send a campaign and review its report to discover helpful next steps.</p></div></div>}</section>
    </div>
  </>
}

function SummaryCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return <article className="summary-card"><span className="summary-icon">{icon}</span><div><span className="summary-label">{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}

function CampaignTypeIcon({ type }: { type: string }) {
  const icon = type === 'Email' ? <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>
    : type === 'SMS' ? <><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M12 18h.01" /></>
      : <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" /></>
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
}

function CampaignForm({ initial, onSave, onCancel }: { initial?: Campaign; onSave: (values: CampaignFormValues, sendNow: boolean) => void; onCancel: () => void }) {
  const [type, setType] = useState(['WhatsApp', 'Email', 'SMS'].includes(initial?.type ?? '') ? initial!.type! : 'Email')
  const [name, setName] = useState(initial?.name ?? '')
  const [label, setLabel] = useState(initial?.label ?? '')
  const [audience, setAudience] = useState(initial?.audience ?? 'All BrightPath families')
  const [contacts, setContacts] = useState(String(initial?.audienceSize ?? 128))
  const [message, setMessage] = useState(initial?.message ?? '')
  const [schedule, setSchedule] = useState(() => {
    if (!initial?.scheduledAt) return ''
    const date = new Date(initial.scheduledAt)
    return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  })
  const [error, setError] = useState('')
  const maxMessageLength = type === 'SMS' ? 320 : type === 'WhatsApp' ? 4096 : 10000

  function save(sendNow: boolean) {
    if (!name.trim() || !label.trim() || !message.trim()) { setError('Complete the campaign name, label, and message.'); return }
    if (!Number.isFinite(Number(contacts)) || Number(contacts) < 1) { setError('Enter at least one contact.'); return }
    setError('')
    onSave({ name: name.trim(), label: label.trim(), type, channels: [type], audience, audienceSize: Number(contacts), message: message.trim(), scheduledAt: schedule ? new Date(schedule).toISOString() : undefined }, sendNow)
  }

  return <form className="create-campaign-form campaign-composer" onSubmit={(event) => { event.preventDefault(); save(false) }}>
    <div className="campaign-form-heading"><div><span className="eyebrow">CAMPAIGN DETAILS</span><h2>{initial ? 'Edit draft campaign' : 'Create a campaign'}</h2><p>Prepare a message for your BrightPath audience.</p></div><button className="icon-button" type="button" aria-label="Close campaign form" onClick={onCancel}>×</button></div>
    <fieldset className="campaign-type-picker"><legend>Campaign Type</legend>{['WhatsApp', 'Email', 'SMS'].map((item) => <button type="button" key={item} aria-pressed={type === item} className={'campaign-type-option ' + (type === item ? 'campaign-type-selected' : '')} onClick={() => setType(item)}><CampaignTypeIcon type={item} /><span>{item}</span></button>)}</fieldset>
    <div className="campaign-form-grid">
      <label>Campaign Name<input autoFocus maxLength={80} placeholder="e.g. Spring study tips" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Label<input maxLength={40} placeholder="e.g. Academic updates" value={label} onChange={(event) => setLabel(event.target.value)} /></label>
      <label>Audience<select value={audience} onChange={(event) => { const value = event.target.value; setAudience(value); setContacts(value === 'All BrightPath families' ? '128' : value === 'Grade 8 families' ? '36' : '') }}><option>All BrightPath families</option><option>Grade 8 families</option><option>Custom contacts</option></select></label>
      <label>Contacts<input type="number" min="1" max="10000" value={contacts} onChange={(event) => setContacts(event.target.value)} placeholder="Number of contacts" /></label>
      <label className="campaign-schedule">Schedule Date &amp; Time <span className="field-optional">Optional</span><input type="datetime-local" value={schedule} onChange={(event) => setSchedule(event.target.value)} /></label>
      <label className="campaign-message">Message<textarea rows={5} maxLength={maxMessageLength} placeholder={type === 'SMS' ? 'Write a concise text message…' : type === 'WhatsApp' ? 'Write your WhatsApp message…' : 'Write the email message for your audience…'} value={message} onChange={(event) => setMessage(event.target.value)} /><small>{message.length}/{maxMessageLength} characters</small></label>
    </div>
    <p className="form-help">Demo audience · {contacts || '0'} contacts. Message and schedule are saved with this campaign.</p>
    {error && <p className="campaign-error" role="alert">{error}</p>}
    <div className="campaign-form-actions"><button className="secondary-action" type="button" onClick={() => save(false)}>Save as Draft</button><button className="primary-action" type="button" onClick={() => save(true)}>Send Campaign</button></div>
  </form>
}

function CampaignsPage({ campaigns, events, recommendation, debugRecommendation, onCreate, onUpdate, onSend, onViewReport, onExploreRecommendation, onDismissRecommendation }: { campaigns: Campaign[]; events: ReturnType<typeof readEvents>; recommendation: AnalyticsRecommendation | null; debugRecommendation: AnalyticsRecommendation | null; onCreate: (values: CampaignFormValues, sendNow: boolean) => void; onUpdate: (id: string, values: CampaignFormValues) => void; onSend: (id: string) => void; onViewReport: (campaign: Campaign) => void; onExploreRecommendation: () => void; onDismissRecommendation: () => void }) {
  const [isCreating, setIsCreating] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [reportId, setReportId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [channel, setChannel] = useState('All channels')
  const [status, setStatus] = useState('All statuses')
  const [typeFilter, setTypeFilter] = useState('All types')
  const [sort, setSort] = useState('newest')
  const report = campaigns.find((item) => item.id === reportId) ?? null

  function closeForm() { setIsCreating(false); setEditing(null) }
  function saveForm(values: CampaignFormValues, sendNow: boolean) {
    if (editing) { onUpdate(editing.id, values); if (sendNow) onSend(editing.id) }
    else onCreate(values, sendNow)
    closeForm()
  }
  function openReport(campaign: Campaign) {
    setReportId(campaign.id)
    onViewReport(campaign)
  }
  const filteredCampaigns = campaigns
    .filter((item) => [item.name, item.label, item.type, item.audience, ...(item.channels ?? [item.channel ?? 'Email'])].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())))
    .filter((item) => channel === 'All channels' || (item.channels ?? [item.channel ?? 'Email']).includes(channel))
    .filter((item) => typeFilter === 'All types' || (item.type ?? 'Community update') === typeFilter)
    .filter((item) => status === 'All statuses' || item.status === status.toLowerCase())
    .sort((a, b) => sort === 'oldest' ? Date.parse(a.createdAt) - Date.parse(b.createdAt) : sort === 'name' ? a.name.localeCompare(b.name) : sort === 'label' ? (a.label ?? '').localeCompare(b.label ?? '') : sort === 'contacts' ? b.audienceSize - a.audienceSize : Date.parse(b.createdAt) - Date.parse(a.createdAt))

  function exportReport() {
    const headings = ['Campaign Name', 'Label', 'Campaign Type', 'Channels', 'Status', 'Contacts', 'Sent', 'Delivered', 'Opened', 'Clicked']
    const rows = filteredCampaigns.map((item) => {
      const metrics = campaignDemoMetrics(item)
      return [item.name, item.label ?? '', item.type ?? 'Community update', (item.channels ?? [item.channel ?? 'Email']).join(' / '), item.status, metrics.contacts, metrics.sent, metrics.delivered, metrics.opened, metrics.clicked]
    })
    const csv = [headings, ...rows].map((row) => row.map((cell) => '"' + String(cell).replaceAll('"', '""') + '"').join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'cheerio-campaign-report.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return <>
    <div className="campaign-heading"><div><div className="eyebrow">BRIGHTPATH ACADEMY · CAMPAIGNS</div><h1>Recent Campaigns</h1><p className="dashboard-school">Demo data for BrightPath Academy campaigns.</p></div><div className="campaign-heading-actions"><button className="secondary-action export-action" onClick={exportReport}>Export Report</button><button className="primary-action" onClick={() => { setEditing(null); setIsCreating((open) => !open) }}>{isCreating ? 'Close form' : 'New Campaign'}</button></div></div>
    {(isCreating || editing) && <CampaignForm key={editing?.id ?? 'new'} initial={editing ?? undefined} onSave={saveForm} onCancel={closeForm} />}
    <div className="campaign-toolbar"><label className="campaign-search"><span className="sr-only">Search campaigns</span><input type="search" placeholder="Search campaigns" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label><span className="sr-only">Filter by channel</span><select value={channel} onChange={(event) => setChannel(event.target.value)}><option>All channels</option><option>Email</option><option>SMS</option><option>WhatsApp</option></select></label><label><span className="sr-only">Filter by campaign type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All types</option><option>Email</option><option>SMS</option><option>WhatsApp</option><option>Community update</option></select></label><label><span className="sr-only">Filter by status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>Draft</option><option>Sent</option></select></label><label><span className="sr-only">Sort campaigns</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Campaign name A to Z</option><option value="label">Label A to Z</option><option value="contacts">Most contacts</option></select></label></div>
    <div className="campaign-columns">
      <section className="campaign-list-section" aria-labelledby="campaigns-heading">
        <div className="section-heading"><div><h2 id="campaigns-heading">Campaigns</h2><p>{filteredCampaigns.length} of {campaigns.length} demo campaigns</p></div><span className="demo-data-tag">DEMO DATA</span></div>
        {campaigns.length === 0 ? <div className="empty-campaigns"><span className="empty-icon">✦</span><h3>No campaigns yet</h3><p>Create a campaign to share an update with the BrightPath community.</p><button className="primary-action" onClick={() => setIsCreating(true)}>New Campaign</button></div>
          : filteredCampaigns.length === 0 ? <div className="empty-campaigns"><h3>No campaigns match these filters</h3><p>Try another search or filter.</p></div>
          : <div className="campaign-table-wrap"><table className="campaign-table"><thead><tr><th>Campaign Name</th><th>Label</th><th>Campaign Type</th><th>Channels</th><th>Status</th><th>Contacts</th><th>Sent</th><th>Delivered</th><th>Opened</th><th>Clicked</th><th>Action</th></tr></thead><tbody>{filteredCampaigns.map((item) => {
            const metrics = campaignDemoMetrics(item)
            return <tr key={item.id}><td><strong>{item.name}</strong><small>Created {formatDate(item.createdAt)}</small></td><td>{item.label ?? '—'}</td><td><span className="campaign-type-cell"><CampaignTypeIcon type={item.type ?? 'Email'} />{item.type ?? 'Community update'}</span></td><td>{(item.channels ?? [item.channel ?? 'Email']).join(', ')}</td><td><span className={'status-pill status-' + item.status}>{item.status === 'sent' ? 'Sent' : 'Draft'}</span></td><td>{metrics.contacts}</td><td>{metrics.sent}</td><td>{metrics.delivered}</td><td>{metrics.opened}</td><td>{metrics.clicked}</td><td><div className="campaign-table-actions"><button className="table-action" onClick={() => openReport(item)}>View report</button>{item.status === 'draft' && <button className="table-action" onClick={() => { setIsCreating(false); setEditing(item) }}>Edit</button>}<button className="table-action" disabled={item.status === 'sent'} onClick={() => onSend(item.id)}>{item.status === 'sent' ? 'Sent' : 'Send'}</button></div></td></tr>
          })}</tbody></table></div>}
        {report && <section className="report-panel" aria-live="polite" aria-labelledby="report-heading"><div className="report-title-row"><div><div className="eyebrow">CAMPAIGN REPORT</div><h2 id="report-heading">{report.name}</h2></div><button className="icon-button" aria-label="Close report" onClick={() => setReportId(null)}>×</button></div>{report.status === 'sent' ? <><p className="report-subtitle">Sent {formatDate(report.sentAt ?? report.createdAt)} · Demo audience results</p><div className="metric-grid"><Metric label="Delivered" value={String(campaignDemoMetrics(report).delivered)} detail={'of ' + report.audienceSize + ' families'} /><Metric label="Opened" value={String(campaignDemoMetrics(report).opened)} detail="68% open rate" /><Metric label="Clicked" value={String(campaignDemoMetrics(report).clicked)} detail="27% of readers" /></div></> : <div className="report-draft-note"><span>✦</span><div><strong>Your report will be ready after sending.</strong><p>Send this campaign to see delivery, opens, and clicks for your demo audience.</p></div></div>}</section>}
      </section>
      <aside className="activity-panel">{recommendation && <section className="campaign-recommendation-card" aria-label="Analytics recommendation"><div className="campaign-recommendation-title"><span className="campaign-recommendation-icon" aria-hidden="true">▥</span><strong>A better way to track your campaigns</strong></div><ExplanationModeLabel recommendation={recommendation} /><p>{recommendation.description}</p><div className="campaign-recommendation-actions"><button className="secondary-action" onClick={onExploreRecommendation}>Explore</button><button className="text-action" onClick={onDismissRecommendation}>Not now</button></div></section>}<div className="section-heading"><div><h2>Recent activity</h2><p>Campaign actions, in order</p></div><span className="activity-count">{events.length}</span></div>{events.length === 0 ? <div className="activity-empty"><span>◷</span><p>Your campaign activity will appear here.</p></div> : <ol className="activity-list">{events.slice(0, 8).map((item) => <li key={item.id}><span className="activity-dot" /><div><p>{item.description}</p><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></div></li>)}</ol>}</aside>
    </div>
    <details className="reviewer-panel"><summary>Reviewer event log <span>Technical event names, IDs, timestamps, and Groq diagnostics</span></summary><ReviewerAiDiagnostics recommendation={debugRecommendation} />{events.length === 0 ? <p className="reviewer-empty">No events have been recorded yet.</p> : <div className="reviewer-table-wrap"><table className="reviewer-table"><thead><tr><th>Event name</th><th>Event ID</th><th>Timestamp</th></tr></thead><tbody>{events.map((item) => <tr key={item.id}><td><code>{item.eventName}</code></td><td><code>{item.id}</code></td><td><time dateTime={item.timestamp}>{formatDateTime(item.timestamp)}</time></td></tr>)}</tbody></table></div>}</details>
  </>
}

function campaignDemoMetrics(campaign: Campaign) {
  const contacts = campaign.audienceSize
  const sent = campaign.status === 'sent' ? contacts : 0
  const delivered = campaign.status === 'sent' ? Math.round(contacts * 0.96) : 0
  const opened = campaign.status === 'sent' ? Math.round(delivered * 0.68) : 0
  const clicked = campaign.status === 'sent' ? Math.round(opened * 0.27) : 0
  return { contacts, sent, delivered, opened, clicked }
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

function AnalyticsSetupPage({ setup, isOpen, onStart, onResume, onUpdate, onActivate }: { setup: AnalyticsSetup | null; isOpen: boolean; onStart: () => void; onResume: () => void; onUpdate: (changes: Partial<Pick<AnalyticsSetup, 'step' | 'metrics' | 'frequency'>>) => void; onActivate: () => void }) {
  const metricOptions: { value: AnalyticsMetric; label: string; description: string }[] = [
    { value: 'delivered', label: 'Delivered', description: 'Messages successfully delivered to families' },
    { value: 'opens', label: 'Opens', description: 'How many families opened a campaign' },
    { value: 'clicks', label: 'Clicks', description: 'Engagement with links in your campaigns' },
    { value: 'engagement', label: 'Engagement', description: 'A combined view of campaign responses' },
  ]
  const frequencies: { value: ReportFrequency; label: string }[] = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
  ]

  if (!setup) return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Analytics" description="Choose the campaign results you want to track and how often to review them." /><section className="analytics-setup-card"><span className="feature-icon">▥</span><div><h2>Set up Analytics</h2><p>Choose a few practical settings to prepare your campaign reports.</p><button className="primary-action" onClick={onStart}>Start setup</button></div></section></>

  if (setup.status === 'activated') return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Analytics" description="Your campaign reporting preferences are ready." /><section className="analytics-setup-card analytics-activated-card"><span className="feature-icon">✓</span><div><span className="feature-status feature-active">Activated</span><h2>Analytics is active</h2><p>Tracking {setup.metrics.map((metric) => metricOptions.find((option) => option.value === metric)?.label ?? metric).join(', ')} with {setup.frequency} reports.</p></div></section></>

  if (!isOpen) return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Analytics" description="Continue setting up your campaign reports." /><section className="analytics-setup-card analytics-resume-card"><span className="feature-icon">▥</span><div><h2>Resume Analytics Setup</h2><span className="feature-status feature-in-progress">Setup in progress · Step {setup.step} of 2</span><p>Your settings are saved. Resume to continue where you left off.</p><button className="primary-action" onClick={onResume}>Resume Setup</button></div></section></>

  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY · ANALYTICS SETUP" title="Set up Analytics" description="A few simple choices will prepare your campaign reports." /><section className="analytics-setup-form"><div className="analytics-setup-progress"><span>Step {setup.step} of 2</span><span className="feature-status feature-in-progress">Setup in progress</span></div>{setup.step === 1 ? <><h2>Which campaign metrics should we track?</h2><p className="analytics-setup-help">Choose one or more metrics for your reports.</p><div className="analytics-option-list">{metricOptions.map((option) => <label className="analytics-option" key={option.value}><input type="checkbox" checked={setup.metrics.includes(option.value)} onChange={(event) => { const metrics = event.target.checked ? [...setup.metrics, option.value] : setup.metrics.filter((metric) => metric !== option.value); onUpdate({ metrics }) }} /><span><strong>{option.label}</strong><small>{option.description}</small></span></label>)}</div><div className="analytics-setup-actions"><span>{setup.metrics.length} selected</span><button className="primary-action" disabled={setup.metrics.length === 0} onClick={() => onUpdate({ step: 2 })}>Continue</button></div></> : <><h2>How often should reports be prepared?</h2><p className="analytics-setup-help">Choose a frequency that works for your team.</p><div className="analytics-frequency-list">{frequencies.map((option) => <label className="analytics-frequency-option" key={option.value}><input type="radio" name="report-frequency" value={option.value} checked={setup.frequency === option.value} onChange={() => onUpdate({ frequency: option.value })} /><span>{option.label}</span></label>)}</div><div className="analytics-setup-actions"><button className="secondary-action" onClick={() => onUpdate({ step: 1 })}>Back</button><button className="primary-action" disabled={!setup.frequency} onClick={onActivate}>Activate Analytics</button></div></>}</section></>
}

function RecommendationsPage({ recommendation, onExplore }: { recommendation: AnalyticsRecommendation | null; onExplore: () => void }) {
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Recommendations" description="Next steps based on how your team is using Cheerio." />{recommendation ? <section className="recommendation-detail"><div className="recommendation-detail-icon">▥</div><div className="recommendation-detail-copy"><span className="recommendation-tag">BASED ON YOUR CAMPAIGN ACTIVITY</span><h2>Set up Analytics</h2><ExplanationModeLabel recommendation={recommendation} /><p>{recommendation.description}</p><button className="primary-action" onClick={onExplore}>Explore <span>→</span></button></div></section> : <section className="placeholder-card recommendation-none"><span className="placeholder-icon">✧</span><h2>No recommendations yet</h2><p>Keep using campaigns and their reports. Helpful next steps will appear here when your activity points to them.</p></section>}</>
}

function ActivatedFeaturesPage({ analyticsSetup }: { analyticsSetup: AnalyticsSetup | null }) {
  const analyticsStatus = analyticsSetup?.status === 'activated' ? 'Activated' : analyticsSetup ? 'Setup in progress' : 'Not set up'
  const features = [{ name: 'Campaigns', status: 'Active', icon: '◫' }, { name: 'Student Leads', status: 'Preview', icon: '♙' }, { name: 'Conversations', status: 'Preview', icon: '◌' }, { name: 'Analytics', status: analyticsStatus, icon: '▥' }]
  return <><PageHeader eyebrow="BRIGHTPATH ACADEMY" title="Activated Features" description="A simple overview of the tools in your workspace." /><div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.name}><span className="feature-icon">{feature.icon}</span><div><h2>{feature.name}</h2><p>{feature.status === 'Active' || feature.status === 'Activated' ? 'Ready to use in your workspace' : feature.status === 'Preview' ? 'Demo preview available' : feature.status === 'Setup in progress' ? 'Your Analytics settings are saved' : 'Setup will be available later'}</p></div><span className={'feature-status ' + (feature.status === 'Active' || feature.status === 'Activated' ? 'feature-active' : feature.status === 'Setup in progress' ? 'feature-in-progress' : '')}>{feature.status}</span></article>)}</div></>
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
  const [isLoggedIn, setIsLoggedIn] = useState(() => readDemoSession(window.localStorage))
  const [section, setSection] = useState<Section>(() => sectionForPath(window.location.pathname) ?? 'Dashboard')

  function handlePopState() {
    const nextSection = sectionForPath(window.location.pathname)
    if (isLoggedIn && !nextSection) {
      window.history.replaceState(null, '', pathForSection('Dashboard'))
      setSection('Dashboard')
      return
    }
    if (nextSection) setSection(nextSection)
  }

  useEffect(() => {
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  })

  useEffect(() => {
    if (!isLoggedIn) return
    const routeSection = sectionForPath(window.location.pathname)
    if (!routeSection) {
      window.history.replaceState(null, '', pathForSection('Dashboard'))
      setSection('Dashboard')
    } else if (routeSection !== section) {
      setSection(routeSection)
    }
  }, [isLoggedIn, section])

  function navigate(nextSection: Section) {
    const nextPath = pathForSection(nextSection)
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath)
    setSection(nextSection)
  }

  function handleLogin() {
    saveDemoSession(window.localStorage, true)
    setIsLoggedIn(true)
    navigate('Dashboard')
  }
  function handleLogout() {
    saveDemoSession(window.localStorage, false)
    setIsLoggedIn(false)
    window.history.replaceState(null, '', '/login')
  }
  return isLoggedIn ? <Dashboard section={section} onNavigate={navigate} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />
}
