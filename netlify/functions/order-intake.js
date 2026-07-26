const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const AIRTABLE_API = 'https://api.airtable.com/v0';
const AIRTABLE_META_API = 'https://api.airtable.com/v0/meta';
const DEFAULT_NOTIFY_TO = 'gekkoclean.air@gmail.com';
const DEFAULT_FROM = 'Gekko Air <info@gekkoair.co.il>';
const DEFAULT_AIRTABLE_BASE_ID = 'appm9KxX1DklkhRUK';
const DEFAULT_AIRTABLE_TABLE_ID = 'tbllePRiqRj9KxRpY';
const DEFAULT_AIRTABLE_VIEW_URL = 'https://airtable.com/appm9KxX1DklkhRUK/tbllePRiqRj9KxRpY/viwMsQwr3gaBX3w7U?blocks=hide';
const PRODUCT_NAME = 'ערכת Gekko Air מבצע ₪199';
const PRODUCT_PRICE = 199;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const clamp = (value = '', max = 1000) => String(value || '').trim().slice(0, max);

function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  const type = event.headers['content-type'] || event.headers['Content-Type'] || '';
  if (type.includes('application/json')) return JSON.parse(raw || '{}');
  return Object.fromEntries(new URLSearchParams(raw));
}

function jsonResponse(statusCode, payload) {
  return { statusCode, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) };
}

function nowInIsraelParts() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const time = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  const display = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'medium' }).format(now);
  return { iso: now.toISOString(), date, time, display };
}

function brandedShell({ title, preheader = '', body, footer = '' }) {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#F7FAF8;font-family:Arial,'Heebo',sans-serif;color:#123D32;direction:rtl;text-align:right">
  <div style="display:none;max-height:0;overflow:hidden;color:transparent">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7FAF8;padding:28px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dfece4;border-radius:24px;overflow:hidden;box-shadow:0 16px 44px rgba(18,61,50,.08)">
        <tr><td style="background:#123D32;padding:24px 28px;color:#B7F14A">
          <div style="font-size:12px;letter-spacing:.14em;font-weight:800;text-transform:uppercase">GEKKO AIR</div>
          <h1 style="margin:8px 0 0;font-size:28px;line-height:1.25;color:#fff">${escapeHtml(title)}</h1>
        </td></tr>
        <tr><td style="padding:28px">${body}</td></tr>
        <tr><td style="padding:18px 28px;background:#F0F7F2;color:#5a6963;font-size:13px;line-height:1.6">${footer || 'Gekko Air · עדכון אוטומטי מתהליך הצ׳קאאוט באתר.'}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #d9e7df;border-radius:14px;overflow:hidden">
    ${rows.map(([label, value]) => `<tr><td style="padding:12px 14px;background:#F7FAF8;border-bottom:1px solid #d9e7df;font-weight:800;color:#123D32;width:34%">${escapeHtml(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #d9e7df;color:#1F2524">${escapeHtml(value || 'לא נמסר')}</td></tr>`).join('')}
  </table>`;
}

function internalOrderHtml({ name, phone, email, product, requestId, israelTime, airtableUrl }) {
  return brandedShell({
    title: 'לקוח סיים חלק 1 בצ׳קאאוט',
    preheader: `${name} השאיר/ה פרטים לרכישת ערכת Gekko Air`,
    body: `
      <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#3d4a45">לקוח השלים את שלב הפרטים. צריך לחזור אליו ולהשלים תשלום/משלוח.</p>
      ${detailsTable([
        ['מספר ליד', requestId],
        ['שם מלא', name],
        ['טלפון', phone],
        ['אימייל', email],
        ['מוצר', product],
        ['מחיר', `₪${PRODUCT_PRICE}`],
        ['שעה', israelTime.display],
      ])}
      ${airtableUrl ? `<div style="text-align:center;margin:26px 0 0"><a href="${escapeHtml(airtableUrl)}" style="display:inline-block;background:#123D32;color:#B7F14A;text-decoration:none;padding:13px 24px;border-radius:999px;font-weight:900">פתיחה ב-Airtable</a></div>` : ''}
    `,
    footer: 'הפרטים נשמרו ב-Airtable ונשלחו למייל התפעולי.',
  });
}

async function sendEmail(apiKey, payload) {
  const resend = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await resend.text();
  if (!resend.ok) {
    const err = new Error(`Resend failed with ${resend.status}`);
    err.status = resend.status;
    err.resultText = text;
    throw err;
  }
  return text;
}

function airtableToken() {
  return process.env.AIRTABLE_ACCESS_TOKEN || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY || '';
}

async function airtableFetch(url, options = {}) {
  const token = airtableToken();
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (_) {}
  if (!res.ok) {
    const err = new Error(`Airtable failed with ${res.status}`);
    err.status = res.status;
    err.body = json || text;
    throw err;
  }
  return json;
}

async function getTableSchema(baseId, tableId) {
  try {
    const schema = await airtableFetch(`${AIRTABLE_META_API}/bases/${baseId}/tables`);
    return (schema.tables || []).find((table) => table.id === tableId) || null;
  } catch (err) {
    console.warn('Airtable schema lookup skipped/failed', { status: err.status, body: err.body });
    return null;
  }
}

async function ensureField(baseId, tableId, table, desiredName, type) {
  const exists = (table.fields || []).find((field) => field.name === desiredName);
  if (exists) return exists.name;
  if (process.env.AIRTABLE_AUTO_CREATE_FIELDS === 'false') return desiredName;
  try {
    const created = await airtableFetch(`${AIRTABLE_META_API}/bases/${baseId}/tables/${tableId}/fields`, {
      method: 'POST',
      body: JSON.stringify({ name: desiredName, type }),
    });
    table.fields.push(created);
    return created.name;
  } catch (err) {
    console.warn('Airtable field create failed; will try record create with configured name', { desiredName, status: err.status, body: err.body });
    return desiredName;
  }
}

async function buildAirtableFields({ baseId, tableId, name, phone, email, product, requestId, israelTime, source }) {
  const table = await getTableSchema(baseId, tableId);
  const desired = [
    ['שם מלא', 'singleLineText', name],
    ['טלפון', 'singleLineText', phone],
    ['אימייל', 'singleLineText', email],
    ['מוצר', 'singleLineText', product],
    ['מחיר', 'number', PRODUCT_PRICE],
    ['שעה', 'singleLineText', israelTime.display],
    ['תאריך יצירה', 'singleLineText', israelTime.iso],
    ['מקור', 'singleLineText', source],
    ['סטטוס', 'singleLineText', 'סיים חלק 1 - לחזור ללקוח'],
    ['מספר ליד', 'singleLineText', requestId],
  ];

  if (!table) {
    return Object.fromEntries(desired.map(([fieldName, _type, value]) => [fieldName, value]));
  }

  const fields = {};
  for (const [fieldName, type, value] of desired) {
    const actualName = await ensureField(baseId, tableId, table, fieldName, type);
    fields[actualName] = value;
  }
  return fields;
}

async function createAirtableRecord({ name, phone, email, product, requestId, israelTime, source }) {
  const baseId = process.env.AIRTABLE_BASE_ID || DEFAULT_AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID || DEFAULT_AIRTABLE_TABLE_ID;
  if (!airtableToken()) throw new Error('Missing AIRTABLE_ACCESS_TOKEN / AIRTABLE_TOKEN / AIRTABLE_API_KEY');

  const fields = await buildAirtableFields({ baseId, tableId, name, phone, email, product, requestId, israelTime, source });
  const created = await airtableFetch(`${AIRTABLE_API}/${baseId}/${tableId}`, {
    method: 'POST',
    body: JSON.stringify({ records: [{ fields }], typecast: true }),
  });
  const recordId = created.records && created.records[0] && created.records[0].id;
  return {
    recordId,
    url: process.env.AIRTABLE_VIEW_URL || DEFAULT_AIRTABLE_VIEW_URL,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { ok: false, message: 'רק POST נתמך.' });

  let data;
  try {
    data = parseBody(event);
  } catch (_) {
    return jsonResponse(400, { ok: false, message: 'הפרטים לא נקלטו. נסו שוב.' });
  }

  if (clamp(data.company, 120)) return jsonResponse(200, { ok: true, message: 'הפרטים נקלטו.' });

  const name = clamp(data.name, 80);
  const phone = clamp(data.phone, 30);
  const email = clamp(data.email, 120);
  const product = clamp(data.product, 120) || PRODUCT_NAME;
  const requestId = `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const israelTime = nowInIsraelParts();
  const source = clamp(data.source, 120) || 'checkout-step-1';

  if (!name || !phone || !email) {
    return jsonResponse(400, { ok: false, message: 'חסרים שם, טלפון או אימייל.' });
  }

  let airtable;
  try {
    airtable = await createAirtableRecord({ name, phone, email, product, requestId, israelTime, source });
  } catch (err) {
    console.error('Airtable order create failed', { requestId, status: err.status, body: err.body || err.message });
    return jsonResponse(502, { ok: false, message: 'לא הצלחנו לשמור את הפרטים. נסו שוב בעוד רגע.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const notifyTo = (process.env.ORDER_NOTIFY_TO || process.env.RESEND_NOTIFY_TO || DEFAULT_NOTIFY_TO).split(',').map((x) => x.trim()).filter(Boolean);
  const replyTo = email || process.env.RESEND_REPLY_TO || 'info@gekkoair.co.il';

  if (!apiKey) {
    console.warn('Gekko order saved without email because RESEND_API_KEY is missing', { requestId, airtableRecordId: airtable.recordId });
    return jsonResponse(200, { ok: true, message: 'הפרטים נשמרו. נחזור אליך בקרוב.', requestId, airtableRecordId: airtable.recordId });
  }

  try {
    await sendEmail(apiKey, {
      from,
      to: notifyTo,
      subject: `לקוח סיים חלק 1 בצ׳קאאוט · ${name} · ${requestId}`,
      html: internalOrderHtml({ name, phone, email, product, requestId, israelTime, airtableUrl: airtable.url }),
      text: `לקוח סיים חלק 1 בצ׳קאאוט\nמספר ליד: ${requestId}\nשם: ${name}\nטלפון: ${phone}\nאימייל: ${email}\nמוצר: ${product}\nמחיר: ₪${PRODUCT_PRICE}\nשעה: ${israelTime.display}\nAirtable: ${airtable.url}`,
      reply_to: replyTo,
    });
  } catch (err) {
    console.error('Order notification email failed after Airtable save', { requestId, status: err.status, resultText: String(err.resultText || '').slice(0, 500), airtableRecordId: airtable.recordId });
    return jsonResponse(200, { ok: true, message: 'הפרטים נשמרו. נחזור אליך בקרוב.', requestId, airtableRecordId: airtable.recordId, emailWarning: true });
  }

  console.log('Gekko order intake saved and notified', { requestId, airtableRecordId: airtable.recordId, notifyTo });
  return jsonResponse(200, { ok: true, message: 'הפרטים נשמרו. נחזור אליך בקרוב.', requestId, airtableRecordId: airtable.recordId });
};
