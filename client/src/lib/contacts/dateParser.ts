const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseNaturalDate(description: string | null | undefined, referenceDate?: Date): Date | null {
  if (!description) return null;

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  ref.setHours(9, 0, 0, 0); // normalize to 9am

  const lower = description.toLowerCase().trim();

  // "tomorrow"
  if (lower === 'tomorrow') {
    const d = new Date(ref);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // "next week" → next Monday
  if (lower === 'next week') {
    const d = new Date(ref);
    const dayOfWeek = d.getDay(); // 0=Sun
    const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    d.setDate(d.getDate() + daysUntilMonday);
    return d;
  }

  // "end of month"
  if (lower === 'end of month' || lower === 'end of the month') {
    const d = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    d.setHours(9, 0, 0, 0);
    return d;
  }

  // "next [weekday]"
  const nextWeekdayMatch = lower.match(/^next\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/);
  if (nextWeekdayMatch) {
    const targetDay = WEEKDAYS.indexOf(nextWeekdayMatch[1]);
    const d = new Date(ref);
    const current = d.getDay();
    let daysUntil = targetDay - current;
    if (daysUntil <= 0) daysUntil += 7;
    d.setDate(d.getDate() + daysUntil);
    return d;
  }

  // "in N days"
  const inDaysMatch = lower.match(/^in\s+(\d+)\s+days?$/);
  if (inDaysMatch) {
    const d = new Date(ref);
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    return d;
  }

  // "in N weeks"
  const inWeeksMatch = lower.match(/^in\s+(\d+)\s+weeks?$/);
  if (inWeeksMatch) {
    const d = new Date(ref);
    d.setDate(d.getDate() + parseInt(inWeeksMatch[1], 10) * 7);
    return d;
  }

  // "in N months"
  const inMonthsMatch = lower.match(/^in\s+(\d+)\s+months?$/);
  if (inMonthsMatch) {
    const d = new Date(ref);
    d.setMonth(d.getMonth() + parseInt(inMonthsMatch[1], 10));
    return d;
  }

  return null;
}
