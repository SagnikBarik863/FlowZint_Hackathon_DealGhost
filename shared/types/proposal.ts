export interface ProposalContent {
  executiveSummary: string
  scope: {
    included: string[]
    excluded: string[]
  }
  deliverables: Array<{
    name: string
    description: string
    milestone: string
  }>
  timeline: {
    phases: Array<{
      name: string
      durationWeeks: number
      deliverables: string[]
    }>
  }
  pricing: {
    model: 'fixed' | 'time_and_materials' | 'retainer'
    breakdown: Array<{ item: string; costUsd: number }>
    totalUsd: number
    currency: string
  }
  techStack: {
    frontend: string
    backend: string
    database: string
    hosting: string
    reasoning: string
  }
  team: Array<{
    role: string
    count: number
    allocationPct: number
  }>
  assumptions: string[]
  risks: Array<{
    description: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    mitigation: string
  }>
  terms: string
}
