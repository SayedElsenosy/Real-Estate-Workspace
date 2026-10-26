# Real Estate Workspace

منصة متعددة الشركات للتطوير العقاري مبنية بـNext.js وTypeScript وTailwind وshadcn/ui وDrizzle وPostgreSQL.

## المصادقة الحقيقية — Auth.js v5

تم استبدال تسجيل الدخول الوهمي بالكامل بـCredentials (البريد وكلمة المرور)، Drizzle Adapter، جلسات JWT مشفرة، وتجزئة كلمات المرور باستخدام bcryptjs. الشركة والدور يُقرآن من قاعدة البيانات؛ لا يختارهما الزائر. جميع الصفحات والـAPIs تستخدم الجلسة الحقيقية مع RLS.

للتشغيل:

1. `npm ci` (Node.js 22+).
2. راجع `.env.example` واضبط اتصالي التشغيل المحدودين `DATABASE_URL` و`AUTH_DATABASE_URL`، بالإضافة إلى `AUTH_SECRET` و`AUTH_URL`.
3. من بيئة المشغّل الموثوقة، شغّل `npm run db:migrate` باستخدام `DATABASE_URL_ADMIN`.
4. أنشئ اتصال الهوية المحدود عبر `npm run auth:create-runtime` وإعداد `AUTH_RUNTIME_PASSWORD`.
5. بعد إنشاء الشركة، اضبط `ADMIN_TENANT_ID`, `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` وشغّل `npm run auth:create-admin`.
6. `npm run dev` ثم افتح `/login`، أو `npm run build && npm start` للإنتاج مع HTTPS.

**لا تستخدم اتصال مالك قاعدة البيانات داخل خادم الويب.** إعداد مفصل للصلاحيات والمصادقة والتهيئة: [docs/AUTH_SETUP.md](docs/AUTH_SETUP.md).

## الصفحات والوظائف

| المسار | الوظيفة |
|---|---|
| `/login` | دخول حقيقي بالبريد وكلمة المرور |
| `/dashboard` | مؤشرات المشروعات والوحدات والعقود والمبيعات |
| `/projects` | قائمة المشروعات ومخزونها |
| `/inventory` | وحدات قابلة للبحث والحجز ومخطط SVG |
| `/inventory/manage` | إنشاء مشروع ثم مرحلة ثم مبنى ثم وحدة |
| `/customers` | قائمة العملاء وCustomer 360 |
| `/bookings` | الحجز الذري، الإلغاء، وتوليد العقد |
| `/contracts` | العقود والأقساط والتحصيل وتنزيل Word |
| `/treasury` | المقبوضات وحالات الشيكات |
| `/reports/aging` | أعمار المديونيات |
| `/settings/contracts` | قوالب Word الخاصة بالشركة |

الإيصالات Append-only؛ أحداث الشيكات منفصلة. الحجز والإلغاء والتعاقد والتحصيل داخل Transactions. العقود تحفظ سعر وخطة السداد وقت التوقيع، والحسابات تستخدم Decimal.js. تواريخ العمل بتوقيت القاهرة. يُمنع إلغاء حجز له عقد نشط؛ توقيع العقد يحوّل الوحدة إلى مباعة.

## الاختبارات

- `npm run typecheck` و`npm run build`.
- `npm run test:foundation`: عزل الشركات وتزامن الحجز والعقود والتحصيل ودقة الأقساط، على PostgreSQL مؤقتة.
- `npm run test:auth-rls`: صلاحيات مصادقة محدودة، حماية كلمات المرور وإبطال الجلسات.
- `npm run test:e2e`: دخول حقيقي، حماية المسارات والـAPIs، رفض التلاعب بالجلسة، وعزل الشركات مع رحلة الحجز والعقد والتحصيل.
- `.github/workflows/phase1.yml`: يشغّل اختبارات قاعدة البيانات والمتصفح باستخدام حسابات اختبار فعلية بكلمات مرور مشفرة.

البيانات التجريبية اختيارية على قاعدة مؤقتة فقط: `npm run db:create-demo-runtime` ثم `npm run db:seed-demo` مع `DEMO_SEED_ALLOW` و`DEMO_ACCOUNT_PASSWORD`. لا يوجد أي مسار لتسجيل الدخول الوهمي.

تقارير التطوير التاريخية محفوظة في `docs/`. تعليمات الهوية القديمة داخل تقارير المراحل السابقة تاريخية؛ المرجع الحالي هو [AUTH_SETUP.md](docs/AUTH_SETUP.md). لم تُطبّق ترحيلات هذه الخطوة تلقائيًا على Neon الدائمة.
