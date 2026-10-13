import { useState, type FormEvent } from 'react'

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
  return (
    <main className="dashboard-shell">
      <header className="topbar dashboard-topbar"><Brand /><button className="logout-button" onClick={onLogout}>Log out</button></header>
      <section className="dashboard-content">
        <div className="dashboard-icon" aria-hidden="true">✦</div>
        <div className="eyebrow">YOU’RE RIGHT WHERE YOU NEED TO BE</div>
        <h1>Welcome, Ravi Sharma</h1>
        <p className="dashboard-school">BrightPath Academy</p>
        <div className="dashboard-card"><span className="card-sparkle">✦</span><p>Your Cheerio dashboard is ready to grow with you.</p><span className="coming-soon">A GOOD THING IS TAKING SHAPE</span></div>
      </section>
      <footer className="page-footer"><span>© 2026 Cheerio</span><span>Made for your next good day <span className="heart">♥</span></span></footer>
    </main>
  )
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  return isLoggedIn ? <Dashboard onLogout={() => setIsLoggedIn(false)} /> : <Login onLogin={() => setIsLoggedIn(true)} />
}
