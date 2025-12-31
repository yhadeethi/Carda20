/**
 * Follow-Up Generator
 * Generates follow-up messages with AI or template fallback
 */

import { 
  FollowUpMode, 
  FollowUpTone, 
  FollowUpLength, 
  FollowUpRequest, 
  FollowUpResponse 
} from '../contacts/types';

interface ContactInfo {
  name: string;
  company?: string;
  title?: string;
  email?: string;
}

// Helper to form a proper sentence around a goal phrase
function formatGoalAsSentence(goal: string, mode: FollowUpMode): string {
  const g = goal.trim();
  if (!g) return '';
  
  // Check if goal is already a complete sentence (starts with capital, ends with punctuation)
  const looksLikeSentence = /^[A-Z].*[.!?]$/.test(g) && g.split(' ').length > 4;
  if (looksLikeSentence) return g;
  
  // Check for action verb patterns (case-insensitive matching, preserve original casing)
  const actionPrefixes = ['discuss', 'explore', 'schedule', 'book', 'set up', 'arrange', 'plan', 'talk about', 'learn more', 'understand', 'share', 'present', 'demo', 'show'];
  const lowerG = g.toLowerCase();
  const startsWithAction = actionPrefixes.some(prefix => lowerG.startsWith(prefix));
  
  // Helper to lowercase first letter only if appropriate
  const asClause = () => {
    // If starts with capital and looks like a proper noun/title, keep it
    if (/^[A-Z][a-z]/.test(g) && !startsWithAction) return g;
    // Otherwise lowercase first letter for natural flow
    return g.charAt(0).toLowerCase() + g.slice(1);
  };
  
  if (mode === 'meeting_intro') {
    if (startsWithAction) {
      // "book a meeting" -> "I'd love to book a meeting."
      return `I'd love to ${asClause()}.`;
    }
    // Noun phrase: "Series B Partnership" -> "I'd love to discuss Series B Partnership."
    return `I'd love to discuss ${g}.`;
  } else if (mode === 'linkedin_message') {
    if (startsWithAction) {
      return `I wanted to reach out and ${asClause()}.`;
    }
    return `I wanted to connect regarding ${g}.`;
  } else {
    // email_followup
    if (startsWithAction) {
      return `I wanted to follow up and ${asClause()}.`;
    }
    return `I wanted to follow up regarding ${g}.`;
  }
}

// Template-based follow-up generation (always available)
function generateTemplate(
  contact: ContactInfo,
  request: FollowUpRequest
): FollowUpResponse {
  const { mode, tone, goal, context, length } = request;
  const firstName = contact.name.split(' ')[0] || 'there';
  
  // Tone openers
  const openers: Record<FollowUpTone, string> = {
    friendly: `Hi ${firstName}!`,
    direct: `Hi ${firstName},`,
    warm: `Hello ${firstName},`,
    formal: `Dear ${contact.name},`,
  };
  
  // Tone closers
  const closers: Record<FollowUpTone, string> = {
    friendly: "Looking forward to hearing from you!",
    direct: "Let me know your thoughts.",
    warm: "Would love to continue our conversation.",
    formal: "I look forward to your response.",
  };
  
  // Build subject based on mode
  const subjects: Record<FollowUpMode, string> = {
    email_followup: `Following up${contact.company ? ` - ${contact.company}` : ''}`,
    linkedin_message: `Great connecting with you`,
    meeting_intro: `Meeting request${contact.company ? ` with ${contact.company}` : ''}`,
  };
  
  // Build body
  let body = openers[tone] + '\n\n';
  
  // Context reference
  if (context) {
    body += `It was great ${context.toLowerCase().includes('meeting') ? context : `meeting you at ${context}`}. `;
  } else {
    body += mode === 'linkedin_message' 
      ? "Great connecting with you here on LinkedIn. "
      : "Hope you're doing well. ";
  }
  
  // Goal - now properly formatted as a sentence
  if (goal) {
    const formattedGoal = formatGoalAsSentence(goal, mode);
    body += `\n\n${formattedGoal}`;
  }
  
  // Company reference
  if (contact.company && mode !== 'linkedin_message') {
    body += `\n\nI think there could be some great synergies between what we're doing and ${contact.company}'s work${contact.title ? `, especially given your role as ${contact.title}` : ''}.`;
  }
  
  // Closer
  body += `\n\n${closers[tone]}`;
  
  // Trim for short messages
  if (length === 'short') {
    const shortGoal = goal ? formatGoalAsSentence(goal, mode) : 'Wanted to follow up on our conversation.';
    body = `${openers[tone]}\n\n${shortGoal}\n\n${closers[tone]}`;
  }
  
  // Key bullets
  const bullets: string[] = [];
  if (context) bullets.push(`Referenced: ${context}`);
  if (goal) bullets.push(`Goal: ${goal}`);
  if (contact.company) bullets.push(`Company: ${contact.company}`);
  
  return {
    subject: subjects[mode],
    body,
    bullets,
  };
}

// AI-powered follow-up (if backend available)
async function generateWithAI(
  contact: ContactInfo,
  request: FollowUpRequest
): Promise<FollowUpResponse | null> {
  try {
    const response = await fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact, request }),
    });
    
    if (!response.ok) {
      console.warn('[FollowUp] AI generation failed, falling back to template');
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.warn('[FollowUp] AI generation error:', error);
    return null;
  }
}

// Main generation function
export async function generateFollowUp(
  contact: ContactInfo,
  request: FollowUpRequest
): Promise<FollowUpResponse> {
  // Try AI first
  const aiResult = await generateWithAI(contact, request);
  if (aiResult) return aiResult;
  
  // Fallback to template
  return generateTemplate(contact, request);
}

// Synchronous template-only version
export function generateFollowUpTemplate(
  contact: ContactInfo,
  request: FollowUpRequest
): FollowUpResponse {
  return generateTemplate(contact, request);
}

// Mode labels for UI
export const FOLLOWUP_MODE_LABELS: Record<FollowUpMode, string> = {
  email_followup: 'Email Follow-Up',
  linkedin_message: 'LinkedIn Message',
  meeting_intro: 'Meeting Request',
};

// Tone labels for UI
export const FOLLOWUP_TONE_LABELS: Record<FollowUpTone, string> = {
  friendly: 'Friendly',
  direct: 'Direct',
  warm: 'Warm',
  formal: 'Formal',
};

// Length labels for UI
export const FOLLOWUP_LENGTH_LABELS: Record<FollowUpLength, string> = {
  short: 'Short',
  medium: 'Medium',
};
