// Netlify serverless function — PDFShift (HTML->PDF) + Resend (email).
// No Chromium bundling, so manual "drag & drop" deploys work fine.

const { Resend } = require('resend');
const { buildHtmlFromFlat } = require('./lib/pdf-html');

// ---- CONFIG (set as environment variables in Netlify) ----
const PDFSHIFT_API_KEY = process.env.PDFSHIFT_API_KEY;           // from pdfshift.io
const RESEND_API_KEY   = process.env.RESEND_API_KEY;             // from resend.com
const BUSINESS_EMAIL   = process.env.BUSINESS_EMAIL || 'ger3to13@gmail.com';
const FROM_EMAIL       = process.env.FROM_EMAIL || 'Eden Cosmetics <onboarding@resend.dev>';
// set PDFSHIFT_SANDBOX=1 while testing (unlimited free conversions, adds a watermark)
const SANDBOX = process.env.PDFSHIFT_SANDBOX === '1';

// ---- CRM integration ----
const CRM_ENDPOINT = process.env.CRM_ENDPOINT;   // https://your-crm.com/api/intake/anamneza
const CRM_SECRET   = process.env.CRM_SECRET;     // shared secret with the CRM

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function htmlToPdf(html){
  const auth = 'Basic ' + Buffer.from('api:' + PDFSHIFT_API_KEY).toString('base64');
  const resp = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: html, sandbox: SANDBOX, format: 'A4' }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=> '');
    throw new Error('PDFShift ' + resp.status + ': ' + txt);
  }
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}


async function sendToCrm(flat, pdfBase64) {
  if (!CRM_ENDPOINT || !CRM_SECRET) return { ok: false, skipped: true };
  const payload = {
    first_name: flat['\u05e9\u05dd'] || '',
    last_name:  flat['\u05e9\u05dd \u05de\u05e9\u05e4\u05d7\u05d4'] || '',
    phone:      flat['\u05d8\u05dc\u05e4\u05d5\u05df'] || '',
    form_data:  flat,
    pdf_base64: pdfBase64,
  };
  try {
    const resp = await fetch(CRM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Intake-Secret': CRM_SECRET },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(()=> '');
      return { ok: false, error: `CRM ${resp.status}: ${t}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  let flat;
  try { flat = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'invalid JSON' }) }; }

  const mode = flat.__mode || 'email';
  const name  = [flat['שם'], flat['שם משפחה']].filter(Boolean).join(' ').trim() || 'ללא שם';
  const phone = flat['טלפון'] || 'ללא טלפון';
  const date  = flat['תאריך'] || new Date().toISOString().slice(0,10);
  const clientEmail = (flat['מייל של הלקוחה'] || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail);

  // 1) HTML -> PDF via PDFShift
  let pdfBuffer;
  try {
    pdfBuffer = await htmlToPdf(buildHtmlFromFlat(flat));
  } catch (err) {
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'pdf failed', detail: String(err) }) };
  }

  // ---- download mode: return the PDF itself ----
  if (mode === 'pdf') {
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="anamneza.pdf"' },
      body: pdfBuffer.toString('base64'),
      isBase64Encoded: true,
    };
  }

  // 2) email via Resend (business + optional client copy)
  let clientCopy = false;
  try {
    const resend = new Resend(RESEND_API_KEY);
    const b64 = pdfBuffer.toString('base64');
    const filename = `anamneza-${date}.pdf`;

    await resend.emails.send({
      from: FROM_EMAIL, to: BUSINESS_EMAIL,
      subject: `טופס אנמנזה חדש - ${name} - ${phone} - ${date}`,
      html: `<div dir="rtl" style="font-family:Arial">
        <h3>התקבל טופס רישום חדש</h3>
        <p><b>לקוחה:</b> ${name}<br><b>טלפון:</b> ${phone}<br><b>תאריך:</b> ${date}</p>
        <p>הטופס המלא מצורף כקובץ PDF.</p></div>`,
      attachments: [{ filename, content: b64 }],
    });

    if (emailOk) {
      await resend.emails.send({
        from: FROM_EMAIL, to: clientEmail,
        subject: 'EDEN COSMETICS · עותק מטופס הרישום שלך',
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1d1d1f">
          <div style="text-align:center;padding:18px 0;border-bottom:2px solid #8a7355">
            <div style="font-size:24px;font-weight:700;letter-spacing:2px;color:#2b2b2e">EDEN COSMETICS</div>
            <div style="font-size:12px;letter-spacing:3px;color:#8a7355">PERFECT SKIN</div>
          </div>
          <div style="padding:20px 4px">
            <p>שלום ${name},</p>
            <p>תודה שמילאת את טופס הרישום שלנו. מצורף למייל זה עותק מלא של הטופס
               כפי שמילאת, בקובץ PDF, לשמירה אישית.</p>
            <p>אם יש צורך בעדכון פרטים או שאלה כלשהי, נשמח לעמוד לרשותך.</p>
            <p style="margin-top:22px">בברכה,<br><b>צוות EDEN COSMETICS</b></p>
          </div>
          <div style="text-align:center;padding:12px 0;border-top:1px solid #ddd;font-size:11px;color:#888">
            EDEN COSMETICS
          </div>
        </div>`,
        attachments: [{ filename, content: b64 }],
      });
      clientCopy = true;
    }
  } catch (err) {
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'email failed', detail: String(err) }) };
  }

  // 3) forward to CRM (does not block email success if it fails)
  let crmResult = { ok: false };
  try {
    crmResult = await sendToCrm(flat, pdfBuffer.toString('base64'));
  } catch (e) {
    crmResult = { ok: false, error: String(e) };
  }

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, clientCopy, crm: crmResult.ok }) };
};
