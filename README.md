# [Project Name] — النسخة التأسيسية / Foundational Version

**الاسم التجاري مؤجل. المرحلة الحالية: 1 فقط — Setup & Foundation.**

منصة SaaS لشركات التطوير العقاري. النطاق النهائي المستهدف: المخزون والمخططات والعملاء والحجوزات والعقود والأقساط. لا يتضمن هذا الإصدار الحالي أي وحدات مخزون أو حجوزات أو عقود أو أقساط.

## المراحل المعتمدة بالترتيب

1. **Setup & Foundation (الحالية)**: Next.js App Router / React / TypeScript / Tailwind، اتصال Neon PostgreSQL مع Drizzle، جداول tenants وusers، الأدوار الأربعة، RLS واختبار العزل.
2. **Inventory Core (مؤجلة للموافقة)**: projects، phases، buildings، units؛ الحالات AVAILABLE/BOOKED/SOLD، سعر NUMERIC(12,2)، إحداثيات SVG وCRUD.
3. **Atomic Booking (مؤجلة للموافقة)**: bookings؛ قفل SELECT FOR UPDATE ومعاملة ذرية واختبار تنافس حجز الوحدة.
4. **Contracts & Installments (مؤجلة للموافقة)**: snapshots الأسعار وجداول سداد مجموعها يطابق العقد حتى القرش.

خارج النطاق الآن: HR، الرواتب، البوابات والتقارير المالية المعقدة. لا توجد إعدادات Cloudflare؛ الاستضافة Vercel أو Netlify فقط.

## تشغيل المرحلة الأولى

- Node.js 22+ وPostgreSQL 17/Neon.
- `npm install`
- انسخ `.env.example` إلى `.env.local`. بيانات الاتصال سرية ولا تُحفظ في Git.
- `DATABASE_URL_ADMIN`: حساب مدير القاعدة لتطبيق الترحيلات فقط.
- `DATABASE_URL`: حساب تشغيل **محدود الصلاحيات** بعضوية `tenant_runtime` فقط؛ لا تستخدم رابط المدير في تشغيل التطبيق.
- `npm run db:migrate` لتثبيت `db/migrations/0001_foundation.sql`.
- `npm run dev` لتشغيل واجهة التأسيس.
- `npm run typecheck` ثم `npm run build` للواجهة.
- `npm run test:rls` باستخدام `TEST_DATABASE_URL_ADMIN` في **قاعدة اختبار منفصلة فقط**، وليس الإنتاج.

## نموذج العزل

كل جدول منشأ هنا يحتوي `tenant_id`: في tenants هو PK الخاص بالشركة نفسها، وفي users هو FK إلزامي. كلتا الجدولتين بهما ENABLE + FORCE RLS. يقرأ دور `tenant_runtime` الصفوف التي توافق `app.current_tenant_id()` فقط، ويتم ضبط السياق داخل المعاملة من خادم موثوق وبعد التحقق من تسجيل الدخول والعضوية. لا يوجد تسجيل دخول حقيقي في المرحلة الحالية؛ لا يُسمح بإرسال معرف الشركة من العميل على أنه إثبات هوية.

`PLATFORM_OWNER` دور وظيفي داخل منصة مع tenant منصة منفصل؛ ليس صلاحية SQL لتجاوز RLS. التهيئة الإدارية تتم بتفويض خاص وبصلاحية مالك قاعدة منفصلة، ممنوع استخدامها في Runtime.

## الملفات المهمة

- `db/migrations/0001_foundation.sql` — الجداول والسياسات.
- `lib/db/schema.ts` — نموذج Drizzle.
- `lib/db/client.ts` — اتصال بقاعدة البيانات وسياق المعاملة المعزول.
- `scripts/test-rls.mjs` — اختبارات عزل الشركات.
- `docs/SECURITY.md` — تشغيل محدود الصلاحيات وحدود الأمان.
- `docs/PHASE1_REPORT.md` — تقرير التأسيس.

**لن تبدأ المرحلة الثانية إلا بموافقة صاحب المشروع صراحة.**
