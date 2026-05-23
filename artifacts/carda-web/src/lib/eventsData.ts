export type EventIndustryId = 'renewable' | 'mining' | 'construction';

export type EventSource = 'curated' | 'ai' | 'other';

export type EventTier = 'major' | 'standard';

export interface EventItem {
  id: string;
  industryId: EventIndustryId;
  name: string;
  city: string;
  state: string;
  venue?: string;
  dateRangeLabel: string;
  startDateIso?: string;
  endDateIso?: string;
  description: string;
  tags?: string[];
  websiteUrl?: string;
  source: EventSource;
  tier: EventTier;
  reliabilityNote?: string;
  createdAtIso?: string;
}

export interface EventIndustryMeta {
  id: EventIndustryId;
  label: string;
  iconHint?: string;
}

export const INDUSTRIES: EventIndustryMeta[] = [
  { id: 'renewable', label: 'Renewable Energy', iconHint: 'sun' },
  { id: 'mining', label: 'Mining', iconHint: 'pickaxe' },
  { id: 'construction', label: 'Construction', iconHint: 'building' },
];

export const CURATED_EVENTS: EventItem[] = [
  {
    id: 'all-energy-australia-2025',
    industryId: 'renewable',
    name: 'All-Energy Australia',
    city: 'Melbourne',
    state: 'VIC',
    venue: 'Melbourne Convention and Exhibition Centre',
    dateRangeLabel: '22–23 October 2025',
    startDateIso: '2025-10-22',
    endDateIso: '2025-10-23',
    description: "Australia's largest clean and renewable energy event, featuring 350+ exhibitors and 200+ expert speakers.",
    tags: ['Flagship', 'Expo', 'Free Entry'],
    websiteUrl: 'https://www.all-energy.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'clean-energy-summit-2025',
    industryId: 'renewable',
    name: 'Clean Energy Summit',
    city: 'Sydney',
    state: 'NSW',
    venue: 'International Convention Centre Sydney',
    dateRangeLabel: '28–29 July 2025',
    startDateIso: '2025-07-28',
    endDateIso: '2025-07-29',
    description: 'Premier policy and investment forum for the clean energy transition in Australia.',
    tags: ['Conference', 'Policy'],
    websiteUrl: 'https://www.cleanenergysummit.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'solar-storage-live-2025',
    industryId: 'renewable',
    name: 'Solar & Storage Live Australia',
    city: 'Sydney',
    state: 'NSW',
    venue: 'ICC Sydney',
    dateRangeLabel: '7–8 May 2025',
    startDateIso: '2025-05-07',
    endDateIso: '2025-05-08',
    description: 'Leading event for solar PV and energy storage professionals across the APAC region.',
    tags: ['Expo', 'Solar', 'Storage'],
    websiteUrl: 'https://www.terrapinn.com/exhibition/solar-storage-live-australia/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'australian-hydrogen-conference-2025',
    industryId: 'renewable',
    name: 'Australian Hydrogen Conference',
    city: 'Perth',
    state: 'WA',
    venue: 'Perth Convention Centre',
    dateRangeLabel: '26–27 August 2025',
    startDateIso: '2025-08-26',
    endDateIso: '2025-08-27',
    description: 'Key gathering for hydrogen industry leaders, covering production, transport, and applications.',
    tags: ['Hydrogen', 'Conference'],
    websiteUrl: 'https://www.australianhydrogenconference.com.au/',
    source: 'ai',
    tier: 'major',
    reliabilityNote: 'AI-suggested – verify dates on official site',
  },
  {
    id: 'imarc-2025',
    industryId: 'mining',
    name: 'IMARC',
    city: 'Sydney',
    state: 'NSW',
    venue: 'ICC Sydney',
    dateRangeLabel: '28–30 October 2025',
    startDateIso: '2025-10-28',
    endDateIso: '2025-10-30',
    description: "International Mining and Resources Conference – APAC's largest mining event with 10,000+ attendees.",
    tags: ['Flagship', 'Expo', 'Conference'],
    websiteUrl: 'https://imarcglobal.com/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'diggers-dealers-2025',
    industryId: 'mining',
    name: 'Diggers & Dealers Mining Forum',
    city: 'Kalgoorlie',
    state: 'WA',
    venue: 'Goldfields Arts Centre',
    dateRangeLabel: '4–6 August 2025',
    startDateIso: '2025-08-04',
    endDateIso: '2025-08-06',
    description: "Australia's premier mining investment conference held in the heart of the Goldfields.",
    tags: ['Investment', 'Networking'],
    websiteUrl: 'https://www.diggersndealers.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'aimex-2025',
    industryId: 'mining',
    name: 'AIMEX',
    city: 'Sydney',
    state: 'NSW',
    venue: 'Sydney Showground',
    dateRangeLabel: '2–4 September 2025',
    startDateIso: '2025-09-02',
    endDateIso: '2025-09-04',
    description: "Asia-Pacific's International Mining Exhibition showcasing latest mining technology and equipment.",
    tags: ['Expo', 'Technology'],
    websiteUrl: 'https://www.aimex.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'qme-2025',
    industryId: 'mining',
    name: 'Queensland Mining & Engineering Expo',
    city: 'Mackay',
    state: 'QLD',
    venue: 'Mackay Showgrounds',
    dateRangeLabel: '15–17 July 2025',
    startDateIso: '2025-07-15',
    endDateIso: '2025-07-17',
    description: "Queensland's largest mining exhibition, connecting suppliers with mine operators.",
    tags: ['Expo', 'Regional'],
    websiteUrl: 'https://www.queenslandminingexpo.com.au/',
    source: 'ai',
    tier: 'standard',
    reliabilityNote: 'AI-suggested – verify dates on official site',
  },
  {
    id: 'designbuild-2025',
    industryId: 'construction',
    name: 'DesignBUILD',
    city: 'Melbourne',
    state: 'VIC',
    venue: 'Melbourne Convention and Exhibition Centre',
    dateRangeLabel: '6–8 May 2025',
    startDateIso: '2025-05-06',
    endDateIso: '2025-05-08',
    description: "Australia's leading event for the building and construction industry, featuring 400+ exhibitors.",
    tags: ['Flagship', 'Expo'],
    websiteUrl: 'https://www.designbuildexpo.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'sydney-build-2025',
    industryId: 'construction',
    name: 'Sydney Build Expo',
    city: 'Sydney',
    state: 'NSW',
    venue: 'ICC Sydney',
    dateRangeLabel: '8–9 May 2025',
    startDateIso: '2025-05-08',
    endDateIso: '2025-05-09',
    description: "Australia's largest construction and design show with 500+ exhibitors and 20,000+ attendees.",
    tags: ['Flagship', 'Expo', 'Free Entry'],
    websiteUrl: 'https://www.sydneybuildexpo.com/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'total-facilities-2025',
    industryId: 'construction',
    name: 'Total Facilities',
    city: 'Sydney',
    state: 'NSW',
    venue: 'ICC Sydney',
    dateRangeLabel: '19–20 March 2025',
    startDateIso: '2025-03-19',
    endDateIso: '2025-03-20',
    description: 'Leading expo for facilities management, building services, and workplace solutions.',
    tags: ['Expo', 'Facilities'],
    websiteUrl: 'https://www.totalfacilities.com.au/',
    source: 'curated',
    tier: 'major',
    reliabilityNote: 'Verified from official website',
  },
  {
    id: 'australian-construction-technology-expo-2025',
    industryId: 'construction',
    name: 'Australian Construction Technology Expo',
    city: 'Brisbane',
    state: 'QLD',
    venue: 'Brisbane Convention Centre',
    dateRangeLabel: '11–12 June 2025',
    startDateIso: '2025-06-11',
    endDateIso: '2025-06-12',
    description: 'Showcasing digital transformation and technology innovation in construction.',
    tags: ['Technology', 'Innovation'],
    websiteUrl: 'https://www.constructech.com.au/',
    source: 'ai',
    tier: 'standard',
    reliabilityNote: 'AI-suggested – verify dates on official site',
  },
];

export function getEventsByIndustry(industryId: EventIndustryId): EventItem[] {
  return CURATED_EVENTS.filter((e) => e.industryId === industryId);
}

export function getEventById(id: string): EventItem | undefined {
  return CURATED_EVENTS.find((e) => e.id === id);
}

export function getMajorEvents(industryId?: EventIndustryId): EventItem[] {
  return CURATED_EVENTS.filter(
    (e) => e.tier === 'major' && (!industryId || e.industryId === industryId)
  );
}

export function sortEventsByDate(events: EventItem[]): EventItem[] {
  return [...events].sort((a, b) => {
    if (!a.startDateIso) return 1;
    if (!b.startDateIso) return -1;
    return a.startDateIso.localeCompare(b.startDateIso);
  });
}
