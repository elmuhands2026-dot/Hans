# مشروع Hans Login — GitHub Pages + Cloudflare Worker + Google Apps Script + Google Sheets

هذا المشروع يفصل الواجهة عن الخادم:
- GitHub Pages: يستضيف `index.html` و`style.css` و`script.js`.
- Cloudflare Worker: وسيط API ويضيف CORS للواجهة، ويحفظ السر المشترك في Secrets.
- Google Apps Script: يتحقق من بيانات الدخول ويتعامل مع Google Sheets.
- Google Sheets: يخزن أسماء المستخدمين وملح كلمة المرور وHash وحالة الحساب.

## محتويات المجلد

- `index.html` — صفحة تسجيل الدخول.
- `style.css` — التصميم المتجاوب.
- `script.js` — JavaScript للواجهة والاتصال بالـ Worker.
- `Code.gs` — كود Google Apps Script.
- `worker.js` — كود Cloudflare Worker.
- `images/hans.jpg` — ضع صورة المطبخ هنا (الصورة الأصلية لم تكن ضمن الملفات المرفقة).

---

# المرحلة 1: إعداد Google Sheets

1. أنشئ Google Sheet جديدًا.
2. انسخ Spreadsheet ID من الرابط:
   `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. احتفظ بالـ ID؛ سنضيفه إلى Script Properties في Apps Script.
4. لا تشارك الشيت مع المستخدمين. اتركه تحت حساب مالك النظام.

سيتم إنشاء ورقة `Users` تلقائيًا بالأعمدة:

`username | salt | passwordHash | active | createdAt`

قيمة `active` يجب أن تكون TRUE لتسمح بتسجيل الدخول.

# المرحلة 2: إعداد Google Apps Script

1. افتح https://script.google.com واختَر New project.
2. الصق `Code.gs` في ملف `Code.gs`.
3. من Project Settings > Script Properties أضف:
   - Property: `SPREADSHEET_ID`
   - Value: رقم Google Sheet ID
4. أنشئ سرًا عشوائيًا طويلًا (32 بايت على الأقل)، مثل قيمة ناتجة عن مدير كلمات مرور. لا تستخدم المثال أو كلمة سهلة.
5. أضف Script Property ثانية:
   - Property: `WORKER_SECRET`
   - Value: السر العشوائي الذي أنشأته
6. شغّل `setupUsersSheet` مرة واحدة من قائمة الدوال ووافق على الصلاحيات.
7. غيّر اسم المستخدم وكلمة المرور المؤقتة داخل `createInitialAdmin` ثم شغّلها مرة واحدة.
8. بعد نجاح إنشاء الحساب، احذف كلمة المرور المؤقتة من الكود واحفظ المشروع.
9. Deploy > New deployment > Select type > Web app:
   - Execute as: Me
   - Who has access: Anyone
10. انسخ رابط Web App الذي ينتهي بـ `/exec`.

مهم: اختيار Anyone مطلوب حتى يستطيع Cloudflare Worker استدعاء Web App دون تسجيل دخول Google. لا تضع رابط Apps Script أو WORKER_SECRET في كود الواجهة. السر المشترك موجود فقط في Script Properties وCloudflare Worker Secrets.

# المرحلة 3: إعداد Cloudflare Worker

1. افتح https://dash.cloudflare.com ثم Workers & Pages.
2. أنشئ Worker جديدًا.
3. الصق محتوى `worker.js` وانشره.
4. من Worker > Settings > Variables and Secrets أضف القيم التالية:
   - `GAS_URL` = رابط Apps Script المنشور المنتهي بـ `/exec`
   - `GAS_SHARED_SECRET` = نفس قيمة `WORKER_SECRET` التي وضعتها في Apps Script
   - `ALLOWED_ORIGIN` = أصل موقع GitHub Pages فقط، مثل:
     `https://YOUR-GITHUB-USERNAME.github.io`
5. احفظ/انشر التغييرات.
6. انسخ رابط Worker، مثل:
   `https://hans-login-api.YOUR-SUBDOMAIN.workers.dev`

لا تضع `GAS_SHARED_SECRET` في أي ملف داخل GitHub.

# المرحلة 4: ربط الواجهة بالـ Worker

افتح `script.js` وعدّل أول سطر إعداد:

`const API_URL = "https://YOUR-WORKER-NAME.YOUR-SUBDOMAIN.workers.dev";`

ضع رابط Worker الحقيقي. هذا الرابط ليس سرًا.

# المرحلة 5: رفع الموقع إلى GitHub Pages

1. أنشئ GitHub repository، مثل `hans-login`.
2. ارفع الملفات والمجلد `images`.
3. افتح Repository > Settings > Pages.
4. من Build and deployment اختر Deploy from a branch.
5. اختر `main` و`/ (root)` ثم Save.
6. انتظر نشر الموقع وافتح رابط GitHub Pages.
7. إذا كان المستودع مشروعًا وليس مستودع المستخدم الرئيسي، قد يكون الرابط:
   `https://YOUR-GITHUB-USERNAME.github.io/hans-login/`
8. في هذه الحالة قيمة `ALLOWED_ORIGIN` تظل:
   `https://YOUR-GITHUB-USERNAME.github.io`
   (الأصل لا يتضمن مسار المستودع).

بعد معرفة رابط GitHub Pages الفعلي، ضعه في `ALLOWED_ORIGIN` ثم أعد نشر Worker.

# المرحلة 6: اختبار تسجيل الدخول

1. افتح رابط GitHub Pages.
2. استخدم حساب admin الذي أنشأته في Apps Script.
3. جرّب كلمة مرور خاطئة؛ يجب أن تظهر رسالة خطأ.
4. جرّب البيانات الصحيحة؛ يجب أن تظهر رسالة نجاح ويتخزن Session Token في المتصفح.

## إضافة مستخدم جديد

من محرر Apps Script، استخدم دالة `createUser_` يدويًا. مثال داخل دالة مؤقتة:

`function addStaffExample() { createUser_("staff01", "Use-A-Long-Unique-Password!", true); }`

شغّل الدالة مرة واحدة ثم احذف دالة المثال أو اتركها بعد إزالة كلمة المرور. لا تضف كلمة مرور صريحة في ملفات GitHub.

لتعطيل حساب، غيّر قيمة `active` إلى FALSE في صف المستخدم داخل Google Sheet.

---

# ملاحظات أمنية مهمة قبل الاستخدام الفعلي

1. هذا مشروع بداية عملي، وليس نظام هوية مؤسسيًا جاهزًا لتطبيقات حساسة.
2. SHA-256 مع Salt أفضل من تخزين كلمة المرور صريحة، لكنه ليس Password KDF بطيئًا مثل Argon2id أو bcrypt أو PBKDF2. لتطبيق إنتاجي مهم استخدم مزود هوية متخصصًا أو خادمًا يدعم KDF قويًا.
3. CacheService مؤقت وقد يحذف الجلسات قبل موعدها؛ لا تعتبره مخزن جلسات دائمًا.
4. يجب أن تتحقق كل صفحة/وظيفة محمية من الجلسة في الخادم. إخفاء صفحة Dashboard في المتصفح ليس حماية.
5. أضف حماية من محاولات التخمين (rate limiting) ومراقبة السجلات قبل نشره لمستخدمين حقيقيين. يمكن استخدام Cloudflare Rate Limiting أو Durable Objects/KV وفق الخطة.
6. لا تضع كلمات مرور حقيقية أو أسرارًا في GitHub. إذا تم نشر سر بالخطأ، غيّره فورًا في Apps Script وCloudflare.
7. خيار `Anyone` في نشر Apps Script يجعل endpoint متاحًا على الإنترنت؛ الحماية هنا تعتمد على السر المشترك الذي يضيفه Worker، وقصر CORS على موقعك. CORS وحده ليس نظام مصادقة.
8. زر "نسيت كلمة المرور" في هذه النسخة يعرض تعليمات التواصل مع المسؤول فقط. لا يوجد تدفق إعادة تعيين آلي بعد.
9. زر Google OAuth غير موجود في هذه النسخة.
10. الصفحة لا تحتوي على Dashboard حتى الآن؛ عند إنشائها أضف API endpoints محمية وتحقق من Session Token على الخادم لكل طلب بيانات.

## استكشاف الأخطاء

- `لم يتم ضبط رابط Cloudflare Worker`: عدّل `API_URL` في `script.js`.
- `Origin not allowed`: قيمة `ALLOWED_ORIGIN` يجب أن تطابق أصل GitHub Pages تمامًا، مع `https://` ومن دون مسار أو `/` أخيرة.
- `Worker configuration is incomplete`: راجع متغيرات Worker الثلاثة.
- `تعذر تنفيذ الطلب`: راجع Script Properties، نشر Apps Script، وصلاحية الوصول.
- فشل التحقق دائمًا: راجع `active = TRUE`، واسم المستخدم، وكلمة المرور، وتأكد من إنشاء الحساب بواسطة `createInitialAdmin`.
- بعد تعديل `Code.gs`، أنشئ إصدارًا جديدًا من Apps Script Deployment إذا لم يكن النشر مضبوطًا على أحدث كود.

## ملاحظة حول التصميم الأصلي

الملف المرفق الأصلي كان يشير إلى `style.css` وصورة `hans.jpg`، لكن CSS والصورة لم يكونا ضمن المرفقات. لذلك أُنشئ CSS جديد متناسق مع صفحة تسجيل الدخول العربية. ضع صورة هانس في `images/hans.jpg` لاستبدال خلفية اللوحة.
