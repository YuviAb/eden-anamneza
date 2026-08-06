// Builds a print-ready HTML document from a FLAT form object (name -> value).
// The browser renders this to PDF with perfect Hebrew RTL.

function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Field groupings: each section lists the field names (as they appear in the
// form's `name=` attributes) that belong to it.
const SECTIONS = [
  { title:'מצב בריאות כללי', fields:['פעילות גופנית','עישון','וסת סדיר','הריון/הנקה','תוספי תזונה כללי','שתיית אלכוהול','שתיית קפאין'] },
  { title:'רגישות ואלרגיות', fields:['אלרגיה','אלרגיה אחר','השתלת מתכת'] },
  { title:'מחלות רקע', fields:['מחלות רקע','צהבת פירוט','תרופות 3 חודשים אחרונים','תרופות 3 חודשים פירוט'] },
  { title:'מחלות עור', fields:['מחלות עור','פצעים דלקתיים','פצעים דלקתיים פירוט','נכווה מחשיפה לשמש','נכווה מחשיפה פירוט','שיזוף נתפס בקלות','שיזוף פירוט'] },
  { title:'תמרוקים וטיפולים אסתטיים', fields:['תמרוקים','תמרוקים אחר','פילינג ביתי','רטין A','איפור קבוע','פרוצדורות כירורגיות','פרוצדורות פירוט'] },
  { title:'נטילת תרופות', fields:['תרופות','מניעת הריון פירוט','נוגדי דכאון פירוט','נוגדי קרישה פירוט','אנטיביוטיקה פירוט','סטרואידים פירוט','רואקוטן פירוט','תוספי תזונה פירוט','תרופות אחרות'] },
  { title:'מטרת הטיפול', fields:['מטרת הטיפול'] },
  { title:'הצהרת בריאות - חתימה', fields:['הצהרה תאריך','הצהרה שם מלא','הצהרה חתימה'] },
  { title:'אישורי שיווק ופרסום', fields:['אישור פרסום תמונות','אישור SMS','שיווק תאריך','שיווק שם מלא','שיווק חתימה'] },
  { title:'נגעים בעור (אבחון קוסמטיקאי/ת)', fields:['נגעים קומודונים','נגעים קופרוז','נגעים קשקשת','נגעים צלקות','נגעים אקנה','נגעים פיגמנטציה','נגעים חשודים'] },
  { title:'מצב העור הכללי', fields:['מצב עור כללי','פיצפטריק','טורגור','טונוס','נקבוביות'] },
  { title:'אבחון כללי', fields:['אבחון כללי'] },
  { title:'תכנית טיפול', fields:['תכנית טיפול'] },
  { title:'חומרי טיפול ביתיים', fields:['חומרי טיפול ביתיים'] },
];

const HEADER_FIELDS = ['שם','שם משפחה','תאריך','תאריך לידה','כתובת','טלפון','מייל של הלקוחה','משקל','גובה'];

function buildHtmlFromFlat(flat){
  flat = flat || {};

  const header = {
    name: flat['שם'], last: flat['שם משפחה'], phone: flat['טלפון'],
    date: flat['תאריך'], birth: flat['תאריך לידה'], email: flat['מייל של הלקוחה'],
    address: flat['כתובת'], weight: flat['משקל'], height: flat['גובה'],
  };

  const headerCells = [
    ['שם', [header.name, header.last].filter(Boolean).join(' ')],
    ['טלפון', header.phone], ['תאריך', header.date], ['ת.לידה', header.birth],
    ['מייל', header.email], ['כתובת', header.address],
    ['משקל', header.weight], ['גובה', header.height],
  ].filter(([,v])=> v && String(v).trim())
   .map(([l,v])=>`<div class="hcell"><span class="hl">${esc(l)}:</span> <span class="hv">${esc(v)}</span></div>`)
   .join('');

  // treatment log (rows 1..10)
  const logRows = [];
  for(let i=1;i<=10;i++){
    const when = flat['מועד טיפול '+i];
    const desc = flat['סוג ותיאור טיפול '+i];
    if((when&&when.trim())||(desc&&desc.trim())){
      logRows.push([`טיפול ${i}`, [when,desc].filter(Boolean).join(' — ')]);
    }
  }

  const sectionsHtml = SECTIONS.map(sec=>{
    const rows = sec.fields
      .filter(f => flat[f] && String(flat[f]).trim())
      .map(f => {
        // free-text fields (single value, long) shown full-width
        const val = flat[f];
        return `<tr><td class="lbl">${esc(f)}</td><td class="val">${esc(val)}</td></tr>`;
      }).join('');
    if(!rows) return '';
    return `<section><h2>${esc(sec.title)}</h2><table>${rows}</table></section>`;
  }).join('');

  const logHtml = logRows.length
    ? `<section><h2>יומן טיפולים</h2><table>${
        logRows.map(([l,v])=>`<tr><td class="lbl">${esc(l)}</td><td class="val">${esc(v)}</td></tr>`).join('')
      }</table></section>`
    : '';

  return `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size:A4; margin:14mm 12mm; }
  *{box-sizing:border-box;}
  body{font-family:"Noto Sans Hebrew","Arial Hebrew",Arial,sans-serif;color:#1d1d1f;margin:0;font-size:12px;line-height:1.5;}
  .brand{text-align:center;margin-bottom:10px;}
  .brand h1{font-size:26px;margin:0;font-weight:700;letter-spacing:1px;}
  .brand .tag{font-size:11px;letter-spacing:4px;color:#6b6b6f;border-top:1px solid #ccc;border-bottom:1px solid #ccc;display:inline-block;padding:2px 12px;margin-top:3px;}
  .doctitle{text-align:center;font-size:16px;font-weight:700;margin:6px 0 14px;}
  .header{display:flex;flex-wrap:wrap;gap:6px 20px;border:1px solid #bbb;border-radius:5px;padding:10px 12px;margin-bottom:16px;}
  .hcell{font-size:12px;} .hl{color:#555;} .hv{font-weight:600;}
  section{margin-bottom:12px;break-inside:avoid;}
  h2{font-size:14px;font-weight:700;margin:0 0 4px;border-bottom:2px solid #8a7355;padding-bottom:2px;color:#2b2b2e;}
  table{width:100%;border-collapse:collapse;}
  td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;}
  td.lbl{font-weight:600;width:38%;color:#333;}
  td.val{color:#111;}
  footer{margin-top:18px;padding-top:8px;border-top:1px solid #333;text-align:center;font-size:10px;color:#333;}
</style></head><body>
  <div class="brand"><h1>EDEN COSMETICS</h1><div class="tag">Perfect Skin</div></div>
  <div class="doctitle">כרטיס רישום למטופל - הצהרת בריאות</div>
  <div class="header">${headerCells || '<div class="hcell">—</div>'}</div>
  ${sectionsHtml}
  ${logHtml}
  <footer>EDEN COSMETICS</footer></body></html>`;
}

module.exports = { buildHtmlFromFlat };
