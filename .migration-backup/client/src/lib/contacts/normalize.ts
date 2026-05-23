import { isUUID } from './ids';

export interface ServerEntity {
  id: number | string;
  publicId?: string;
  [key: string]: any;
}

export type ServerContact = ServerEntity;

function normalizeServerEntity<T extends ServerEntity>(entity: T): T & { id: string; dbId?: number } {
  const id = entity.id;
  const publicId = entity.publicId;

  if (typeof id === 'number' && publicId && isUUID(publicId)) {
    const { publicId: _pub, ...rest } = entity;
    return { ...rest, id: publicId, dbId: id } as any;
  }

  if (typeof id === 'string' && !isUUID(id) && publicId && isUUID(publicId)) {
    const { publicId: _pub, ...rest } = entity;
    return { ...rest, id: publicId, dbId: Number(id) || undefined } as any;
  }

  return entity as any;
}

export function normalizeServerContact<T extends ServerEntity>(contact: T): T & { id: string; dbId?: number } {
  return normalizeServerEntity(contact);
}

export function normalizeServerContacts<T extends ServerEntity>(contacts: T[]): (T & { id: string; dbId?: number })[] {
  return contacts.map(normalizeServerEntity);
}

export function normalizeServerCompany<T extends ServerEntity>(company: T): T & { id: string; dbId?: number } {
  return normalizeServerEntity(company);
}

export function normalizeServerCompanies<T extends ServerEntity>(companies: T[]): (T & { id: string; dbId?: number })[] {
  return companies.map(normalizeServerEntity);
}
