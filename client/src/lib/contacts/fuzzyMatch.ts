type Contact = { id: string; fullName: string; companyName: string };

function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function fuzzyMatchContact(
  query: string,
  contacts: Contact[]
): Array<{ contact: Contact; score: number }> {
  if (!query || !contacts.length) return [];

  const normalizedQuery = normalize(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  const results = contacts.map((contact) => {
    const normalizedFull = normalize(contact.fullName);
    const normalizedCompany = normalize(contact.companyName || '');
    const fullTokens = normalizedFull.split(/\s+/).filter(Boolean);
    const lastName = fullTokens[fullTokens.length - 1] ?? '';
    const firstName = fullTokens[0] ?? '';

    let score = 0;

    if (normalizedFull === normalizedQuery) {
      score = 100;
    }
    else if (lastName && normalizedQuery === lastName) {
      score = 80;
    }
    else if (
      firstName &&
      normalizedQuery.includes(firstName) &&
      normalizedCompany &&
      normalizedQuery.split(/\s+/).some((t) => normalizedCompany.includes(t))
    ) {
      score = 70;
    }
    else if (queryTokens.every((t) => normalizedFull.includes(t) || normalizedCompany.includes(t))) {
      score = 60;
    }
    else if (
      queryTokens.some((t) => fullTokens.some((ft) => ft === t || ft.startsWith(t) || t.startsWith(ft)))
    ) {
      score = 50;
    }
    else if (queryTokens.some((t) => normalizedFull.includes(t) || normalizedCompany.includes(t))) {
      score = 40;
    }

    return { contact, score };
  });

  return results
    .filter((r) => r.score >= 40)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
