const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SITE_URL = process.env.SITE_URL || process.env.URL || 'https://gekkoair.co.il';
const DEFAULT_NOTIFY_TO = 'gekkoclean.air@gmail.com';
const DEFAULT_FROM = 'Gekko Air <info@gekkoair.co.il>';

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

function response(statusCode, body, headers = {}) {
  return { statusCode, headers: { 'Content-Type': 'text/html; charset=utf-8', ...headers }, body };
}

function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
    body: JSON.stringify(payload),
  };
}

function wantsJson(event) {
  const accept = event.headers.accept || event.headers.Accept || '';
  const requestedWith = event.headers['x-requested-with'] || event.headers['X-Requested-With'] || '';
  return accept.includes('application/json') || requestedWith === 'fetch';
}

function contactResponse(event, statusCode, payload, html) {
  if (wantsJson(event)) return jsonResponse(statusCode, payload);
  return response(statusCode, html);
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
        <tr><td style="padding:18px 28px;background:#F0F7F2;color:#5a6963;font-size:13px;line-height:1.6">${footer || 'Gekko Air · ערכה ביתית לניקוי וחיטוי מזגנים · מייל זה נשלח בעקבות פנייה באתר.'}</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function detailsTable(rows) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #d9e7df;border-radius:14px;overflow:hidden">
    ${rows.map(([label, value]) => `<tr><td style="padding:12px 14px;background:#F7FAF8;border-bottom:1px solid #d9e7df;font-weight:800;color:#123D32;width:34%">${escapeHtml(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #d9e7df;color:#1F2524">${String(value || '').includes('<br>') ? value : escapeHtml(value || 'לא נמסר')}</td></tr>`).join('')}
  </table>`;
}

function customerEmailHtml({ name, requestId }) {
  const checkoutUrl = `${SITE_URL.replace(/\/$/, '')}/checkout/`;
  return brandedShell({
    title: 'קיבלנו את הפנייה שלך',
    preheader: 'תודה שפנית ל-Gekko Air — נחזור אליך בהקדם, ובינתיים אפשר לרכוש את הערכה ישירות.',
    body: `
      <p style="margin:0 0 14px;font-size:17px;line-height:1.8">היי ${escapeHtml(name)},</p>
      <p style="margin:0 0 18px;font-size:16px;line-height:1.8;color:#3d4a45">קיבלנו את ההודעה שלך ונחזור אליך בהקדם עם תשובה מסודרת. אם המטרה היא להתחיל לנקות את המזגן כבר עכשיו — אפשר להתקדם לרכישת הערכה כאן.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:#123D32;color:#B7F14A;text-decoration:none;padding:15px 30px;border-radius:999px;font-weight:900;font-size:16px">לרכישת ערכת Gekko Air · ₪199</a>
      </div>
      <div style="background:#F0F7F2;border:1px solid #d9e7df;border-radius:16px;padding:16px;margin:0 0 18px">
        <strong style="display:block;margin-bottom:6px">מה יש בערכה?</strong>
        <span style="color:#3d4a45">חומר ניקוי אקולוגי, מרסס, מברשות, שרוול ניקוז והדרכת וידאו — הכל לניקוי מזגן ביתי בצורה נקייה ופשוטה.</span>
      </div>
      <p style="margin:0;color:#5a6963;font-size:13px">מספר פנייה: ${escapeHtml(requestId)}</p>
    `,
    footer: 'אם לא שלחת פנייה באתר Gekko Air, אפשר להתעלם מהמייל הזה. אין כאן חיוב או התחייבות.',
  });
}

function internalEmailHtml({ name, phone, email, message, requestId }) {
  return brandedShell({
    title: 'פנייה חדשה מטופס צור קשר',
    preheader: `${name} השאיר/ה פנייה באתר Gekko Air`,
    body: `
      <p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#3d4a45">נכנסה פנייה חדשה מהאתר. לחזור ללקוח בהקדם.</p>
      ${detailsTable([
        ['מספר פנייה', requestId],
        ['שם', name],
        ['טלפון', phone],
        ['אימייל', email || 'לא נמסר'],
        ['הודעה', escapeHtml(message).replaceAll('\n', '<br>')],
      ])}
    `,
    footer: `נשלח מטופס צור קשר באתר · Reply-To: ${escapeHtml(email || process.env.RESEND_REPLY_TO || 'info@gekkoair.co.il')}`,
  });
}

async function sendEmail(apiKey, payload) {
  const resend = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const resultText = await resend.text();
  if (!resend.ok) {
    const err = new Error(`Resend failed with ${resend.status}`);
    err.status = resend.status;
    err.resultText = resultText;
    throw err;
  }
  return resultText;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, '<!doctype html><meta charset="utf-8"><body dir="rtl">רק שליחת טופס נתמכת.</body>');
  }

  let data;
  try {
    data = parseBody(event);
  } catch (_) {
    return contactResponse(event, 400, { ok: false, message: 'הטופס לא נקלט. נסו שוב.' }, '<!doctype html><meta charset="utf-8"><body dir="rtl">הטופס לא נקלט. נסו שוב.</body>');
  }

  if (clamp(data.company, 120)) {
    return contactResponse(event, 200, { ok: true, message: 'ההודעה נשלחה בהצלחה!' }, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>ההודעה נשלחה בהצלחה!</h1></body>');
  }

  const name = clamp(data.name, 80);
  const phone = clamp(data.phone, 30);
  const email = clamp(data.email, 120);
  const message = clamp(data.message, 1200);
  const requestId = `gekko-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!name || !phone || !message) {
    return contactResponse(event, 400, { ok: false, message: 'חסרים שם, טלפון או הודעה. נסו שוב.' }, '<!doctype html><meta charset="utf-8"><body dir="rtl">חסרים שם, טלפון או הודעה. חזרו לטופס ונסו שוב.</body>');
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  const notifyTo = (process.env.RESEND_NOTIFY_TO || DEFAULT_NOTIFY_TO).split(',').map((x) => x.trim()).filter(Boolean);
  const replyTo = email || process.env.RESEND_REPLY_TO || 'info@gekkoair.co.il';

  if (!apiKey) {
    console.error('Gekko contact missing RESEND_API_KEY', { requestId, name, phone });
    return contactResponse(event, 503, { ok: false, message: 'השליחה עדיין לא פעילה. כתבו לנו ישירות ל־info@gekkoair.co.il.' }, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>השליחה עדיין לא פעילה</h1><p>אנא כתבו לנו ישירות ל־info@gekkoair.co.il.</p></body>');
  }

  const emails = [{
    from,
    to: notifyTo,
    subject: `פנייה חדשה מגקו אייר · ${name} · ${requestId}`,
    html: internalEmailHtml({ name, phone, email, message, requestId }),
    text: `פנייה חדשה מ-Gekko Air\nמספר: ${requestId}\nשם: ${name}\nטלפון: ${phone}\nאימייל: ${email || 'לא נמסר'}\n\n${message}`,
    reply_to: replyTo,
  }];

  if (email) {
    emails.push({
      from,
      to: [email],
      subject: 'קיבלנו את הפנייה שלך ל-Gekko Air 🦎',
      html: customerEmailHtml({ name, requestId }),
      text: `היי ${name},\nקיבלנו את הפנייה שלך ל-Gekko Air ונחזור אליך בהקדם.\nלרכישת הערכה: ${SITE_URL.replace(/\/$/, '')}/checkout/\nמספר פנייה: ${requestId}`,
      reply_to: process.env.RESEND_REPLY_TO || 'info@gekkoair.co.il',
    });
  }

  try {
    await Promise.all(emails.map((payload) => sendEmail(apiKey, payload)));
  } catch (err) {
    console.error('Resend send failed', { requestId, status: err.status, resultText: String(err.resultText || '').slice(0, 500) });
    return contactResponse(event, 502, { ok: false, message: 'השליחה נכשלה. כתבו לנו ישירות ל־info@gekkoair.co.il.' }, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>השליחה נכשלה</h1><p>אנא כתבו לנו ישירות ל־info@gekkoair.co.il.</p></body>');
  }

  console.log('Gekko contact sent', { requestId, notifyTo, customerCopy: Boolean(email) });
  return contactResponse(event, 200, { ok: true, message: 'קיבלנו את ההודעה ושלחנו לך אישור במייל.', requestId }, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>ההודעה נשלחה בהצלחה!</h1><p>נחזור אליכם בהקדם.</p></body>');
};
