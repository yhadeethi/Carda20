/**
 * ID generation utilities — canonical UUID format
 */

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateShortId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
