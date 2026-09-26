import type { AdvanceTemplate, AppData, Day, DayType } from '../types';
import { syncScheduleFromAdvance } from './advance';
import { addDays, todayIso, uid } from './format';

export const DEFAULT_TEMPLATE: AdvanceTemplate = {
  id: 'tpl-standard',
  name: 'Standard club/theatre advance',
  sections: [
    {
      id: 'sec-times',
      title: 'Times',
      fields: [
        { id: 'f-loadin', label: 'Load-in', type: 'time', scheduleKey: 'loadIn' },
        { id: 'f-sc', label: 'Soundcheck', type: 'time', scheduleKey: 'soundcheck' },
        { id: 'f-doors', label: 'Doors', type: 'time', scheduleKey: 'doors' },
        { id: 'f-support', label: 'Support set', type: 'time', scheduleKey: 'support' },
        { id: 'f-show', label: 'Headline set', type: 'time', scheduleKey: 'showtime' },
        { id: 'f-curfew', label: 'Curfew', type: 'time', scheduleKey: 'curfew' },
      ],
    },
    {
      id: 'sec-venue',
      title: 'Venue specs',
      fields: [
        { id: 'f-stage', label: 'Stage dimensions (W x D x H)', type: 'text' },
        { id: 'f-power', label: 'Shore power / tie-in', type: 'text' },
        { id: 'f-loading', label: 'Loading dock / push', type: 'longtext' },
        { id: 'f-wifi', label: 'Wi-Fi network / password', type: 'text' },
      ],
    },
    {
      id: 'sec-parking',
      title: 'Parking',
      fields: [
        { id: 'f-busparking', label: 'Bus & trailer parking', type: 'longtext' },
        { id: 'f-shorepark', label: 'Shore power at bus', type: 'checkbox' },
        { id: 'f-guestpark', label: 'Guest / crew car parking', type: 'text' },
      ],
    },
    {
      id: 'sec-dressing',
      title: 'Dressing rooms & hospitality',
      fields: [
        { id: 'f-rooms', label: 'Dressing rooms (count / location)', type: 'text' },
        { id: 'f-showers', label: 'Showers available', type: 'checkbox' },
        { id: 'f-laundry', label: 'Laundry', type: 'checkbox' },
        { id: 'f-catering', label: 'Catering / buyout', type: 'longtext' },
        { id: 'f-towels', label: 'Towels (bath / stage)', type: 'text' },
      ],
    },
    {
      id: 'sec-production',
      title: 'Production',
      fields: [
        { id: 'f-foh', label: 'FOH console', type: 'text' },
        { id: 'f-mon', label: 'Monitor console', type: 'text' },
        { id: 'f-pa', label: 'PA system', type: 'text' },
        { id: 'f-lx', label: 'Lighting / house LD', type: 'text' },
        { id: 'f-stagehands', label: 'Stagehands (in / out)', type: 'text' },
        { id: 'f-barricade', label: 'Barricade', type: 'checkbox' },
      ],
    },
    {
      id: 'sec-merch',
      title: 'Merch & guest list',
      fields: [
        { id: 'f-merchcut', label: 'Merch venue cut (%)', type: 'number' },
        { id: 'f-merchseller', label: 'Venue provides seller', type: 'checkbox' },
        { id: 'f-guestlist', label: 'Guest list allotment', type: 'number' },
      ],
    },
  ],
};

export const EMPTY_DATA = (): AppData => ({
  version: 1,
  activeTourId: '',
  tours: [],
  days: [],
  templates: [DEFAULT_TEMPLATE],
  contacts: [],
  venues: [],
  expenses: [],
  settlements: [],
  documents: [],
  settings: { userName: 'Tour Manager', chatServerUrl: 'ws://localhost:4455', hostChat: true, chatPort: 4455 },
});

/** A realistic sample tour so the app is explorable on first launch. */
export function sampleData(): AppData {
  const data = EMPTY_DATA();
  const tourId = 'tour-sample';
  data.activeTourId = tourId;
  data.tours.push({
    id: tourId,
    name: 'Northern Lights Fall Tour 2026',
    artist: 'The Midnight Radios',
    currency: 'USD',
    budget: { Travel: 18000, Lodging: 9000, Crew: 22000, Production: 12000, Per_diems: 4200, Catering: 1500, Misc: 2000 },
  });

  const venues = [
    { name: 'The Fillmore', city: 'San Francisco, CA', address: '1805 Geary Blvd', capacity: 1150 },
    { name: 'Crystal Ballroom', city: 'Portland, OR', address: '1332 W Burnside St', capacity: 1500 },
    { name: 'The Showbox', city: 'Seattle, WA', address: '1426 1st Ave', capacity: 1100 },
    { name: 'Commodore Ballroom', city: 'Vancouver, BC', address: '868 Granville St', capacity: 990 },
    { name: 'The Depot', city: 'Salt Lake City, UT', address: '13 N 400 W', capacity: 1200 },
    { name: 'Ogden Theatre', city: 'Denver, CO', address: '935 E Colfax Ave', capacity: 1600 },
  ].map((v) => ({ id: uid(), notes: '', ...v }));
  data.venues = venues;

  data.contacts = [
    { name: 'Dana Whitfield', role: 'Production Manager', category: 'venue', company: 'The Fillmore', email: 'dana@fillmore.example', phone: '415-555-0142', venueId: venues[0].id },
    { name: 'Marcus Lee', role: 'Talent Buyer', category: 'promoter', company: 'Golden Gate Presents', email: 'marcus@ggp.example', phone: '415-555-0190' },
    { name: 'Priya Natarajan', role: 'Production Manager', category: 'venue', company: 'Crystal Ballroom', email: 'priya@crystal.example', phone: '503-555-0117', venueId: venues[1].id },
    { name: 'Tom Okafor', role: 'Promoter Rep', category: 'promoter', company: 'Cascade Live', email: 'tom@cascadelive.example', phone: '206-555-0133' },
    { name: 'Jess Romero', role: 'FOH Engineer', category: 'crew', company: '', email: 'jess.foh@example.com', phone: '310-555-0101' },
    { name: 'Sam Achterberg', role: 'Lighting Designer', category: 'crew', company: '', email: 'sam.lx@example.com', phone: '310-555-0102' },
    { name: 'Kenji Watanabe', role: 'Backline Tech', category: 'crew', company: '', email: 'kenji@example.com', phone: '310-555-0103' },
    { name: 'Rita Moreno-Hale', role: 'Bus Driver', category: 'vendor', company: 'Roadstar Coaches', email: 'dispatch@roadstar.example', phone: '615-555-0170' },
    { name: 'Alex Park', role: 'Production Manager', category: 'production', company: 'Midnight Radios Touring', email: 'alex.pm@example.com', phone: '310-555-0110' },
    { name: 'Lena Fischer', role: 'Lead Vocals', category: 'band', company: 'The Midnight Radios', email: 'lena@example.com', phone: '310-555-0120' },
  ].map((c) => ({ id: uid(), notes: '', ...c }) as AppData['contacts'][number]);

  const start = addDays(todayIso(), 5);
  const plan: [DayType, string, number | null][] = [
    ['show', 'San Francisco, CA', 0],
    ['travel', 'San Francisco → Portland', null],
    ['show', 'Portland, OR', 1],
    ['show', 'Seattle, WA', 2],
    ['show', 'Vancouver, BC', 3],
    ['off', 'Vancouver, BC', null],
    ['travel', 'Vancouver → Salt Lake City', null],
    ['show', 'Salt Lake City, UT', 4],
    ['show', 'Denver, CO', 5],
  ];

  plan.forEach(([type, city, venueIdx], i) => {
    const day: Day = {
      id: uid(),
      tourId,
      date: addDays(start, i),
      type,
      city,
      notes: '',
      schedule: [],
      travel: [],
    };
    if (type === 'show' && venueIdx !== null) {
      day.venueId = venues[venueIdx].id;
      day.promoterId = data.contacts[i % 2 === 0 ? 1 : 3].id;
      day.advance = {
        templateId: DEFAULT_TEMPLATE.id,
        values: {
          'f-loadin': '12:00',
          'f-sc': '16:30',
          'f-doors': '19:00',
          'f-support': '20:00',
          'f-show': '21:15',
          'f-curfew': '23:00',
          ...(i < 3 ? { 'f-stage': "40' x 28' x 4'", 'f-busparking': 'Two spots on side street, permits provided', 'f-merchcut': '20', 'f-guestlist': '20', 'f-foh': 'DiGiCo SD12' } : {}),
        },
        confirmed: i < 3 ? { 'f-loadin': true, 'f-doors': true, 'f-show': true, 'f-curfew': true } : {},
      };
      day.schedule.push({ id: uid(), time: '10:00', label: 'Bus arrives at venue' }, { id: uid(), time: '18:00', label: 'Dinner' });
      syncScheduleFromAdvance(day, DEFAULT_TEMPLATE);
      day.hotel = { name: 'Day room — Hotel Zephyr', address: '', phone: '', checkIn: '14:00', checkOut: '18:00', confirmation: 'HZ-' + (1000 + i) };
    }
    if (type === 'travel') {
      day.travel.push({ id: uid(), mode: 'bus', carrier: 'Roadstar Coaches', number: 'Bus 1', from: city.split(' → ')[0], to: city.split(' → ')[1], depart: '01:00', arrive: '11:00', confirmation: '', notes: 'Overnight drive' });
      day.schedule.push({ id: uid(), time: '01:00', label: 'Bus call' });
    }
    if (type === 'off') day.notes = 'Day off — laundry service arranged at hotel.';
    data.days.push(day);
  });

  const showDays = data.days.filter((d) => d.type === 'show');
  data.expenses = [
    { category: 'Travel', description: 'Bus lease deposit', amount: 6500, paidBy: 'Tour account', method: 'Wire' },
    { category: 'Lodging', description: 'Day rooms SF', amount: 480, paidBy: 'Tour account', method: 'Card' },
    { category: 'Per_diems', description: 'Week 1 per diems (12 x $35 x 7)', amount: 2940, paidBy: 'Cash float', method: 'Cash' },
    { category: 'Production', description: 'Backline rental', amount: 3200, paidBy: 'Tour account', method: 'Card' },
    { category: 'Catering', description: 'Runner groceries', amount: 186.42, paidBy: 'TM float', method: 'Card' },
  ].map((e, i) => ({ id: uid(), tourId, dayId: showDays[i % showDays.length].id, date: showDays[i % showDays.length].date, ...e }));

  data.settlements = [
    { dayId: showDays[0].id, dealType: 'versus' as const, guarantee: 15000, percentage: 85, ticketPrice: 35, ticketsSold: 1090, comps: 40, taxesAndFees: 3400, showExpenses: 12500, merchGross: 8200, merchVenueCut: 20, deductions: 0, notes: '', settled: true },
  ].map((s) => ({ id: uid(), ...s }));

  return data;
}
