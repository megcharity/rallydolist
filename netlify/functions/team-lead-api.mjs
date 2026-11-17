import { timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://dndnkvxefjgcufllkkpj.supabase.co';
const CHECKLIST_ITEMS = new Set([
  'tl_guests_clear', 'tl_area_reset', 'tl_bathrooms', 'tl_event_close',
  'tl_toast_clockout', 'tl_drawers_cash', 'tl_shift_reviews',
  'tl_secure_doors', 'tl_power_down', 'tl_report_sent',
]);
const FIELD_PATTERN = /^(am|pm)_(shift_start|shift_end|court_res|count_time|peak_times|prog_(events|activ|pickle|incidents|event_count|activ_count|pickle_count|incidents_count)|host_desk|cafe|captains|team_lead|swarmer|bar|staffing|coaching|comp_notes|eighty_food|eighty_bar|rm_issues|shift_notes|covers|food_sales|bev_sales|pos_comps_amt|neg_comps_amt|neg_comp_notes|ev[1-6]_(name|rating|need_followup|well|improve|poc|followup)|ac[1-6]_(name|attendance|notes)|pk_[1-6]_(name|players|notes)|inc[1-5]_(name|phone|email|date|time|location|desc|injuries|injuries_desc|witnesses|witnesses_info|police|police_report|medical|medical_loc|notes))$/;

const todayInCharlotte = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

function isValidPassword(request) {
  const expected = process.env.RALLY_TEAM_LEAD_SHARED_PASSWORD;
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function supabaseFetch(path, { method = 'GET', body, serviceKey } = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(method === 'POST' || method === 'PATCH'
        ? { Prefer: method === 'POST' ? 'resolution=merge-duplicates,return=representation' : 'return=representation' }
        : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function loadToday(serviceKey) {
  const date = todayInCharlotte();
  const [assignmentRows, entries, reportRows] = await Promise.all([
    supabaseFetch(`/rest/v1/rally_team_lead_assignments?report_date=eq.${date}&select=email,name&limit=1`, { serviceKey }),
    supabaseFetch(`/rest/v1/rally_team_lead_entries?report_date=eq.${date}&select=shift,data,checklist,submitted,submitted_at,email_sent_at`, { serviceKey }),
    supabaseFetch(`/rest/v1/rally_shift_reports?date=eq.${date}&select=data&order=id.desc&limit=1`, { serviceKey }),
  ]);
  const assignment = Array.isArray(assignmentRows) ? assignmentRows[0] : null;
  const entryRows = Array.isArray(entries) ? entries : [];
  const amEntry = entryRows.find(entry => entry.shift === 'am') || null;
  const pmEntry = entryRows.find(entry => entry.shift === 'pm') || null;
  const reportData = Array.isArray(reportRows) ? reportRows[0]?.data : null;
  const reportClosed = reportData?.pm_submitted === true || !!pmEntry?.submitted;
  return {
    date,
    name: 'Team Lead',
    // Shared-code access: no manager assignment step, PM is always open.
    pm_assigned: true,
    pm_assigned_name: assignment?.name || '',
    report_closed: reportClosed,
    am_taken: !!amEntry,
    am: amEntry,
    pm: pmEntry,
  };
}

function validateEntry(shift, data, checklist) {
  if (!['am', 'pm'].includes(shift)) throw new Error('Invalid shift');
  if (!data || typeof data !== 'object' || Array.isArray(data)
      || !checklist || typeof checklist !== 'object' || Array.isArray(checklist)) {
    throw new Error('Invalid report data');
  }
  for (const [key, value] of Object.entries(data)) {
    if (!FIELD_PATTERN.test(key)
        || !['string', 'number', 'boolean'].includes(typeof value)
        || (typeof value === 'string' && value.length > 4000)) {
      throw new Error(`Invalid report field: ${key}`);
    }
  }
  for (const [key, value] of Object.entries(checklist)) {
    if (!CHECKLIST_ITEMS.has(key) || typeof value !== 'boolean') {
      throw new Error('Invalid checklist item');
    }
  }
}

async function saveToday(body, serviceKey) {
  const date = todayInCharlotte();
  const { shift, data, checklist, submit = false } = body;
  validateEntry(shift, data, checklist);
  if (typeof submit !== 'boolean') throw new Error('Invalid submit flag');
  if (submit && shift === 'pm'
      && [...CHECKLIST_ITEMS].some(key => key !== 'tl_report_sent' && checklist[key] !== true)) {
    throw new Error('Complete the closing checklist before submitting the report');
  }
  const [assignments, reportRows, existingRows] = await Promise.all([
    supabaseFetch(`/rest/v1/rally_team_lead_assignments?report_date=eq.${date}&select=email,name&limit=1`, { serviceKey }),
    supabaseFetch(`/rest/v1/rally_shift_reports?date=eq.${date}&select=data&order=id.desc&limit=1`, { serviceKey }),
    supabaseFetch(`/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.${shift}&select=*&limit=1`, { serviceKey }),
  ]);
  const assignment = Array.isArray(assignments) ? assignments[0] : null;
  const reportData = Array.isArray(reportRows) ? reportRows[0]?.data : null;
  const existing = Array.isArray(existingRows) ? existingRows[0] : null;
  if (reportData?.pm_submitted === true || (shift === 'pm' && existing?.submitted)) {
    throw new Error('Today’s shift report has already been submitted');
  }
  if (existing?.submitted) {
    const savedChecklist = shift === 'pm' ? { ...checklist, tl_report_sent: false } : checklist;
    if (submit && JSON.stringify(existing.data) === JSON.stringify(data)
        && JSON.stringify(existing.checklist) === JSON.stringify(savedChecklist)) {
      return { submitted: true, email_sent_at: existing.email_sent_at };
    }
    throw new Error('This shift report has already been submitted');
  }
  const savedChecklist = shift === 'pm' ? { ...checklist, tl_report_sent: false } : checklist;
  const savedAt = new Date().toISOString();
  const rows = await supabaseFetch('/rest/v1/rally_team_lead_entries', {
    method: 'POST',
    body: {
      report_date: date,
      shift,
      user_id: null,
      email: 'shared-team-lead',
      name: String(data[`${shift}_team_lead`] || (shift === 'pm' && assignment?.name) || 'Team Lead').trim().slice(0, 120) || 'Team Lead',
      data,
      checklist: savedChecklist,
      submitted: submit,
      submitted_at: submit ? savedAt : null,
      updated_at: savedAt,
    },
    serviceKey,
  });
  if (!Array.isArray(rows) || !rows.length) throw new Error('The shift report could not be saved');
  return { submitted: !!submit, email_sent_at: rows[0].email_sent_at };
}

export default async function handler(request) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  if (!process.env.RALLY_TEAM_LEAD_SHARED_PASSWORD) {
    return Response.json({ error: 'Team Lead access is not configured' }, { status: 503, headers });
  }
  if (!isValidPassword(request)) return Response.json({ error: 'Incorrect Team Lead password' }, { status: 401, headers });
  const serviceKey = process.env.RALLY_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ error: 'Team Lead data service is not configured' }, { status: 503, headers });
  try {
    const body = await request.json();
    const result = body.action === 'load'
      ? await loadToday(serviceKey)
      : body.action === 'save'
        ? await saveToday(body, serviceKey)
        : null;
    if (!result) return Response.json({ error: 'Invalid action' }, { status: 400, headers });
    return Response.json(result, { status: 200, headers });
  } catch (error) {
    console.error('Team Lead API request failed', error);
    const status = error.message.startsWith('Supabase request failed (4') ? 400 : 500;
    return Response.json({ error: error.message }, { status, headers });
  }
}
