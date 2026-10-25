# المرحلة الثانية — Inventory Core

## نطاق التنفيذ (25 أكتوبر 2026)

- أربعة جداول جديدة فقط: `projects`, `phases`, `buildings`, `units`.
- `tenant_id` إلزامي في كل جدول، وجميع العلاقات إلى الآباء تستخدم FK مركب يمنع ربط شركة بشركة أخرى.
- حقول الوحدات: `unit_number`, `area NUMERIC(12,2)`, `price NUMERIC(12,2)`, `status` (AVAILABLE/BOOKED/SOLD), `svg_coordinates JSONB` (كائن أو NULL).
- حالات المشاريع: PLANNED/ACTIVE/ON_HOLD/COMPLETED.
- RLS مفعّل وFORCE على الأربعة؛ policy CRUD للشركة الحالية، وpolicy منفصلة للمهاجرات.
- `tenant_runtime`: SELECT/INSERT/UPDATE/DELETE في المخزون فقط. `tenants` و`users` يحتفظان بصلاحيات القراءة المحدودة السابقة.
- قاعدة Neon المستقلة: `Real-Estate-Workspace-Foundation` / `floral-shape-03190134`.

## معايير القبول

`npm run db:migrate` ثم `npm run test:inventory-rls` على قاعدة اختبار منفصلة، ومراجعة CI ونتائج اختبار Neon المعزولة.

## غير موجود في هذه المرحلة

- لم تُنشأ واجهات CRUD للمستخدم النهائي لأن المصادقة غير موجودة بعد.
- لم يتم تنفيذ أي حجوزات أو SELECT FOR UPDATE أو عقود أو أقساط (المرحلتان 3 و4 مؤجلتان).
- ليس هناك فتح لتسجيل حسابات عامة أو تعريض رابط owner بواجهات API.

**المرحلة الثالثة تحتاج موافقة صريحة من صاحب المشروع.**
