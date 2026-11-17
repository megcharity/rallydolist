import { timingSafeEqual } from 'node:crypto';

const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID || 'service_yuz9zab';
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_SHIFT_REPORT_TEMPLATE_ID || 'template_0nxwpkt';
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY || 'Xv8PW_nj-tZKsC279';
const SUPABASE_URL = 'https://dndnkvxefjgcufllkkpj.supabase.co';

const AM_FIELDS = [
  ['am_manager_name', 'Manager / Team Lead'],
  ['am_shift_start', 'Shift start'],
  ['am_shift_end', 'Shift end'],
  ['am_count_time', 'Counted through'],
  ['am_court_res', 'Court reservations'],
  ['am_peak_times', 'Peak times'],
  ['am_host_desk', 'Host Desk'],
  ['am_cafe', 'Café'],
  ['am_captains', 'Captains'],
  ['am_team_lead', 'Team Lead'],
  ['am_swarmer', 'Swarmer'],
  ['am_bar', 'Bar'],
  ['am_staffing', 'Staffing adjustments'],
  ['am_coaching', 'Coaching & feedback'],
  ['am_comp_notes', 'Comp notes'],
  ['am_eighty_food', "86'd food"],
  ['am_eighty_bar', "86'd bar / beverage"],
  ['am_rm_issues', 'Repairs, maintenance & cleaning'],
  ['am_shift_notes', 'Shift notes & handoff'],
];

const PM_FIELDS = [
  ['pm_manager_name', 'Manager / Team Lead'],
  ['pm_shift_start', 'Shift start'],
  ['pm_shift_end', 'Shift end'],
  ['pm_court_res', 'Court reservations'],
  ['pm_covers', 'Covers on Toast'],
  ['pm_food_sales', 'Food sales'],
  ['pm_bev_sales', 'Beverage sales'],
  ['pm_pos_comps_amt', 'Positive comps'],
  ['pm_neg_comps_amt', 'Negative comps'],
  ['pm_comp_notes', 'Positive comp notes'],
  ['pm_neg_comp_notes', 'Negative comp notes'],
  ['pm_eighty_food', "86'd food"],
  ['pm_eighty_bar', "86'd bar / beverage"],
  ['pm_peak_times', 'Peak times'],
  ['pm_host_desk', 'Host Desk'],
  ['pm_captains', 'Captains'],
  ['pm_team_lead', 'Team Lead'],
  ['pm_bar', 'Bar'],
  ['pm_swarmer', 'Swarmer'],
  ['pm_staffing', 'Staffing adjustments'],
  ['pm_coaching', 'Coaching & feedback'],
  ['pm_rm_issues', 'Repairs, maintenance & cleaning'],
  ['pm_shift_notes', 'Closing notes'],
];

const CHECKLIST_ITEMS = [
  ['tl_guests_clear', 'Guests and staff are out of all areas'],
  ['tl_area_reset', 'Courts and lounges reset'],
  ['tl_bathrooms', 'Bathrooms checked and trash emptied'],
  ['tl_event_close', 'Event spaces closed and materials returned'],
  ['tl_toast_clockout', 'Employees logged out of Toast and clocked out'],
  ['tl_drawers_cash', 'Bar and café drawers counted; cash sheet and receipts completed'],
  ['tl_shift_reviews', 'Associate shift reviews collected'],
  ['tl_secure_doors', 'Venue doors secured'],
  ['tl_power_down', 'TVs, music, and nonessential equipment turned off'],
  ['tl_report_sent', 'Shift report submitted and emailed'],
];

const html = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')
  .replaceAll('\n', '<br>');
const present = value => value !== undefined && value !== null && String(value).trim() !== '' && String(value).trim() !== '—';
const row = (label, value) => present(value)
  ? `<tr><td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;">${html(label)}</td><td style="padding:6px 0;color:#174854;vertical-align:top;">${html(value)}</td></tr>`
  : '';

function programmingSection(data, prefix) {
  let content = '';
  const eventCount = Math.max(0, Math.min(6, Number.parseInt(data[`${prefix}_prog_event_count`], 10) || 0));
  const activationCount = Math.max(0, Math.min(5, Number.parseInt(data[`${prefix}_prog_activ_count`], 10) || 0));
  for (let i = 1; i <= 6; i++) {
    if (data[`${prefix}_prog_events`] === 'true' && i <= eventCount) {
      const name = data[`${prefix}_ev${i}_name`];
      if (present(name)) {
        content += `<div style="padding:9px 12px;margin:8px 0;background:#f6f5ee;border-left:3px solid #9fc2b3;">`;
        content += `<strong>${html(name)}</strong>`;
        for (const [suffix, label] of [['rating', 'Rating'], ['well', 'Went well'], ['improve', 'Improve'], ['poc', 'POC feedback'], ['need_followup', 'Follow-up needed'], ['followup', 'Follow-up']]) {
          const value = data[`${prefix}_ev${i}_${suffix}`];
          if (present(value)) content += `<div style="margin-top:4px;font-size:12px;">${html(label)}: ${html(value)}</div>`;
        }
        content += '</div>';
      }
    }
    if (data[`${prefix}_prog_activ`] === 'true' && i <= activationCount) {
      const activation = data[`${prefix}_ac${i}_name`];
      if (present(activation)) {
        content += `<div style="padding:9px 12px;margin:8px 0;background:#f6f5ee;border-left:3px solid #e8be6c;"><strong>${html(activation)}</strong>`;
        if (present(data[`${prefix}_ac${i}_attendance`])) content += `<div style="margin-top:4px;font-size:12px;">Players: ${html(data[`${prefix}_ac${i}_attendance`])}</div>`;
        if (present(data[`${prefix}_ac${i}_notes`])) content += `<div style="margin-top:4px;font-size:12px;">${html(data[`${prefix}_ac${i}_notes`])}</div>`;
        content += '</div>';
      }
    }
  }
  if (data[`${prefix}_prog_pickle`] === 'true') {
    const pickleCount = Math.max(0, Math.min(6, Number.parseInt(data[`${prefix}_prog_pickle_count`], 10) || 0));
    for (let i = 1; i <= pickleCount; i++) {
      const name = data[`${prefix}_pk_${i}_name`];
      if (present(name)) {
        content += `<div style="padding:9px 12px;margin:8px 0;background:#f6f5ee;border-left:3px solid #82a6b0;"><strong>${html(name)}</strong>`;
        if (present(data[`${prefix}_pk_${i}_players`])) content += `<div style="margin-top:4px;font-size:12px;">Players: ${html(data[`${prefix}_pk_${i}_players`])}</div>`;
        if (present(data[`${prefix}_pk_${i}_notes`])) content += `<div style="margin-top:4px;font-size:12px;">${html(data[`${prefix}_pk_${i}_notes`])}</div>`;
        content += '</div>';
      }
    }
  }
  return content;
}

function incidentSection(data, prefix) {
  let content = '';
  const count = Math.max(0, Math.min(5, Number.parseInt(data[`${prefix}_prog_incidents_count`], 10) || 0));
  if (data[`${prefix}_prog_incidents`] !== 'true') return content;
  for (let i = 1; i <= count; i++) {
    if (!present(data[`${prefix}_inc${i}_location`]) && !present(data[`${prefix}_inc${i}_desc`])) continue;
    content += `<div style="padding:10px 12px;margin:8px 0;background:#fff3f0;border-left:3px solid #c04020;color:#7a2c20;">`;
    content += '<strong>Incident reported</strong><div style="margin-top:4px;font-size:12px;">';
    content += present(data[`${prefix}_inc${i}_notes`]) ? html(data[`${prefix}_inc${i}_notes`]) : 'See full details in the app.';
    content += '</div></div>';
  }
  return content;
}

function shiftSection(data, prefix, title, fields) {
  let rows = '';
  for (const [key, label] of fields) rows += row(label, data[key]);
  const programs = programmingSection(data, prefix);
  const incidents = incidentSection(data, prefix);
  return `<section style="padding:20px 24px;border-top:1px solid #e9e3d8;">
    <h2 style="margin:0 0 12px;color:#174854;font-size:17px;">${title}</h2>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    ${programs ? `<h3 style="margin:16px 0 8px;color:#174854;font-size:13px;">Events & programming</h3>${programs}` : ''}
    ${incidents ? `<h3 style="margin:16px 0 8px;color:#c04020;font-size:13px;">Incidents</h3>${incidents}` : ''}
  </section>`;
}

function reportHtml(data, date) {
  const day = new Date(`${date}T12:00:00-04:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  });
  const food = Number.parseFloat(data.pm_food_sales) || 0;
  const beverage = Number.parseFloat(data.pm_bev_sales) || 0;
  const covers = Number.parseFloat(data.pm_covers) || 0;
  const courts = (Number.parseInt(data.am_court_res, 10) || 0) + (Number.parseInt(data.pm_court_res, 10) || 0);
  const total = food + beverage;
  const stats = [
    ['Courts', courts || '—'],
    ['Covers', covers || '—'],
    ['Food', food ? `$${food.toFixed(2)}` : '—'],
    ['Beverage', beverage ? `$${beverage.toFixed(2)}` : '—'],
    ['Total', total ? `$${total.toFixed(2)}` : '—'],
    ['PPA', covers ? `$${(total / covers).toFixed(2)}` : '—'],
  ];
  const checklistRows = CHECKLIST_ITEMS.map(([id, label]) =>
    `<li style="margin:5px 0;">${data.team_lead_closing_checklist?.[id] ? '✓' : '○'} ${html(label)}</li>`
  ).join('');
  return `<!doctype html><html><body style="margin:0;background:#f5f0e8;font-family:Arial,sans-serif;color:#174854;">
    <main style="max-width:640px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;">
      <header style="padding:24px;background:#174854;color:#fbf6ed;text-align:center;">
        <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;">Rally Social Club</div>
        <h1 style="margin:8px 0;font-size:25px;font-weight:500;">Daily Shift Report</h1>
        <div>${html(day)}</div>
      </header>
      <section style="padding:16px 24px;background:#f0e9da;">
        <h2 style="margin:0 0 12px;font-size:13px;">Day summary</h2>
        <table width="100%" cellpadding="5" cellspacing="0"><tr>
          ${stats.map(([label, value]) => `<td align="center"><div style="font-size:10px;text-transform:uppercase;opacity:.65;">${label}</div><strong>${html(value)}</strong></td>`).join('')}
        </tr></table>
      </section>
      ${shiftSection(data, 'am', 'AM Shift', AM_FIELDS)}
      ${shiftSection(data, 'pm', 'PM Shift', PM_FIELDS)}
      <section style="padding:18px 24px;border-top:1px solid #e9e3d8;">
        <h2 style="margin:0 0 8px;font-size:14px;">Team Lead Closing Checklist</h2>
        <ul style="padding-left:20px;margin:0;font-size:12px;">${checklistRows}</ul>
      </section>
    </main></body></html>`;
}

const todayInCharlotte = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

async function supabaseFetch(path, { method = 'GET', body, serviceKey } = {}) {
  if (!serviceKey) throw new Error('Supabase function service key is not configured');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(method === 'POST' || method === 'PATCH' ? { Prefer: 'return=representation' } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

function validSharedPassword(request) {
  const expected = process.env.RALLY_TEAM_LEAD_SHARED_PASSWORD;
  const authorization = request.headers.get('authorization') || '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length
    && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

async function submitSharedReport(request, headers) {
  if (!process.env.RALLY_TEAM_LEAD_SHARED_PASSWORD) {
    return Response.json({ error: 'Team Lead access is not configured' }, { status: 503, headers });
  }
  if (!validSharedPassword(request)) {
    return Response.json({ error: 'Incorrect Team Lead password' }, { status: 401, headers });
  }
  const serviceKey = process.env.RALLY_SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    return Response.json({ error: 'Submission service is not configured' }, { status: 503, headers });
  }
  const date = todayInCharlotte();
  let emailLockAcquired = false;
  let emailAccepted = false;
  try {
    const entryRows = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&select=*&limit=1`,
      { serviceKey },
    );
    const entry = Array.isArray(entryRows) ? entryRows[0] : null;
    if (!entry || !entry.submitted) {
      return Response.json({ error: 'Save and submit the PM report first' }, { status: 409, headers });
    }
    if (entry.email_sent_at) return Response.json({ sent: true, alreadySent: true }, { status: 200, headers });

    const staleLock = encodeURIComponent(new Date(Date.now() - 5 * 60 * 1000).toISOString());
    const lockRows = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&email_sent_at=is.null&or=(email_sending_at.is.null,email_sending_at.lt.${staleLock})&select=report_date`,
      { method: 'PATCH', body: { email_sending_at: new Date().toISOString() }, serviceKey },
    );
    if (!Array.isArray(lockRows) || !lockRows.length) {
      const currentRows = await supabaseFetch(
        `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&select=email_sent_at&limit=1`,
        { serviceKey },
      );
      if (Array.isArray(currentRows) && currentRows[0]?.email_sent_at) {
        return Response.json({ sent: true, alreadySent: true }, { status: 200, headers });
      }
      return Response.json({ error: 'The shift report email is already being sent. Try again shortly.' }, { status: 409, headers });
    }
    emailLockAcquired = true;

    const allEntries = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&submitted=eq.true&select=shift,email,name,data,checklist,submitted_at`,
      { serviceKey },
    );
    const amEntry = Array.isArray(allEntries) ? allEntries.find(item => item.shift === 'am') : null;
    const pmEntry = Array.isArray(allEntries) ? allEntries.find(item => item.shift === 'pm') : null;
    if (!pmEntry) throw new Error('The submitted PM entry could not be found');

    const reportRows = await supabaseFetch(
      `/rest/v1/rally_shift_reports?date=eq.${date}&select=id,data&order=id.desc&limit=1`,
      { serviceKey },
    );
    const existing = Array.isArray(reportRows) ? reportRows[0] : null;
    const reportData = existing?.data && typeof existing.data === 'object' ? { ...existing.data } : {};
    if (reportData.pm_submitted && !reportData._team_lead_pm) {
      throw new Error('This daily report was already submitted');
    }
    if (amEntry?.data && typeof amEntry.data === 'object') {
      const mergedAmFields = [];
      for (const [key, value] of Object.entries(amEntry.data)) {
        if (key.startsWith('am_') && (reportData[key] === undefined || reportData[key] === null || reportData[key] === '')) {
          reportData[key] = value;
          mergedAmFields.push(key);
        }
      }
      if (!reportData.am_manager_name) {
        reportData.am_manager_name = amEntry.name;
        mergedAmFields.push('am_manager_name');
      }
      reportData._team_lead_am = { name: amEntry.name, submitted_at: amEntry.submitted_at };
      reportData._team_lead_am_fields = mergedAmFields;
    }
    for (const key of Object.keys(reportData)) {
      if (key.startsWith('pm_') && !['pm_submitted', 'pm_submitted_by', 'pm_submitted_at'].includes(key)) {
        delete reportData[key];
      }
    }
    for (const [key, value] of Object.entries(pmEntry.data || {})) {
      if (key.startsWith('pm_')) reportData[key] = value;
    }
    reportData.pm_manager_name = pmEntry.name;
    reportData._team_lead_pm = { name: pmEntry.name, email: pmEntry.email, submitted_at: pmEntry.submitted_at };
    reportData.team_lead_closing_checklist = { ...(pmEntry.checklist || {}), tl_report_sent: true };
    reportData.pm_submitted = true;
    reportData.pm_submitted_by = pmEntry.name;
    reportData.pm_submitted_at = pmEntry.submitted_at || new Date().toISOString();
    reportData.am_locked = true;
    reportData.am_locked_by = reportData.am_locked_by || (amEntry?.name || 'Team Lead closeout');
    reportData.am_locked_at = reportData.am_locked_at || pmEntry.submitted_at;

    if (existing) {
      await supabaseFetch(`/rest/v1/rally_shift_reports?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH', body: { data: reportData }, serviceKey,
      });
    } else {
      await supabaseFetch('/rest/v1/rally_shift_reports', {
        method: 'POST', body: { date, data: reportData }, serviceKey,
      });
    }

    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          subject: `Rally Shift Report - ${new Date(`${date}T12:00:00-04:00`).toLocaleDateString('en-US', { weekday: 'long' })}`,
          message: reportHtml(reportData, date),
          to_email: '',
        },
      }),
    });
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Shift report email failed (${emailResponse.status}): ${errorText}`);
    }
    emailAccepted = true;

    const emailMarkRows = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm`,
      {
        method: 'PATCH',
        body: {
          email_sent_at: new Date().toISOString(),
          email_sending_at: null,
          checklist: { ...(entry.checklist || {}), tl_report_sent: true },
        },
        serviceKey,
      },
    );
    if (!Array.isArray(emailMarkRows) || !emailMarkRows.length) {
      throw new Error('Email was sent, but its delivery status could not be saved');
    }
    return Response.json({ sent: true }, { status: 200, headers });
  } catch (error) {
    console.error('Team Lead shift report submission failed', error);
    if (emailLockAcquired && !emailAccepted) {
      await supabaseFetch(
        `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&email_sent_at=is.null`,
        { method: 'PATCH', body: { email_sending_at: null }, serviceKey },
      );
    }
    return Response.json({ error: error.message || 'Could not submit the shift report' }, { status: 500, headers });
  }
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
  if (process.env.RALLY_TEAM_LEAD_SHARED_PASSWORD) {
    return submitSharedReport(request, headers);
  }

  let emailLock = null;
  let emailAccepted = false;
  try {
    const date = todayInCharlotte();
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const serviceKey = process.env.RALLY_SUPABASE_SERVICE_ROLE_KEY;
    if (!token || !serviceKey || !EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      return Response.json({ error: 'Submission service is not configured' }, { status: 503, headers });
    }

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
    });
    if (!userResponse.ok) return Response.json({ error: 'Sign in again before submitting' }, { status: 401, headers });
    const user = await userResponse.json();
    const email = String(user.email || '').trim().toLowerCase();
    const userId = user.id;
    if (!email || !userId) return Response.json({ error: 'User identity is missing' }, { status: 401, headers });

    const staffRows = await supabaseFetch(
      `/rest/v1/rally_allowed_staff?email=eq.${encodeURIComponent(email)}&active=eq.true&pin_role=eq.team_lead&select=name&limit=1`,
      { serviceKey },
    );
    if (!Array.isArray(staffRows) || !staffRows.length) {
      return Response.json({ error: 'Active Team Lead access is required' }, { status: 403, headers });
    }

    const assignments = await supabaseFetch(
      `/rest/v1/rally_team_lead_assignments?report_date=eq.${date}&email=eq.${encodeURIComponent(email)}&select=email&limit=1`,
      { serviceKey },
    );
    if (!Array.isArray(assignments) || !assignments.length) {
      return Response.json({ error: 'A manager must assign you to close before you can submit' }, { status: 403, headers });
    }

    const entries = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`,
      { serviceKey },
    );
    const entry = Array.isArray(entries) ? entries[0] : null;
    if (!entry || !entry.submitted) return Response.json({ error: 'Save and submit the PM report first' }, { status: 409, headers });
    if (entry.email_sent_at) return Response.json({ sent: true, alreadySent: true }, { status: 200, headers });
    const staleLock = encodeURIComponent(new Date(Date.now() - 5 * 60 * 1000).toISOString());
    const lockPath = `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&user_id=eq.${encodeURIComponent(userId)}&email_sent_at=is.null&or=(email_sending_at.is.null,email_sending_at.lt.${staleLock})&select=report_date`;
    const lockRows = await supabaseFetch(lockPath, {
      method: 'PATCH',
      body: { email_sending_at: new Date().toISOString() },
      serviceKey,
    });
    if (!Array.isArray(lockRows) || !lockRows.length) {
      const currentRows = await supabaseFetch(
        `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&user_id=eq.${encodeURIComponent(userId)}&select=email_sent_at&limit=1`,
        { serviceKey },
      );
      if (Array.isArray(currentRows) && currentRows[0]?.email_sent_at) {
        return Response.json({ sent: true, alreadySent: true }, { status: 200, headers });
      }
      return Response.json({ error: 'The shift report email is already being sent. Try again shortly.' }, { status: 409, headers });
    }
    emailLock = { date, userId, serviceKey };

    const allEntries = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&submitted=eq.true&select=shift,email,name,data,checklist,submitted_at`,
      { serviceKey },
    );
    const amEntry = Array.isArray(allEntries) ? allEntries.find(item => item.shift === 'am') : null;
    const pmEntry = Array.isArray(allEntries) ? allEntries.find(item => item.shift === 'pm' && item.email === email) : null;
    if (!pmEntry) throw new Error('The submitted PM entry could not be found');

    const reportRows = await supabaseFetch(
      `/rest/v1/rally_shift_reports?date=eq.${date}&select=id,data&order=id.desc&limit=1`,
      { serviceKey },
    );
    const existing = Array.isArray(reportRows) ? reportRows[0] : null;
    const reportData = existing && existing.data && typeof existing.data === 'object' ? { ...existing.data } : {};
    if (reportData.pm_submitted && !reportData._team_lead_pm) {
      throw new Error('This daily report was already submitted');
    }

    if (amEntry && amEntry.data && typeof amEntry.data === 'object') {
      const mergedAmFields = [];
      for (const [key, value] of Object.entries(amEntry.data)) {
        if (key.startsWith('am_') && (reportData[key] === undefined || reportData[key] === null || reportData[key] === '')) {
          reportData[key] = value;
          mergedAmFields.push(key);
        }
      }
      if (!reportData.am_manager_name) {
        reportData.am_manager_name = amEntry.name;
        mergedAmFields.push('am_manager_name');
      }
      reportData._team_lead_am = { name: amEntry.name, submitted_at: amEntry.submitted_at };
      reportData._team_lead_am_fields = mergedAmFields;
    }
    for (const key of Object.keys(reportData)) {
      if (key.startsWith('pm_') && !['pm_submitted', 'pm_submitted_by', 'pm_submitted_at'].includes(key)) {
        delete reportData[key];
      }
    }
    for (const [key, value] of Object.entries(pmEntry.data || {})) {
      if (key.startsWith('pm_')) reportData[key] = value;
    }
    reportData.pm_manager_name = pmEntry.name;
    reportData._team_lead_pm = { name: pmEntry.name, email: pmEntry.email, submitted_at: pmEntry.submitted_at };
    reportData.team_lead_closing_checklist = { ...(pmEntry.checklist || {}), tl_report_sent: true };
    reportData.pm_submitted = true;
    reportData.pm_submitted_by = pmEntry.name;
    reportData.pm_submitted_at = pmEntry.submitted_at || new Date().toISOString();
    reportData.am_locked = true;
    reportData.am_locked_by = reportData.am_locked_by || (amEntry?.name || 'Team Lead closeout');
    reportData.am_locked_at = reportData.am_locked_at || pmEntry.submitted_at;

    if (existing) {
      await supabaseFetch(`/rest/v1/rally_shift_reports?id=eq.${encodeURIComponent(existing.id)}`, {
        method: 'PATCH', body: { data: reportData }, serviceKey,
      });
    } else {
      await supabaseFetch('/rest/v1/rally_shift_reports', {
        method: 'POST', body: { date, data: reportData }, serviceKey,
      });
    }

    const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: EMAILJS_SERVICE_ID,
        template_id: EMAILJS_TEMPLATE_ID,
        user_id: EMAILJS_PUBLIC_KEY,
        template_params: {
          subject: `Rally Shift Report - ${new Date(`${date}T12:00:00-04:00`).toLocaleDateString('en-US', { weekday: 'long' })}`,
          message: reportHtml(reportData, date),
          to_email: '',
        },
      }),
    });
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Shift report email failed (${emailResponse.status}): ${errorText}`);
    }
    emailAccepted = true;

    const emailMarkRows = await supabaseFetch(
      `/rest/v1/rally_team_lead_entries?report_date=eq.${date}&shift=eq.pm&user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        body: {
          email_sent_at: new Date().toISOString(),
          email_sending_at: null,
          checklist: { ...(entry.checklist || {}), tl_report_sent: true },
        },
        serviceKey,
      },
    );
    if (!Array.isArray(emailMarkRows) || !emailMarkRows.length) {
      throw new Error('Email was sent, but its delivery status could not be saved');
    }
    emailLock = null;
    return Response.json({ sent: true }, { status: 200, headers });
  } catch (error) {
    console.error('Team Lead shift report submission failed', error);
    if (emailLock && !emailAccepted) {
      try {
        await supabaseFetch(
          `/rest/v1/rally_team_lead_entries?report_date=eq.${emailLock.date}&shift=eq.pm&user_id=eq.${encodeURIComponent(emailLock.userId)}&email_sent_at=is.null`,
          { method: 'PATCH', body: { email_sending_at: null }, serviceKey: emailLock.serviceKey },
        );
      } catch (releaseError) {
        console.error('Could not release the Team Lead email lock', releaseError);
      }
    }
    if (emailAccepted) {
      return Response.json({ error: 'The email service accepted the report, but its delivery status could not be saved. Please contact a manager before retrying.' }, { status: 500, headers });
    }
    return Response.json({ error: 'The report could not be sent. Your saved submission is still available to retry.' }, { status: 500, headers });
  }
}
