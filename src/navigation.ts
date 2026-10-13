export type Section = 'Dashboard' | 'Campaigns' | 'Student Leads' | 'Conversations' | 'Analytics' | 'Recommendations' | 'Activated Features'

export const sections: Section[] = ['Dashboard', 'Campaigns', 'Student Leads', 'Conversations', 'Analytics', 'Recommendations', 'Activated Features']

const sectionPaths: Record<Section, string> = {
  Dashboard: '/dashboard',
  Campaigns: '/campaigns',
  'Student Leads': '/student-leads',
  Conversations: '/conversations',
  Analytics: '/analytics',
  Recommendations: '/recommendations',
  'Activated Features': '/activated-features',
}

const pathSections = Object.fromEntries(Object.entries(sectionPaths).map(([section, path]) => [path, section])) as Record<string, Section>

export function pathForSection(section: Section): string {
  return sectionPaths[section]
}

export function sectionForPath(pathname: string): Section | null {
  return pathSections[pathname.replace(/\/$/, '') || '/'] ?? null
}
