/**
 * HubSpot Integration Service
 * Uses Replit's HubSpot connector for OAuth authentication
 */

import { Client } from '@hubspot/api-client';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=hubspot',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('HubSpot not connected');
  }
  return accessToken;
}

async function getUncachableHubSpotClient() {
  const accessToken = await getAccessToken();
  return new Client({ accessToken });
}

export interface HubSpotContactData {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  jobtitle?: string;
  website?: string;
  city?: string;
  address?: string;
}

export interface HubSpotSyncResult {
  success: boolean;
  hubspotId?: string;
  action?: 'created' | 'updated';
  error?: string;
}

/**
 * Check if HubSpot is connected
 */
export async function isHubSpotConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

/**
 * Create or update a contact in HubSpot
 */
export async function syncContactToHubSpot(contact: HubSpotContactData): Promise<HubSpotSyncResult> {
  if (!contact.email) {
    return { success: false, error: 'Email is required to sync with HubSpot' };
  }

  try {
    const client = await getUncachableHubSpotClient();
    
    // Parse name into first/last if not already split
    let firstname = contact.firstname;
    let lastname = contact.lastname;
    
    if (!firstname && !lastname && contact.company) {
      // If we only have company name, try to extract from full name pattern
      const nameParts = contact.company.split(' ');
      if (nameParts.length >= 2) {
        firstname = nameParts[0];
        lastname = nameParts.slice(1).join(' ');
      } else {
        firstname = contact.company;
      }
    }

    const properties: Record<string, string> = {
      email: contact.email,
    };

    if (firstname) properties.firstname = firstname;
    if (lastname) properties.lastname = lastname;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.company) properties.company = contact.company;
    if (contact.jobtitle) properties.jobtitle = contact.jobtitle;
    if (contact.website) properties.website = contact.website;
    if (contact.city) properties.city = contact.city;
    if (contact.address) properties.address = contact.address;

    // Try to update existing contact first
    try {
      const existingContact = await client.crm.contacts.basicApi.getById(
        contact.email,
        undefined,
        undefined,
        undefined,
        false,
        'email'
      );
      
      // Contact exists, update it
      const updatedContact = await client.crm.contacts.basicApi.update(
        existingContact.id,
        { properties }
      );
      
      return {
        success: true,
        hubspotId: updatedContact.id,
        action: 'updated'
      };
    } catch (getError: any) {
      // Contact doesn't exist, create new one
      if (getError.code === 404 || getError.statusCode === 404) {
        const newContact = await client.crm.contacts.basicApi.create({
          properties,
          associations: []
        });
        
        return {
          success: true,
          hubspotId: newContact.id,
          action: 'created'
        };
      }
      throw getError;
    }
  } catch (error: any) {
    console.error('HubSpot sync error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sync with HubSpot'
    };
  }
}

/**
 * Batch sync multiple contacts to HubSpot
 */
export async function batchSyncContactsToHubSpot(contacts: HubSpotContactData[]): Promise<{
  synced: number;
  failed: number;
  results: HubSpotSyncResult[];
}> {
  const results: HubSpotSyncResult[] = [];
  let synced = 0;
  let failed = 0;

  for (const contact of contacts) {
    const result = await syncContactToHubSpot(contact);
    results.push(result);
    if (result.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed, results };
}
