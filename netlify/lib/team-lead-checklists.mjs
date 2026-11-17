// Team Lead opening/closing checklists.
//
// The live lists are editable by managers in the do-list's Checklist Editor
// (role "Team Lead"), which saves them inside rally_checklists_config
// (id = 'all_checklists') under the keys below. These defaults are only used
// until someone saves an edit — keep them identical to the teamlead_opening /
// teamlead_closing defaults in ALL_CHECKLISTS in index.html.

export const OPENING_KEY = 'teamlead_opening';
export const CLOSING_KEY = 'teamlead_closing';

// Not editable: ticked automatically once the PM report email has gone out.
export const REPORT_SENT_ITEM = { id: 'tl_report_sent', text: 'Submit and email the completed shift report' };

export const DEFAULT_OPENING = [
  { id: 'tl_open_doors', section: 'Opening', type: 'check', text: 'Unlock all doors (around 6:50am). Open garage doors if it’s above 45°F outside' },
  { id: 'tl_open_lights', section: 'Opening', type: 'check', text: 'Turn on all lights (including court number lights), TVs, and music' },
  { id: 'tl_open_floor', section: 'Opening', type: 'check', text: 'Reset the floor: stools off bar tops and chairs under tables' },
  { id: 'tl_open_outdoor', section: 'Opening', type: 'check', text: 'Set up outdoor area: cushions out, umbrellas out, tables wiped, TV covers off' },
  { id: 'tl_open_water', section: 'Opening', type: 'check', text: 'Reset all court lounges, including outdoor: menus and QR codes in place, water jugs filled with ice' },
  { id: 'tl_open_dish', section: 'Opening', type: 'check', text: 'Turn on dishwashers (bar and Captain’s Quarters) and test sanitizer with sani strips' },
  { id: 'tl_open_bar', section: 'Opening', type: 'check', text: 'Open the bar' },
  { id: 'tl_open_towels', section: 'Opening', type: 'check', text: 'Make sure towel roll-ups are ready in the bar fridge' },
  { id: 'tl_open_host', section: 'Opening', type: 'check', text: 'Set up host station: computer on, host TV on, take the host phone' },
  { id: 'tl_open_cash', section: 'Opening', type: 'check', text: 'Count the safe and put out bar and café drawers ($300 each). Complete the safe count sheet' },
  { id: 'tl_open_events', section: 'Opening', type: 'check', text: 'Check the reservation list and member list' },
  { id: 'tl_open_beo', section: 'Opening', type: 'check', text: 'Check Triple Seat and the Event Office for a BEO. If there’s an event, meet with the kitchen to review the BEO' },
  { id: 'tl_open_floorchart', section: 'Opening', type: 'check', text: 'Fill out the floor chart' },
  { id: 'tl_open_lineup', section: 'Opening', type: 'check', text: 'Review the lineup with every associate as they arrive' },
];

export const DEFAULT_CLOSING = [
  { id: 'tl_guests_clear', section: 'Closing', type: 'check', text: 'Final walkthrough: confirm guests and staff are out of all areas' },
  { id: 'tl_area_reset', section: 'Closing', type: 'check', text: 'Reset courts and lounges: clear glassware and plates, sweep courts, wipe rails, and straighten seating' },
  { id: 'tl_lounges_clean', section: 'Closing', type: 'check', text: 'Check all lounges and surrounding areas: no drink rings and no food on the floor' },
  { id: 'tl_lounges_reset', section: 'Closing', type: 'check', text: 'Reset all lounges with menus and QR codes, and empty all the water jugs' },
  { id: 'tl_pizza_oven', section: 'Closing', type: 'check', text: 'Turn off the pizza oven' },
  { id: 'tl_pizza_back', section: 'Closing', type: 'check', text: 'Behind pizza is clean and clear of dishes' },
  { id: 'tl_bathrooms', section: 'Closing', type: 'check', text: 'Check bathrooms and empty trash' },
  { id: 'tl_event_close', section: 'Closing', type: 'check', text: 'Close event spaces and return event materials' },
  { id: 'tl_toast_clockout', section: 'Closing', type: 'check', text: 'Confirm all employees are logged out of Toast and clocked out' },
  { id: 'tl_drawers_cash', section: 'Closing', type: 'check', text: 'Count the cash drawers (bar and café), complete the cash sheet, and file receipts' },
  { id: 'tl_cleaners', section: 'Closing', type: 'check', text: 'Cleaners coming: put chairs up. No cleaners: turn off all the lights' },
  { id: 'tl_power_down', section: 'Closing', type: 'check', text: 'Turn off TVs, music, and nonessential equipment' },
  { id: 'tl_secure_doors', section: 'Closing', type: 'check', text: 'Make sure all doors are locked' },
];

const ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

// Keep only well-formed items; an empty or broken saved list falls back to the defaults.
function clean(list, fallback) {
  if (!Array.isArray(list)) return fallback;
  const seen = new Set();
  const items = [];
  for (const item of list) {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') continue;
    if (!ID_PATTERN.test(item.id) || item.id === REPORT_SENT_ITEM.id || seen.has(item.id)) continue;
    const text = item.text.trim().slice(0, 300);
    if (!text) continue;
    seen.add(item.id);
    items.push({ id: item.id, section: String(item.section || ''), type: 'check', text });
  }
  return items.length ? items : fallback;
}

// fetchJson(path) must GET a Supabase REST path with the service key and return parsed JSON.
export async function loadTeamLeadChecklists(fetchJson) {
  try {
    const rows = await fetchJson('/rest/v1/rally_checklists_config?id=eq.all_checklists&select=data&limit=1');
    const data = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    return {
      opening: clean(data?.[OPENING_KEY], DEFAULT_OPENING),
      closing: clean(data?.[CLOSING_KEY], DEFAULT_CLOSING),
    };
  } catch (error) {
    console.error('Could not load Team Lead checklists; using defaults', error);
    return { opening: DEFAULT_OPENING, closing: DEFAULT_CLOSING };
  }
}

// Saves (or updates) today's Team Lead checklist as a signed-off rally_checklist
// row, the same record shape a manager sign-off produces, so it shows up in the
// daily checklist report.
export async function recordChecklistSignOff(supabaseFetch, serviceKey, { shift, date, name, items, checklist }) {
  const key = shift === 'am' ? OPENING_KEY : CLOSING_KEY;
  const payload = {
    shift: key,
    manager_name: name,
    date,
    items: Object.fromEntries(items.map(item => [item.id, { done: checklist[item.id] === true }])),
    signed_off_at: new Date().toISOString(),
  };
  const existing = await supabaseFetch(
    `/rest/v1/rally_checklist?shift=eq.${key}&date=eq.${date}&select=id&order=id.desc&limit=1`,
    { serviceKey },
  );
  const id = Array.isArray(existing) && existing[0] ? existing[0].id : null;
  if (id) {
    await supabaseFetch(`/rest/v1/rally_checklist?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: payload, serviceKey });
  } else {
    await supabaseFetch('/rest/v1/rally_checklist', { method: 'POST', body: payload, serviceKey });
  }
}
