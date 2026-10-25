# المرحلة الثانية — Inventory Core

## نطاق التنفيذ (25 أكتوبر 2026)

- أربعة جداول جديدة فقط: `projects`, `phases`, `buildings`, `units`.
- `tenant_id` إلزامي في كل جدول، وجميع العلاقات إلى الآباء تستخدم FK مركب يمنع ربط شركة بشركة أخرى.
- حقول الوحدات: `unit_number`, `area NUMERIC(12,2)`, `price NUMERIC(12,2)`, `status` (AVAILABLE/BOOKED/SOLD), `svg_coordinates JSONB` (كائن أو NULL).
- حالات المشاريع: PLANNED/ACTIVE/ON_HOLD/COMPLETED.
- RLS مفعّل وFORCE على الأربعة؛ policy CRUD للشركة الحالية، وpolicy منفصلة للمهاجرات.
- `tenant_runtime`: SELECT/INSERT/UPDATE/DELETE في المخزون فقط. `tenants` و`users` يحتفظان بصلاحيات القراءة المحدودة السابقة.
- قاعدة Neon المستقلة: `Real-Estate-Workspace-Foundation` / `floral-shape-03190134`.

## التحقق المنفذ فعليًا

- تطبيق `0002_inventory.sql` على **Neon المستقلة** (Project ID: `floral-shape-03190134`) نجح.
- استعلام كتالوج PostgreSQL أكد `relrowsecurity=true` و`relforcerowsecurity=true` وسياسات `tenant_runtime_inventory_crud` و`migrations_admin` لكل جدول.
- اختبار Neon ببيانات وهمية داخل كتلة rollback تحقق من قراءة A لبيانات A فقط وB لبيانات B فقط، ومنع A من تحديث/حذف وحدات B، ونجاح CRUD داخل A، وفشل إضافة وحدة بدون `tenant_id` أو بإشارة لمبنى B.
- القاعدة بعد الاختبار: صفر `tenants` وصفر `projects` وصفر `phases` وصفر `buildings` وصفر `units` (لا بيانات تجريبية متبقية).
- CI شغّل الهجرات واختبار المرحلة 1 واختبار المرحلة 2 وTypeScript وNext.js build:
  https://github.com/SayedElsenosy/Real-Estate-Workspace/actions/runs/40204954829
- **هذه فحوص قاعدة بيانات وبناء فقط**؛ لا يوجد مصادقة مستخدمين ولا اختبار تفاعل حقيقي عبر APIs.


## غير موجود في هذه المرحلة

- لم تُنشأ واجهات CRUD للمستخدم النهائي لأن المصادقة غير موجودة بعد.
- لم يتم تنفيذ أي حجوزات أو SELECT FOR UPDATE أو عقود أو أقساط (المرحلتان 3 و4 مؤجلتان).
- ليس هناك فتح لتسجيل حسابات عامة أو تعريض رابط owner بواجهات API.

**المرحلة الثالثة تحتاج موافقة صريحة من صاحب المشروع.**
