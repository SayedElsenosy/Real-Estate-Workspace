# تقرير المرحلة الأولى — النسخة التأسيسية

**التاريخ:** 25 أكتوبر 2026  
**المستودع الوحيد المعدَّل:** SayedElsenosy/Real-Estate-Workspace  
**الاسم التجاري:** لم يُعتمد بعد.

## الحالة: تم تنفيذ وتحقق التأسيس

### المشروع والتطبيق
- Next.js 16 App Router، React 19، TypeScript، Tailwind CSS 4، Drizzle ORM وpostgres.js.
- صفحة تأسيس عربية، وAPI صحة عامة لا تعرض بيانات الشركات، وملف استضافة Vercel فقط.
- لا توجد APIs للمخزون أو الحجز أو العقود أو الأقساط، التزامًا بتوقفنا بعد المرحلة الأولى.

### PostgreSQL / Neon
- مشروع Neon **مستقل**: `Real-Estate-Workspace-Foundation`، Project ID: `floral-shape-03190134`، في `aws-eu-central-1`، PostgreSQL 17.
- قاعدة البيانات: `real_estate_workspace`.
- تم تنفيذ الترحيل `db/migrations/0001_foundation.sql` بنجاح على المشروع المنفصل.
- جدول `tenants` يحتوي `tenant_id` مفتاحًا أساسيًا للشركة؛ جدول `users` يحتوي `tenant_id` إلزاميًا FK، والأدوار الأربعة.
- تم التحقق بقراءة كتالوج PostgreSQL: `relrowsecurity=true` و`relforcerowsecurity=true` لكلا الجدولين، وسياسات `tenant_runtime_read` و`migrations_admin` موجودة.
- دور `tenant_runtime` هو NOLOGIN وNOBYPASSRLS، وله SELECT فقط ضمن سياسة الشركة. تشغيل التطبيق يتطلب لاحقًا بيانات دخول خدمة منفصلة محدودة الصلاحيات، ومخزنة في Secret Variables.
- لم ننشئ حسابات شركة أو مستخدمين حقيقيين؛ قاعدة Neon الجديدة نظيفة.

### اختبار عزل شركتين على Neon الفعلي
تم تشغيل سيناريو SQL داخل كتلة استثنائية تراجع بيانات الاختبار تلقائيًا:
1. إدراج شركتين وهميتين A وB ومستخدم لكل شركة.
2. التحويل إلى `tenant_runtime` بدون tenant context → صفر مستخدمين ظاهرين.
3. ضبط tenant A → مستخدم A فقط، وعدم ظهور مستخدم أو سجل شركة B.
4. ضبط tenant B → مستخدم B فقط، وعدم ظهور مستخدم أو سجل شركة A.
5. تحقق أخير: 0 شركات و0 مستخدمين اختبار في القاعدة بعد التراجع.

**النتيجة: نجح السيناريو بدون أخطاء.** بالإضافة إلى ذلك، يختبر `scripts/test-rls.mjs` الصلاحيات وانعدام الأذونات الكتابية في CI.

### GitHub Actions
- تشغيل `Phase 1 Foundation CI` ناجح: https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40203283367
- شغّل CI `npm install`، `npm run db:migrate` على PostgreSQL 17 مؤقتة، `npm run test:rls`، `npm run typecheck`، و`npm run build`.
- أُصلح خطأ سابق بصياغة كتل SQL `DO $$` قبل النجاح النهائي.

## حدود الأمن والتسليم

- **لا يوجد تسجيل دخول فعلي في المرحلة الأولى.** السجل `users` وتعداد الأدوار لا يساويان نظام هوية ومصادقة مكتملًا. لا يجوز تمرير tenant_id من العميل على أنه دليل عضوية.
- لا توجد إعدادات Netlify/Vercel Secrets أو نشر إنتاجي بعد. يتطلب اتصال التطبيق اختيار مستخدم PostgreSQL SQL-created محدودًا، منفصلًا عن owner، وضبط `DATABASE_URL` سرًا في بيئة التشغيل.
- حساب `PLATFORM_OWNER` الوظيفي ليس تجاوزًا لـRLS. أعمال إدارة الشركات والتدقيق ستكون لها إجراءات آمنة لاحقًا.
- جميع الحسابات المالية المستقبلية يجب أن تستخدم `NUMERIC(12,2)` ومكتبة Decimal آمنة، دون Float أو Number لتخزين/حساب المال.
- لم يُلمس `BUNYRA-New` أو `Cairo-Plaza-Web`، ولم ننفذ المرحلتين الثانية أو الثالثة أو الرابعة.

**التوقف بعد المرحلة 1 إلزامي حتى موافقة صاحب المشروع.**
