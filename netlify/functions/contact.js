const RESEND_ENDPOINT = 'https://api.resend.com/emails';

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return response(405, '<!doctype html><meta charset="utf-8"><body dir="rtl">רק שליחת טופס נתמכת.</body>');
  }

  let data;
  try {
    data = parseBody(event);
  } catch (_) {
    return response(400, '<!doctype html><meta charset="utf-8"><body dir="rtl">הטופס לא נקלט. נסו שוב.</body>');
  }

  if (clamp(data.company, 120)) {
    return response(303, '', { Location: '/thank-you/' });
  }

  const name = clamp(data.name, 80);
  const phone = clamp(data.phone, 30);
  const email = clamp(data.email, 120);
  const message = clamp(data.message, 1200);
  const requestId = `gekko-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  if (!name || !phone || !message) {
    return response(400, '<!doctype html><meta charset="utf-8"><body dir="rtl">חסרים שם, טלפון או הודעה. חזרו לטופס ונסו שוב.</body>');
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || 'Gekko Air <info@gekkoair.co.il>';
  const notifyTo = (process.env.RESEND_NOTIFY_TO || 'ariktulcha@gmail.com').split(',').map((x) => x.trim()).filter(Boolean);
  const replyTo = email || process.env.RESEND_REPLY_TO || 'info@gekkoair.co.il';

  if (!apiKey) {
    console.error('Gekko contact missing RESEND_API_KEY', { requestId, name, phone });
    return response(503, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>השליחה עדיין לא פעילה</h1><p>אנא כתבו לנו ישירות ל־info@gekkoair.co.il.</p></body>');
  }

  const html = `
  <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.6;color:#123D32">
    <h2>פנייה חדשה מ־Gekko Air</h2>
    <p><strong>מספר פנייה:</strong> ${escapeHtml(requestId)}</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse:collapse;border:1px solid #d9e7df">
      <tr><td><strong>שם</strong></td><td>${escapeHtml(name)}</td></tr>
      <tr><td><strong>טלפון</strong></td><td>${escapeHtml(phone)}</td></tr>
      <tr><td><strong>אימייל</strong></td><td>${escapeHtml(email || 'לא נמסר')}</td></tr>
      <tr><td><strong>הודעה</strong></td><td>${escapeHtml(message).replaceAll('\n', '<br>')}</td></tr>
    </table>
    <p style="color:#5a6963">נשלח מטופס צור קשר באתר. From: info@gekkoair.co.il · Reply-To: ${escapeHtml(replyTo)}</p>
  </div>`;

  const payload = {
    from,
    to: notifyTo,
    subject: `פנייה חדשה מ־Gekko Air · ${name} · ${requestId}`,
    html,
    text: `פנייה חדשה מ-Gekko Air\nמספר: ${requestId}\nשם: ${name}\nטלפון: ${phone}\nאימייל: ${email || 'לא נמסר'}\n\n${message}`,
    reply_to: replyTo,
  };

  const resend = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const resultText = await resend.text();
  if (!resend.ok) {
    console.error('Resend send failed', { requestId, status: resend.status, resultText: resultText.slice(0, 500) });
    return response(502, '<!doctype html><meta charset="utf-8"><body dir="rtl"><h1>השליחה נכשלה</h1><p>אנא כתבו לנו ישירות ל־info@gekkoair.co.il.</p></body>');
  }

  console.log('Gekko contact sent', { requestId, status: resend.status });
  return response(303, '', { Location: `/thank-you/?r=${encodeURIComponent(requestId)}` });
};
