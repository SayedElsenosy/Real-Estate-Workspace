# [Project Name] — Foundational Version (النسخة التأسيسية)

> الاسم التجاري لم يُحدد بعد. **المرحلة النشطة: 1 — Setup & Foundation فقط.** لا توجد وحدات مخزون أو حجوزات أو عقود أو أقساط في هذا الإصدار.

منصة SaaS مستقبلية للمطورين العقاريين تربط المخزون والمخططات بالعملاء والحجوزات والعقود والأقساط. هذه المرحلة تؤسس **Next.js App Router + React + TypeScript + Tailwind CSS + Neon PostgreSQL + Drizzle ORM** وعزل الشركات باستخدام **PostgreSQL RLS**.

## ترتيب المراحل (لا تنتقل دون موافقة صريحة)

1. **Setup & Foundation — الحالية**: التهيئة، اتصال Neon، جدول `tenants` وجدول `users` بأدوار `PLATFORM_OWNER`, `COMPANY_ADMIN`, `SALES`, `ACCOUNTANT`، عزل RLS، اختبار الشركة أ/ب.
2. **Inventory Core — مؤجلة**: `projects`, `phases`, `buildings`, `units` مع `status` و`numeric(12,2)` وإحداثيات SVG وCRUD مقيد بالشركة.
3. **Atomic Booking — مؤجلة**: `bookings` ومعاملة وقفل صف `SELECT ... FOR UPDATE` واختبار تنافس الحجز.
4. **Contracts & Installments — مؤجلة**: العقود، snapshot السعر، خطة السداد، مجموع الأقساط مطابق للقيمة المالية إلى آخر قرش.

**لن ننفذ المراحل 2–4 حتى يوافق صاحب المشروع على كل مرحلة.** خارج النطاق: HR والرواتب والبوابات والتقارير المالية المعقدة وأي إعدادات Cloudflare.

## التطوير المحلي

1. Node.js 22+، PostgreSQL 16+ أو Neon.
2. `npm install` ثم `cp .env.example .env.local`.
3. ضع `DATABASE_URL_ADMIN` (مدير قاعدة Neon **للمهاجرات فقط**) و`DATABASE_URL` (**حساب خدمة محدود الصلاحيات**). لا تستخدم رابط المدير في تشغيل الويب.
4. نفّذ `npm run db:migrate` ببيئة `DATABASE_URL_ADMIN`؛ يثبّت `db/migrations/0001_foundation.sql` ويجهّز دور `tenant_runtime` المحدود.
5. أنشئ تسجيل دخول قاعدة بيانات منفصل يمنحه المدير عضوية `tenant_runtime` فقط، واستخدم رابطه في `DATABASE_URL`، مع `sslmode=require` على Neon. يشرح `docs/SECURITY.md` الإعداد.
6. `npm run dev` لواجهة التهيئة؛ `npm run typecheck`, `npm run build` للفحوص.
7. `npm run test:rls` ينشئ بيانات اختبارية **ويحذفها في النهاية**، ويفحص عدم ظهور بيانات شركتين لبعضهما تحت `tenant_runtime`. استخدم قاعدة اختبار منفصلة ولا تشغّله على الإنتاج.

## أمان التصميم

- **كل جدول تجاري في هذه المرحلة يحتوي `tenant_id`**: `tenants.tenant_id` هو المفتاح الأساسي للشركة ذاتها، و`users.tenant_id` مفتاح أجنبي إليها.
- RLS مفعّل و**FORCE ROW LEVEL SECURITY** على كلا الجدولين؛ سياسة `tenant_runtime` تقرأ صفوف الشركة الحالية فقط، والقيمة المفقودة تعني عدم إظهار أي صفوف.
- كل سياق مستأجر يجب ضبطه **من جانب الخادم بعد التحقق من هوية المستخدم**، داخل معاملة بـ`SET LOCAL` / `set_config(..., true)` لتفادي تسرب السياق بين الاتصالات.
- حساب `PLATFORM_OWNER` ليس تصريحًا لتجاوز RLS. أعمال مالك المنصة لاحقًا تمر بواجهة إدارية ذات اعتماد منفصل وسجل تدقيق.
- لا يوجد نظام تسجيل دخول حقيقي أو APIs إدارة للشركات حتى الآن؛ لا تدّعِ جاهزية هذه المرحلة للاستخدام الإنتاجي.

## الاستضافة

المسموح فقط Vercel أو Netlify. ملف `vercel.json` يحدد إعدادات غير سرية، وتُضبط متغيرات الاتصال عبر لوحة الاستضافة. لا توجد إعدادات Cloudflare.

## التوثيق

- `docs/SECURITY.md`: RLS والأدوار وحدود المرحلة.
- `docs/PHASE1_REPORT.md`: ما نُفّذ وخطوات التحقق وحالة البنية.
- `db/migrations/0001_foundation.sql`: SQL تأسيس قاعدة البيانات.
