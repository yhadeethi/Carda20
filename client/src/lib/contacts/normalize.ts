import { isUUID } from './ids';

export interface ServerContact {
  id: number | string;
  publicId?: string;
  [key: string]: any;
}

export function normalizeServerContact<T extends ServerContact>(contact: T): T & { id: string; dbId?: number } {
  const id = contact.id;
  const publicId = contact.publicId;

  if (typeof id === 'number' && publicId && isUUID(publicId)) {
    const { publicId: _pub, ...rest } = contact;
    return { ...rest, id: publicId, dbId: id } as any;
  }

  if (typeof id === 'string' && !isUUID(id) && publicId && isUUID(publicId)) {
    const { publicId: _pub, ...rest } = contact;
    return { ...rest, id: publicId, dbId: Number(id) || undefined } as any;
  }

  return contact as any;
}

export function normalizeServerContacts<T extends ServerContact>(contacts: T[]): (T & { id: string; dbId?: number })[] {
  return contacts.map(normalizeServerContact);
}
