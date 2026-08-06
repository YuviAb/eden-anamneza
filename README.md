# עדן קוסמטיקה — טופס אנמנזה (פריסה דרך GitHub → Netlify)

## מבנה
- public/index.html — הטופס
- netlify/functions/submit.js — הפונקציה (PDFShift + Resend)
- netlify/functions/pdf-html.js — עיצוב ה-PDF
- netlify.toml, package.json — הגדרות

## פריסה
1. העלה את כל הקבצים לריפו GitHub.
2. ב-Netlify: Add new site → Import from Git → בחר את הריפו.
3. Netlify יזהה את netlify.toml אוטומטית. לחץ Deploy.
4. ודא משתני סביבה (Site configuration → Environment variables):
   PDFSHIFT_API_KEY, PDFSHIFT_SANDBOX=1, RESEND_API_KEY, BUSINESS_EMAIL, FROM_EMAIL
5. אחרי הוספת משתנים: Trigger deploy.
