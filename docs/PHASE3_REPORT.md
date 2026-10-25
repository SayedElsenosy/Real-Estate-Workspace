# المرحلة الثالثة — محرك الحجز الذري

## التصميم
- `0003_bookings.sql`: booking_status + bookings، `tenant_id`، FK مركب (tenant_id,unit_id)، RLS ENABLE/FORCE، صلاحيات CRUD.
- يوجد قيد فريد جزئي **للحجوزات النشطة فقط** يمنع تكرار CONFIRMED/PENDING حتى لو استُخدم كود غير محرك الحجز.
- `POST /api/bookings` لا يقبل tenant_id من JSON. يطلب Bearer JWT متحققًا منه مقابل JWKS خارجي موثوق بمتغيرات البيئة:
  `BOOKING_AUTH_JWKS_URL`, `BOOKING_AUTH_ISSUER`, `BOOKING_AUTH_AUDIENCE`.
- يجب أن يحتوي JWT الموقع على `sub` و `tenant_id`، وأن توجد عضوية فعلية في `users.external_auth_id` لنفس الشركة ولدور `SALES` أو `COMPANY_ADMIN`.
- لا يوجد إصدار توكنات أو تسجيل دخول في هذه المرحلة: API **تفشل بأمان** (503 بدون تهيئة المصدر و401 بدون JWT)، ويُمنع نشر صلاحيات المدير في Runtime.
- `lib/bookings/create-booking.ts`: database.transaction، سياق الشركة المحلي، تحقق العضوية، `SELECT ... FOR UPDATE` بواجهات Drizzle، التحقق من AVAILABLE، تحديث إلى BOOKED، إنشاء حجز CONFIRMED، rollback تلقائي لأي فشل.
- `expires_at` حقل اختياري يدعم سياسة الحجز المؤقت مستقبلًا، **ولا يوجد إطلاق تلقائي للوحدة عند انتهائه**؛ إلغاء الحجوزات دورة أعمال مؤجلة.
- `scripts/test-booking-concurrency.mjs`: يستخدم دور PostgreSQL runtime محدودًا، و`Promise.all` لعشر عمليات متزامنة تستدعي نفس الخدمة المكتوبة للـAPI، وتتحقق من 1 نجاح و9 رفض و1 سجل حجز وBOOKED للوحدة. الاختبار على قاعدة CI مؤقتة فقط.

## ملاحظات مهمة
- لا تضع `DATABASE_URL_ADMIN` في نشر Next.js.
- حقول السعر في المخزون تبقى `NUMERIC(12,2)` ولا تدخل في حسابات JS Float.
- `status=CONFIRMED` يُسجل مباشرة عند نجاح طلب الحجز؛ PENDING متاح في ENUM لسيناريوهات موافقة/حجز مؤقت لاحقة.
- لا عقود ولا أقساط ولا تنفيذ للمرحلة الرابعة.
