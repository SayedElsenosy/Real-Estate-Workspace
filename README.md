# [Project Name] — Real Estate Workspace

منصة SaaS متعددة الشركات للتطوير العقاري، باستخدام Next.js App Router وTypeScript وTailwind CSS وDrizzle ORM وPostgreSQL (Neon).

**الاسم التجاري لم يُعتمد بعد.** المراحل 1–5 معتمدة. المرحلة 6 (الواجهة الأمامية التجريبية) تم اعتمادها؛ المرحلة 7 (نواة العملاء) قيد التحقق، ولم نبدأ أي مرحلة بعدها.

## الصفحات

| المسار | الوظيفة |
|---|---|
| `/login` | دخول JWT وهمي **محلي فقط** للشركتين التجريبيتين، وبالأدوار Company Admin وSales وAccountant |
| `/dashboard` | إجمالي المشروعات، الوحدات المتاحة، العقود النشطة، إجمالي المبيعات الحقيقي |
| `/projects` | المشروعات وفتح مخزون مشروع محدد |
| `/inventory` | المشروع ← المرحلة ← المبنى ← وحدات قابلة للبحث والحجز |
| `/bookings` | الحجوزات المؤكدة وبيانات العملاء |
| `/contracts` | العقود والأقساط المسجلة |
| `/treasury` | المقبوضات الفعلية (دون مزاعم تحصيل الشيكات بنكيًا) |

المكونات مستوحاة من shadcn/ui ومضافة كمصدر محلي في `components/ui` مع Radix Dialog وLucide Icons. المظهر عربي RTL ومتجاوب.

## تشغيل الديمو المحلي — على **قاعدة بيانات منفصلة**

يتطلب Node.js 22+ وPostgreSQL 17. لا تشغّل أمر البذر على قاعدة إنتاج أو على قاعدة العملاء الحقيقية. إنشاء قاعدة جديدة باسم `workspace_demo` هو الخيار المقترح.

1. `npm install`
2. انسخ `.env.example` إلى `.env.local` واضبط `DATABASE_URL_ADMIN` بحساب ترحيلات على قاعدة `workspace_demo` فقط.
3. اضبط `DEMO_RUNTIME_PASSWORD` بقيمة عشوائية طويلة، ثم `DATABASE_URL` بنفس كلمة المرور لكن بمستخدم `workspace_demo_runtime` محدود الصلاحيات. (الاسم الحالي للمستخدم في سكربت الإعداد: `workspace_demo_runtime`.)
4. اضبط `ENABLE_LOCAL_MOCK_LOGIN=true` و`DEMO_SEED_ALLOW=I_ACKNOWLEDGE_DEMO_ONLY` و`MOCK_AUTH_SECRET` بقيمة عشوائية 32 حرفًا أو أكثر.
5. `npm run db:migrate`
6. `npm run db:create-demo-runtime`
7. `npm run db:seed-demo`
8. `npm run dev -- --hostname 127.0.0.1`
9. افتح `http://127.0.0.1:3000/login`، واختَر الشركة والدور. مسؤول المبيعات أو مدير الشركة يقدر يحجز وحدة متاحة؛ المحاسب يملك صلاحية العرض فقط.

أوامر `db:migrate` و`db:create-demo-runtime` و`db:seed-demo` تقرأ `.env.local` باستخدام Node.js 22. الديمو لا يعدّل قاعدة Neon الأصلية `real_estate_workspace`، وسكربت البيانات يرفض أي قاعدة اسمها غير `foundation_test` أو لا ينتهي بـ `_demo`.

## رحلة الحجز والتأمين

- صفحة `/inventory` تعرض وحدات محفوظة فعليًا في PostgreSQL ومقيدة بـ `tenant_id` وRLS.
- `components/workspace/booking-dialog.tsx` يجمع اسم العميل ورقم الهاتف ويرسل `POST /api/bookings` عبر `fetch` وCookie Same-Origin.
- `app/api/bookings/route.ts` يتحقق من JWT الموقع ثم من عضوية المستخدم ودوره في جدول `users`، وداخل `db.transaction` ينفذ `SELECT ... FOR UPDATE` على الوحدة ويكتب حالة `BOOKED` وسجل `CONFIRMED` بصورة ذرية.
- عند نجاح الطلب، `inventory-client.tsx` يغير صف الوحدة فورًا ثم ينفذ `router.refresh()`.
- ديمو JWT موقّع HS256 في `HttpOnly; SameSite=Strict` Cookie، متاح فقط عندما `NODE_ENV=development` و`ENABLE_LOCAL_MOCK_LOGIN=true` وعلى `localhost` أو `127.0.0.1`. **مغلق دائمًا في الإنتاج**.
- النظام الحقيقي يحتاج موفر هوية موثوقًا وصلاحيات إصدار جلسات حقيقية قبل نشر واجهات العمليات للعامة.

## اختبارات

- `npm run test:foundation`: أنواع TypeScript، اختبارات PostgreSQL للعزل والحجز والعقود والأقساط والمقبوضات، وبناء Next.js. اختبارات DB تحتاج PostgreSQL مؤقتًا و`TEST_DATABASE_URL_ADMIN`.
- `npm run test:e2e`: اختبار Playwright/Chromium لتسجيل الدخول التجريبي، رؤية الوحدات، الحجز وتغير الحالة، وانعدام تسرب بيانات شركة A لشركة B. يحتاج تشغيل السيرفر المحلي وقاعدة البيانات التجريبية أولًا.
- `.github/workflows/phase1.yml` يشغّل اختبارات Backend واختبار المتصفح على قواعد PostgreSQL مؤقتة داخل GitHub Actions.

## الحدود الحالية

- لا يوجد نشر عام لدخول وهمي؛ خاص ببيئة التطوير فقط.
- لا يوجد نظام تسجيل دخول إنتاجي أو لوحة إنشاء شركات وصلاحيات إدارية كاملة.
- لا توجد مخططات SVG تفاعلية فعلية في الواجهة حتى الآن؛ `svg_coordinates` موجودة في قاعدة البيانات.
- لم نبدأ دورة تحصيل الشيكات البنكية أو مرتجعاتها؛ تسجيل CHEQUE الحالي لا يعني تحصيلًا مصرفيًا مؤكدًا.
- لا يجوز استخدام حساب `DATABASE_URL_ADMIN` داخل خادم Next.js. يجب استخدام `DATABASE_URL` محدود الصلاحيات.

راجع `docs/SECURITY.md` و`docs/PHASE6_REPORT.md`. **المرحلة السادسة جاهزة لاعتماد صاحب المشروع؛ لا تبدأ أي مرحلة لاحقة إلا بموافقته الصريحة.**

## نتيجة التحقق البصري

اجتازت الواجهة اختبار Playwright Chromium كاملًا (تسجيل دخول، حجز وحدة، تغيير الحالة، عزل شركتين وصلاحية محاسب)، مع نجاح فحص TypeScript والبناء:
https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40227986003

صور الواجهة الفعلية محفوظة ضمن مرفقات التشغيل:
https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40227986003/artifacts/12611559098

## المرحلة السابعة — العملاء (CRM)

- `db/migrations/0006_customers.sql`: جدول العملاء وRLS وفهرس هاتف فريد لكل شركة وFK مركب مع الحجز.
- `/customers`: قائمة العملاء مع البحث بالاسم أو الهاتف؛ `/customers/[id]`: Customer 360 للحجوزات والعقود.
- نافذة حجز المخزون تدعم عميلًا موجودًا أو إضافة عميل جديد. إنشاء العميل والحجز وتحويل الوحدة إلى BOOKED يتم في Transaction واحدة.
- `bookings.customer_name` و`customer_phone` محفوظان كـSnapshot، و`customer_id` يبقى NULL للحجوزات القديمة حتى مراجعة خطة ربط تاريخية بدون تخمين.

## Phase 9 and Phase 10
- /bookings: generate a signed contract and installments using POST /api/contracts.
- /contracts/[id]: view schedule, collected and remaining amounts; pay via POST /api/receipts.
- /treasury: today's receipts, overdue installments, pending cheques based on stored status.
- /settings/contracts: upload DOCX templates (max 5 MiB) and get a sample.
- POST /api/contracts/[id]/generate-docx: stream Word output directly to client.
- Database migrations 0007, 0008 and 0009 must be deployed to the target database.
- The Word renderer is stateless and never writes to public/ or local persistent disk.
- Clearing/bounced cheque workflows and production identity setup remain future work.
- See docs/PHASE9_10_REPORT.md.

## Phase 12 — Hardening Sprint
- Receipts are strictly append-only: `0011_secure_receipts.sql` revokes UPDATE/DELETE and enforces immutable row triggers. Cheque resolutions are saved in `receipt_cheque_events` instead of updating receipts.
- Booking cancellation: `POST /api/bookings/[id]/cancel` (COMPANY_ADMIN) cancels CONFIRMED booking and releases BOOKED unit inside one transaction; active contract blocks with HTTP 409.
- A signed contract atomically marks the associated unit SOLD.
- `businessDate` in `lib/utils/date.ts` normalizes Cairo calendar dates and month-end installment scheduling.
- `/inventory/manage`: admin-only create project → phase → building → unit using four validated, RLS-protected POST endpoints. SALES has read-only inventory access.
- Arabic `loading.tsx`, `error.tsx` and booking cancellation confirmation were added.
- New tests: `scripts/test-secure-receipts.mjs`, `scripts/test-business-date.mjs`, and Playwright hierarchy/booking-cancel/contract SOLD/role checks.
- Full implementation report: `docs/PHASE12_REPORT.md`.
- **Operational safeguard:** Run migrations only with trusted DATABASE_URL_ADMIN on the approved database; never use demo seeds on customer data. Phase 12 is not deployed automatically to persistent Neon.
