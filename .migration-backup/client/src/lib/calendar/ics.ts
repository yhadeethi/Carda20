/**
 * ICS Event Generator
 * RFC5545 compliant calendar event generation
 */

import { generateId } from '../contacts/ids';

export interface IcsEventOptions {
  title: string;
  description?: string;
  location?: string;
  startIso: string; // ISO date string
  endIso: string;   // ISO date string
  attendeesEmails?: string[];
  organizerEmail?: string;
  organizerName?: string;
}

// Format date to ICS format (UTC)
function formatIcsDate(isoDate: string): string {
  const date = new Date(isoDate);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

// Escape special characters for ICS
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Fold long lines (max 75 chars per line)
function foldLine(line: string): string {
  const MAX_LENGTH = 75;
  if (line.length <= MAX_LENGTH) return line;
  
  const result: string[] = [];
  let remaining = line;
  
  while (remaining.length > MAX_LENGTH) {
    result.push(remaining.slice(0, MAX_LENGTH));
    remaining = ' ' + remaining.slice(MAX_LENGTH); // Continuation lines start with space
  }
  result.push(remaining);
  
  return result.join('\r\n');
}

// Build ICS event content
export function buildIcsEvent(options: IcsEventOptions): string {
  const {
    title,
    description,
    location,
    startIso,
    endIso,
    attendeesEmails,
    organizerEmail,
    organizerName,
  } = options;

  const uid = `${generateId()}@carda.app`;
  const dtstamp = formatIcsDate(new Date().toISOString());
  const dtstart = formatIcsDate(startIso);
  const dtend = formatIcsDate(endIso);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carda//Meeting Generator//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeIcsText(title)}`,
  ];

  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }

  if (location) {
    lines.push(`LOCATION:${escapeIcsText(location)}`);
  }

  if (organizerEmail) {
    const cn = organizerName ? `CN=${escapeIcsText(organizerName)}:` : '';
    lines.push(`ORGANIZER;${cn}mailto:${organizerEmail}`);
  }

  if (attendeesEmails && attendeesEmails.length > 0) {
    attendeesEmails.forEach(email => {
      lines.push(`ATTENDEE;RSVP=TRUE:mailto:${email}`);
    });
  }

  // Add alarm 15 minutes before
  lines.push(
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Meeting reminder',
    'END:VALARM'
  );

  lines.push('END:VEVENT', 'END:VCALENDAR');

  // Fold long lines and join with CRLF
  return lines.map(foldLine).join('\r\n');
}

// Download ICS file
export function downloadIcsFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

// Create meeting with contact
export function createMeetingWithContact(
  contactName: string,
  contactCompany: string | undefined,
  contactEmail: string | undefined,
  startTime: Date,
  durationMinutes: number = 30
): string {
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);
  
  const title = contactCompany 
    ? `Catch up — ${contactName} (${contactCompany})`
    : `Catch up — ${contactName}`;
  
  const descriptionLines = [
    `Meeting with ${contactName}`,
  ];
  
  if (contactCompany) {
    descriptionLines.push(`Company: ${contactCompany}`);
  }
  
  if (contactEmail) {
    descriptionLines.push(`Email: ${contactEmail}`);
  }
  
  descriptionLines.push(
    '',
    'Suggested agenda:',
    '• Quick introductions / catch up',
    '• Discuss current priorities',
    '• Explore potential collaboration',
    '• Agree on next steps',
    '',
    'Created with Carda'
  );
  
  return buildIcsEvent({
    title,
    description: descriptionLines.join('\n'),
    startIso: startTime.toISOString(),
    endIso: endTime.toISOString(),
    attendeesEmails: contactEmail ? [contactEmail] : undefined,
  });
}

// Quick time slot helpers
export function getQuickTimeSlots(): Array<{ label: string; getTime: () => Date }> {
  return [
    {
      label: 'Today 4pm',
      getTime: () => {
        const d = new Date();
        d.setHours(16, 0, 0, 0);
        if (d < new Date()) {
          d.setDate(d.getDate() + 1);
        }
        return d;
      },
    },
    {
      label: 'Tomorrow 10am',
      getTime: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(10, 0, 0, 0);
        return d;
      },
    },
    {
      label: 'Next Monday 10am',
      getTime: () => {
        const d = new Date();
        const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
        d.setDate(d.getDate() + daysUntilMonday);
        d.setHours(10, 0, 0, 0);
        return d;
      },
    },
  ];
}
