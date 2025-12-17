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
  
  // Goal
  if (goal) {
    if (mode === 'meeting_intro') {
      body += `\n\nI'd love to ${goal.toLowerCase()}. `;
    } else {
      body += `\n\n${goal} `;
    }
  }
  
  // Company reference
  if (contact.company && mode !== 'linkedin_message') {
    body += `\n\nI think there could be some great synergies between what we're doing and ${contact.company}'s work${contact.title ? `, especially given your role as ${contact.title}` : ''}.`;
  }
  
  // Closer
  body += `\n\n${closers[tone]}`;
  
  // Trim for short messages
  if (length === 'short') {
    body = `${openers[tone]}\n\n${goal || 'Wanted to follow up on our conversation.'}\n\n${closers[tone]}`;
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
