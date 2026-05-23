import { callGroq } from './groq';
import { FOLLOWUP_SYSTEM_PROMPT, buildFollowupUserPrompt } from './prompts/followup';
import { ProjectRequirementState, MissingField } from '@/types/project';

export async function generateFollowupQuestion(
  state: ProjectRequirementState,
  missingFields: MissingField[],
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<string> {
  // If nothing is missing, ask for confirmation before generating proposal
  if (missingFields.length === 0) {
    return "I think I have a solid picture of your project. Shall I go ahead and generate a detailed technical proposal for you?";
  }

  const userPrompt = buildFollowupUserPrompt(state, missingFields, conversationHistory);
  const question = await callGroq(FOLLOWUP_SYSTEM_PROMPT, userPrompt);

  return question.trim();
}
