import { callGroq } from './groq';
import { FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt } from './prompts/followup';
import { ProjectRequirementState, MissingField } from '@/types/project';
import { classifyIntent } from './intent';

// ── Project Summary Builder ───────────────────────────────────────────────────
// Built entirely from the TypeScript state object — zero LLM hallucination risk.
function buildProjectSummary(state: ProjectRequirementState): string {
  const lines: string[] = [];

  lines.push("Here's a summary of your project as I have it so far:");
  lines.push('');

  // ── Project basics ──────────────────────────────────────────────────────────
  if (state.projectName) lines.push(`**Project Name:** ${state.projectName}`);
  if (state.description)  lines.push(`**Overview:** ${state.description}`);
  if (state.projectType)  lines.push(`**Type:** ${state.projectType.replace(/_/g, ' ')}`);
  if (state.industry)     lines.push(`**Industry:** ${state.industry}`);

  const platforms = state.platforms.length > 0 ? state.platforms.join(', ') : 'Not specified';
  lines.push(`**Platforms:** ${platforms}`);

  if (state.targetUsers) lines.push(`**Target Users:** ${state.targetUsers}`);
  if (state.userScale)   lines.push(`**Expected Scale:** ${state.userScale}`);

  lines.push('');

  // ── Features ───────────────────────────────────────────────────────────────
  if (state.features.length > 0) {
    lines.push('**Features:**');
    for (const f of state.features) {
      const tag =
        f.priority === 'MUST'   ? '✅' :
        f.priority === 'SHOULD' ? '🔶' : '💡';
      lines.push(`${tag} **${f.name}** — ${f.description}`);
    }
  } else {
    lines.push('**Features:** None specified yet');
  }

  lines.push('');

  // ── Integrations & technical details ───────────────────────────────────────
  if (state.integrations.length > 0) {
    lines.push(`**Integrations:** ${state.integrations.join(', ')}`);
  }
  if (state.authRequirements) {
    lines.push(`**Authentication:** ${state.authRequirements}`);
  }
  if (state.realtimeRequirements) {
    lines.push(`**Real-time Features:** ${state.realtimeRequirements}`);
  }
  if (state.adminPanelRequirements) {
    lines.push(`**Admin Panel:** ${state.adminPanelRequirements}`);
  }
  if (state.technicalConstraints) {
    lines.push(`**Technical Constraints:** ${state.technicalConstraints}`);
  }

  lines.push('');

  // ── Budget & timeline ──────────────────────────────────────────────────────
  const hasBudget = state.budgetRange.raw || state.budgetRange.min !== null;
  const budgetStr = hasBudget
    ? (state.budgetRange.raw ?? `$${state.budgetRange.min}–$${state.budgetRange.max}`)
    : 'Not discussed';
  lines.push(`**Budget:** ${budgetStr}`);
  lines.push(`**Timeline:** ${state.timelineExpectation ?? 'Not discussed'}`);

  lines.push('');
  lines.push('Does this look right? You can:');
  lines.push('• **Confirm** — I\'ll generate your technical proposal');
  lines.push('• **Add** anything that\'s missing (e.g. "add a loyalty feature")');
  lines.push('• **Remove** something that doesn\'t belong (e.g. "remove the X feature")');
  lines.push('• **Edit** anything that\'s incorrect');

  return lines.join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateFollowupQuestion(
  state: ProjectRequirementState,
  missingFields: MissingField[],
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<string> {
  const lastUserMessage = conversationHistory.filter((m) => m.role === 'user').slice(-1)[0]?.content ?? '';
  const lastAssistMsg   = conversationHistory.filter((m) => m.role === 'assistant').slice(-1)[0]?.content ?? '';
  const summaryWasShown = lastAssistMsg.includes('Does this look right?');

  // ── LLM Intent Classification ───────────────────────────────────────────────
  // Replaces all keyword arrays. The classifier understands natural language
  // variations ("wrap it up", "I think we're good", "yeah that's right", etc.)
  // and routes to the correct handler — no string matching required.
  const intent = await classifyIntent(lastUserMessage, summaryWasShown, conversationHistory);

  switch (intent) {

    // User confirmed the summary → direct them to the Generate Proposal button
    case 'CONFIRMING_SUMMARY':
    case 'READY_FOR_PROPOSAL':
      return "Perfect! Everything looks good. Go ahead and click the **Generate Proposal** button at the top to create your technical proposal.";

    // User is done sharing — show the full TypeScript-built project summary
    case 'REQUESTING_DONE':
      return buildProjectSummary(state);

    // User is editing the summary (add/remove/change) — extraction already ran
    // and updated the state. Let the LLM acknowledge the change and offer next steps.
    case 'EDITING_SUMMARY': {
      const userPrompt = buildFollowupUserPrompt(state, missingFields, conversationHistory);
      const response   = await callGroq(FOLLOWUP_SYSTEM_PROMPT, userPrompt);
      return response.trim();
    }

    // Normal discovery — LLM asks the next most important question
    case 'COLLECTING_INFO':
    default: {
      const userPrompt = buildFollowupUserPrompt(state, missingFields, conversationHistory);
      const response   = await callGroq(FOLLOWUP_SYSTEM_PROMPT, userPrompt);
      return response.trim();
    }
  }
}
