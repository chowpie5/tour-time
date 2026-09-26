export type DayType = 'show' | 'travel' | 'off';

/** Schedule slots that advance fields can drive automatically. */
export const SCHEDULE_KEYS = {
  loadIn: 'Load-in',
  soundcheck: 'Soundcheck',
  doors: 'Doors',
  support: 'Support set',
  showtime: 'Headline set',
  curfew: 'Curfew',
  busCall: 'Bus call',
  lobbyCall: 'Lobby call',
} as const;
export type ScheduleKey = keyof typeof SCHEDULE_KEYS;

export interface Tour {
  id: string;
  name: string;
  artist: string;
  currency: string;
  budget: Record<string, number>; // category -> planned amount
  /** Chat room code shared with tour members (defaults to the tour id). */
  chatRoom?: string;
}

export interface ScheduleItem {
  id: string;
  time: string; // HH:MM
  label: string;
  /** Set when the item is generated from an advance field. */
  key?: ScheduleKey;
}

export interface TravelLeg {
  id: string;
  mode: 'bus' | 'flight' | 'train' | 'van' | 'car' | 'other';
  carrier: string;
  number: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
  confirmation: string;
  notes: string;
}

export interface Hotel {
  name: string;
  address: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  confirmation: string;
}

export interface DayAdvance {
  templateId: string;
  values: Record<string, string>; // fieldId -> value
  confirmed: Record<string, boolean>; // fieldId -> confirmed with venue
}

export interface Day {
  id: string;
  tourId: string;
  date: string; // YYYY-MM-DD
  type: DayType;
  city: string;
  venueId?: string;
  promoterId?: string;
  notes: string;
  schedule: ScheduleItem[];
  travel: TravelLeg[];
  hotel?: Hotel;
  advance?: DayAdvance;
}

export type FieldType = 'text' | 'longtext' | 'time' | 'number' | 'checkbox';

export interface AdvanceField {
  id: string;
  label: string;
  type: FieldType;
  scheduleKey?: ScheduleKey;
}

export interface AdvanceSection {
  id: string;
  title: string;
  fields: AdvanceField[];
}

export interface AdvanceTemplate {
  id: string;
  name: string;
  sections: AdvanceSection[];
}

export type ContactCategory = 'venue' | 'promoter' | 'crew' | 'production' | 'band' | 'vendor' | 'other';

export interface Contact {
  id: string;
  name: string;
  role: string;
  category: ContactCategory;
  company: string;
  email: string;
  phone: string;
  notes: string;
  venueId?: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
  notes: string;
}

export interface Expense {
  id: string;
  tourId: string;
  dayId?: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  method: string;
}

export type DealType = 'guarantee' | 'versus' | 'door';

export interface Settlement {
  id: string;
  dayId: string;
  dealType: DealType;
  guarantee: number;
  percentage: number; // artist % of net
  ticketPrice: number;
  ticketsSold: number;
  comps: number;
  taxesAndFees: number;
  showExpenses: number;
  merchGross: number;
  merchVenueCut: number; // percent
  deductions: number;
  notes: string;
  settled: boolean;
}

export type DocCategory = 'contract' | 'rider' | 'stage plot' | 'input list' | 'insurance' | 'visa/immigration' | 'other';

export interface TourDocument {
  id: string;
  tourId: string;
  dayId?: string;
  name: string;
  category: DocCategory;
  storedName?: string; // on disk (desktop app)
  dataUrl?: string; // browser fallback for small files
  size: number;
  addedAt: string;
}

export interface Settings {
  userName: string;
  chatServerUrl: string;
  hostChat: boolean;
  chatPort: number;
}

export interface AppData {
  version: 1;
  activeTourId: string;
  tours: Tour[];
  days: Day[];
  templates: AdvanceTemplate[];
  contacts: Contact[];
  venues: Venue[];
  expenses: Expense[];
  settlements: Settlement[];
  documents: TourDocument[];
  settings: Settings;
}
