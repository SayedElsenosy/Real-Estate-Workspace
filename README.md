# [Project Name] — النسخة التأسيسية / Foundational Version

**الاسم التجاري مؤجل. المراحل 1 و2 مؤسستان، والمرحلة 3 (الحجز الذري) في التنفيذ، والمرحلة 4 منفذة تقنيًا وتنتظر اعتمادك.**

منصة SaaS لشركات التطوير العقاري. النطاق النهائي المستهدف: المخزون والمخططات والعملاء والحجوزات والعقود والأقساط. تتوفر جداول المخزون ومخططاته على مستوى البيانات فقط؛ لا توجد واجهات CRUD عامة أو نظام تسجيل دخول مكتمل؛ واجهات العقود والحجوزات تتطلب JWT موثوق. محرك الحجز متاح عبر API تفشل بأمان إلى حين تجهيز مُصدر JWT موثوق.

## المراحل المعتمدة بالترتيب

1. **Setup & Foundation (مكتملة)**: Next.js App Router / React / TypeScript / Tailwind، اتصال Neon PostgreSQL مع Drizzle، جداول tenants وusers، الأدوار الأربعة، RLS واختبار العزل.
2. **Inventory Core (مكتملة على مستوى قاعدة البيانات/Drizzle/RLS والاختبارات)**: projects، phases، buildings، units؛ الحالات AVAILABLE/BOOKED/SOLD، سعر NUMERIC(12,2)، إحداثيات SVG. واجهات CRUD مؤجلة إلى ما بعد إعداد المصادقة.
3. **Atomic Booking (منفذة تقنيًا وتحتاج اعتمادًا)**: bookings؛ قفل SELECT FOR UPDATE ومعاملة ذرية واختبار تنافس حجز الوحدة.
4. **Contracts & Installments (منفذة تقنيًا وتنتظر الاعتماد)**: snapshots الأسعار وجداول سداد مجموعها يطابق العقد حتى القرش.

خارج النطاق الآن: HR، الرواتب، البوابات والتقارير المالية المعقدة. لا توجد إعدادات Cloudflare؛ الاستضافة Vercel أو Netlify فقط.

## تشغيل المرحلة الأولى

- Node.js 22+ وPostgreSQL 17/Neon.
- `npm install`
- انسخ `.env.example` إلى `.env.local`. بيانات الاتصال سرية ولا تُحفظ في Git.
- `DATABASE_URL_ADMIN`: حساب مدير القاعدة لتطبيق الترحيلات فقط.
- `DATABASE_URL`: حساب تشغيل **محدود الصلاحيات** بعضوية `tenant_runtime` فقط؛ لا تستخدم رابط المدير في تشغيل التطبيق.
- `npm run db:migrate` لتثبيت ترحيلات `0001_foundation.sql` و`0002_inventory.sql` و`0003_bookings.sql` و`0004_contracts.sql` على قاعدة مخصصة (لا يستخدم صلاحية التطبيق).
- `npm run dev` لتشغيل واجهة التأسيس.
- `npm run typecheck` ثم `npm run build` للواجهة.
- `npm run test:rls` و`npm run test:inventory-rls` و`npm run test:booking-concurrency` و`npm run test:installments-math` و`npm run test:contracts-transaction` باستخدام `TEST_DATABASE_URL_ADMIN` في **قاعدة اختبار منفصلة فقط**، وليس الإنتاج.

## نموذج العزل

كل جدول منشأ حتى المرحلة 3 يحتوي `tenant_id`: في tenants هو PK الخاص بالشركة نفسها، وفي users وprojects وphases وbuildings وunits هو FK إلزامي. الجداول الثمانية والتسعة بها ENABLE + FORCE RLS. أربعة جداول المخزون تسمح بـSELECT وINSERT وUPDATE وDELETE لدور tenant_runtime داخل الشركة المحددة فقط. الارتباطات بين المشروع/المرحلة/المبنى/الوحدة محمية بقيود مفاتيح أجنبية مركبة (tenant_id, parent_id). يقرأ دور `tenant_runtime` الصفوف التي توافق `app.current_tenant_id()` فقط، ويتم ضبط السياق داخل المعاملة من خادم موثوق وبعد التحقق من تسجيل الدخول والعضوية. لا يوجد تسجيل دخول حقيقي في المرحلة الحالية؛ لا يُسمح بإرسال معرف الشركة من العميل على أنه إثبات هوية.

`PLATFORM_OWNER` دور وظيفي داخل منصة مع tenant منصة منفصل؛ ليس صلاحية SQL لتجاوز RLS. التهيئة الإدارية تتم بتفويض خاص وبصلاحية مالك قاعدة منفصلة، ممنوع استخدامها في Runtime.

## الملفات المهمة

- `db/migrations/0001_foundation.sql` — الشركات والمستخدمون.
- `db/migrations/0002_inventory.sql` — المخزون وعزله وقيود الانتماء للشركة.
- `db/migrations/0003_bookings.sql` — الحجوزات وعزلها وقيد الحجز النشط الواحد.
- `lib/db/schema.ts` — نموذج Drizzle.
- `lib/db/client.ts` — اتصال بقاعدة البيانات وسياق المعاملة المعزول.
- `scripts/test-rls.mjs` — اختبار المرحلة 1.
- `scripts/test-inventory-rls.mjs` — اختبار العزل والكتابة والمفاتيح الخارجية للمرحلة 2.
- `scripts/test-booking-concurrency.mjs` — 10 محاولات حجز متزامنة باستخدام نفس محرك الـAPI.
- `docs/SECURITY.md` — تشغيل محدود الصلاحيات وحدود الأمان.
- `docs/PHASE1_REPORT.md` — تقرير التأسيس.

**لا تبدأ أي مرحلة جديدة قبل اعتماد المرحلة الرابعة صراحة.**

## عقود وأقساط المرحلة الرابعة

- `POST /api/contracts` يطلب Bearer JWT موثوق `sub` / `tenant_id` مع عضوية `COMPANY_ADMIN` فعلية. أي `tenant_id` مرسل في JSON مرفوض.
- `total_amount` يُرسل كنص عشري مطابق للسعر المعتمد للوحدة حتى نضيف دورة موافقات الخصومات لاحقًا.
- `payment_plan`: `down_payment_percent` كنص مثل `"20"`، و`installment_count` و`interval_months` كأعداد صحيحة للتقويم فقط.
- حسابات الأقساط كلها `Decimal.js`، وتحفظ خطة السداد وسعر الوحدة كتاريخ ثابت في العقد.
- لا يوجد موفر JWT أو تسجيل دخول حقيقي مربوط حاليًا؛ المسارات تفشل بأمان حتى يضبط صاحب المنصة موفرًا موثوقًا ورابط تشغيل DB محدود الصلاحيات.
