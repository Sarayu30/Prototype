export const ANALYTICS_SETUP_STORAGE_KEY = 'cheerio:analytics-setup'

export type AnalyticsMetric = 'delivered' | 'opens' | 'clicks' | 'engagement'
export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly'
export type AnalyticsSetupStatus = 'in-progress' | 'activated'

export type AnalyticsSetup = {
  status: AnalyticsSetupStatus
  step: 1 | 2
  metrics: AnalyticsMetric[]
  frequency: ReportFrequency | ''
  updatedAt: string
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

const validMetrics: AnalyticsMetric[] = ['delivered', 'opens', 'clicks', 'engagement']
const validFrequencies: ReportFrequency[] = ['weekly', 'monthly', 'quarterly']

export function readAnalyticsSetup(storage: StorageLike): AnalyticsSetup | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(ANALYTICS_SETUP_STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const setup = value as Partial<AnalyticsSetup>
    if ((setup.status !== 'in-progress' && setup.status !== 'activated') || (setup.step !== 1 && setup.step !== 2)) return null
    if (!Array.isArray(setup.metrics) || !setup.metrics.every((metric) => validMetrics.includes(metric))) return null
    if (setup.frequency !== '' && !validFrequencies.includes(setup.frequency as ReportFrequency)) return null
    if (typeof setup.updatedAt !== 'string') return null
    return setup as AnalyticsSetup
  } catch {
    return null
  }
}

export function startAnalyticsSetup(storage: StorageLike): AnalyticsSetup {
  const existing = readAnalyticsSetup(storage)
  if (existing) return existing
  const setup: AnalyticsSetup = { status: 'in-progress', step: 1, metrics: [], frequency: '', updatedAt: new Date().toISOString() }
  saveAnalyticsSetup(storage, setup)
  return setup
}

export function updateAnalyticsSetup(storage: StorageLike, setup: AnalyticsSetup, changes: Partial<Pick<AnalyticsSetup, 'step' | 'metrics' | 'frequency'>>): AnalyticsSetup {
  if (setup.status === 'activated') return setup
  const updated: AnalyticsSetup = { ...setup, ...changes, updatedAt: new Date().toISOString() }
  saveAnalyticsSetup(storage, updated)
  return updated
}

export function activateAnalyticsSetup(storage: StorageLike, setup: AnalyticsSetup): AnalyticsSetup {
  const activated: AnalyticsSetup = { ...setup, status: 'activated', step: 2, updatedAt: new Date().toISOString() }
  saveAnalyticsSetup(storage, activated)
  return activated
}

export function saveAnalyticsSetup(storage: StorageLike, setup: AnalyticsSetup): void {
  storage.setItem(ANALYTICS_SETUP_STORAGE_KEY, JSON.stringify(setup))
}
