import type { StorageLike } from './campaignStore'

export const AUTOMATIONS_SETUP_STORAGE_KEY = 'cheerio:automations-setup'
export type AutomationTrigger = 'campaign-sent' | 'report-viewed'
export type AutomationAction = 'prepare-follow-up' | 'notify-team'

export type AutomationsSetup = {
  status: 'in-progress' | 'activated'
  step: 1 | 2
  trigger: AutomationTrigger
  action: AutomationAction
  updatedAt: string
}

export function readAutomationsSetup(storage: StorageLike): AutomationsSetup | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(AUTOMATIONS_SETUP_STORAGE_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return null
    const setup = value as Partial<AutomationsSetup>
    if ((setup.status !== 'in-progress' && setup.status !== 'activated') || (setup.step !== 1 && setup.step !== 2) || typeof setup.updatedAt !== 'string') return null
    if (setup.trigger !== 'campaign-sent' && setup.trigger !== 'report-viewed') return null
    if (setup.action !== 'prepare-follow-up' && setup.action !== 'notify-team') return null
    return setup as AutomationsSetup
  } catch {
    return null
  }
}

export function startAutomationsSetup(storage: StorageLike): AutomationsSetup {
  const existing = readAutomationsSetup(storage)
  if (existing) return existing
  const setup: AutomationsSetup = { status: 'in-progress', step: 1, trigger: 'campaign-sent', action: 'notify-team', updatedAt: new Date().toISOString() }
  saveAutomationsSetup(storage, setup)
  return setup
}

export function updateAutomationsSetup(storage: StorageLike, setup: AutomationsSetup, changes: Partial<Pick<AutomationsSetup, 'step' | 'trigger' | 'action'>>): AutomationsSetup {
  const updated: AutomationsSetup = { ...setup, ...changes, updatedAt: new Date().toISOString() }
  saveAutomationsSetup(storage, updated)
  return updated
}

export function activateAutomations(storage: StorageLike, setup: AutomationsSetup): AutomationsSetup {
  const activated: AutomationsSetup = { ...setup, status: 'activated', step: 2, updatedAt: new Date().toISOString() }
  saveAutomationsSetup(storage, activated)
  return activated
}

function saveAutomationsSetup(storage: StorageLike, setup: AutomationsSetup): void {
  storage.setItem(AUTOMATIONS_SETUP_STORAGE_KEY, JSON.stringify(setup))
}
