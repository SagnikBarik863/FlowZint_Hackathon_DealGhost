// Proposal content shape — mirrors lib/ai/proposal.ts ProposalSchema
// Defined here so client components can import the type without pulling in
// server-only dependencies (groq-sdk, prisma, etc.)

export interface ProposalDeliverable {
  name: string;
  description: string;
  milestone: string;
}

export interface ProposalPhase {
  name: string;
  durationWeeks: number;
  deliverables: string[];
}

export interface ProposalTeamMember {
  role: string;
  count: number;
  allocationPct: number;
}

export interface ProposalPricingItem {
  item: string;
  costUsd: number;
}

export interface ProposalContent {
  executiveSummary: string;
  scope: {
    included: string[];
    excluded: string[];
  };
  deliverables: ProposalDeliverable[];
  timeline: {
    phases: ProposalPhase[];
  };
  pricing: {
    model: 'fixed' | 'time_and_materials' | 'retainer';
    breakdown: ProposalPricingItem[];
    totalUsd: number;
    currency: string;
  };
  techStack: {
    frontend: string;
    backend: string;
    database: string;
    hosting: string;
  };
  team: ProposalTeamMember[];
  assumptions: string[];
  terms: string;
}
