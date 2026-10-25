import PizZip from "pizzip";
import { test, expect } from "@playwright/test";

test("local sign-in → inventory → atomic booking → immediate UI update → tenant isolation",async({page})=>{
 await page.goto("/login");
 await expect(page.getByRole("heading",{name:"الدخول لمساحة العمل"})).toBeVisible();
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة الأفق للتطوير"});
 await page.getByLabel("الدور").selectOption("SALES");
 const responsePromise=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponse=await responsePromise;
 await expect(loginResponse.ok()).toBeTruthy();
 await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.getByRole("heading",{name:"لوحة التحكم"})).toBeVisible();
 await page.screenshot({path:"test-results/dashboard-preview.png",fullPage:true});
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByRole("heading",{name:"الوحدات والمخزون"})).toBeVisible();
 const row=page.getByTestId("unit-row-A-101");
 await expect(row).toContainText("متاحة");
 await page.screenshot({path:"test-results/inventory-preview.png",fullPage:true});
 await row.getByRole("button",{name:"حجز"}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await page.getByLabel("اسم العميل").fill("عميل الاختبار آمن");
 await page.getByLabel("رقم الهاتف").fill("01010100123");
 await page.getByRole("button",{name:"تأكيد الحجز"}).click();
 await expect(row).toContainText("محجوزة");
 await page.screenshot({path:"test-results/inventory-after-booking.png",fullPage:true});
 await expect(row.getByRole("button",{name:"حجز"})).toHaveCount(0);
 await expect(page.getByRole("status")).toContainText("تم تأكيد الحجز");
 await page.getByRole("link",{name:"الحجوزات",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toBeVisible();
 await page.getByRole("link",{name:"العملاء",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toBeVisible();
 await page.getByRole("link",{name:"Customer 360"}).first().click();
 await expect(page.getByRole("heading",{name:"عميل الاختبار آمن"})).toBeVisible();
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 const secondRow=page.getByTestId("unit-row-A-102");
 await secondRow.getByRole("button",{name:"حجز"}).click();
 await page.getByRole("button",{name:"عميل موجود"}).click();
 await page.getByLabel("بحث عن عميل للحجز").fill("01010100123");
 await page.getByLabel("اختيار العميل").selectOption({index:1});
 await page.getByRole("button",{name:"تأكيد الحجز"}).click();
 await expect(secondRow).toContainText("محجوزة");
 await page.getByRole("link",{name:"العملاء",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن",{exact:true})).toHaveCount(1);

 await page.getByRole("button",{name:"تبديل الحساب"}).click();
 await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة المدار العقارية"});
 const responsePromiseB=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponseB=await responsePromiseB;
 await expect(loginResponseB.ok()).toBeTruthy();
 await expect(page.locator("aside").getByText("شركة المدار العقارية",{exact:true})).toBeVisible();
 await page.getByRole("link",{name:"الحجوزات",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toHaveCount(0);
 await page.getByRole("link",{name:"العملاء",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toHaveCount(0);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByTestId("unit-row-A-101")).toContainText("متاحة");
 await page.getByRole("button",{name:"عرض المخطط"}).click();
 await expect(page.getByTestId("floorplan-unit-A-101")).toHaveAttribute("aria-label",/متاحة/);

});

test("accountant can see inventory but cannot book",async({page})=>{
 await page.goto("/login");
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة المدار العقارية"});
 await page.getByLabel("الدور").selectOption("ACCOUNTANT");
 const responsePromise=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponse=await responsePromise;
 await expect(loginResponse.ok()).toBeTruthy();
 await expect(page).toHaveURL(/\/dashboard$/);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByTestId("unit-row-A-101")).toContainText("صلاحية العرض فقط");
 await expect(page.getByTestId("unit-row-A-101").getByRole("button",{name:"حجز"})).toHaveCount(0);
});

test("SVG floorplan opens booking modal and immediately recolors booked unit",async({page})=>{
 await page.goto("/login");
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة المدار العقارية"});
 await page.getByLabel("الدور").selectOption("SALES");
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await page.getByRole("button",{name:"عرض المخطط"}).click();
 const shape=page.getByTestId("floorplan-unit-A-101");
 await expect(shape.locator("polygon")).toHaveAttribute("fill","#6bca93");
 await shape.hover();
 await expect(page.getByRole("tooltip")).toContainText("الوحدة A-101");
 await expect(page.getByRole("tooltip")).toContainText("85.50");
 await shape.click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await page.getByLabel("اسم العميل").fill("مشتري مخطط SVG");
 await page.getByLabel("رقم الهاتف").fill("01000204050");
 await page.getByRole("button",{name:"تأكيد الحجز"}).click();
 await expect(shape.locator("polygon")).toHaveAttribute("fill","#efab62");
 await expect(shape).toHaveAttribute("aria-label",/محجوزة/);
 await page.screenshot({path:"test-results/svg-after-booking.png",fullPage:true});
});

test("contract issuance, first installment payment, private DOCX upload and download",async({page})=>{
 await page.goto("/login");
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة الأفق للتطوير"});
 await page.getByLabel("الدور").selectOption("COMPANY_ADMIN");
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 await expect(page).toHaveURL(/\/dashboard$/);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 const row=page.getByTestId("unit-row-A-103");
 await row.getByRole("button",{name:"حجز"}).click();
 await page.getByLabel("اسم العميل").fill("مشتري العقد الآلي");
 await page.getByLabel("رقم الهاتف").fill("01055551234");
 await page.getByRole("button",{name:"تأكيد الحجز"}).click();
 await expect(row).toContainText("محجوزة");
 await page.getByRole("link",{name:"الحجوزات",exact:true}).click();
 const buyerRow=page.getByRole("row").filter({hasText:"مشتري العقد الآلي"});
 await buyerRow.getByRole("button",{name:"توليد عقد"}).click();
 const issued=page.waitForResponse(r=>r.url().endsWith("/api/contracts")&&r.request().method()==="POST");
 await page.getByRole("button",{name:"إنشاء العقد"}).click();
 const issueResponse=await issued;
 console.log("contract API:",issueResponse.status(),await issueResponse.text());
 await expect(page).toHaveURL(/\/contracts$/);
 await page.getByRole("row").filter({hasText:"مشتري العقد الآلي"}).getByRole("link").click();
 await expect(page.getByRole("heading",{name:/العقد/})).toBeVisible();
 const installment=page.getByRole("row").filter({hasText:"تسجيل دفعة"}).first();
 await installment.getByRole("button",{name:"تسجيل دفعة"}).click();
 await page.getByRole("button",{name:"تأكيد الدفع"}).click();
 await expect(page.getByRole("row").filter({hasText:"مدفوع"})).toHaveCount(1);
 const contractPage=page.url();
 await page.goto("/settings/contracts");
 const sample=await page.request.get("/api/contract-templates/sample");
 expect(sample.ok()).toBeTruthy();
 await page.getByLabel("ملف قالب Word").setInputFiles({
   name:"sample-contract.docx",
   mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
   buffer:await sample.body(),
 });
 await page.getByRole("button",{name:"رفع القالب"}).click();
 await expect(page.getByRole("status")).toContainText("تم رفع القالب");
 await page.goBack();
 const download=page.waitForEvent("download");
 await page.getByRole("button",{name:"تحميل العقد (Word)"}).click();
 const received=await download;
 expect(received.suggestedFilename()).toMatch(/contract-.*\.docx/);
 const contractId=contractPage.split("/").pop()!;
 const downloaded=await page.request.post("/api/contracts/"+contractId+"/generate-docx");
 expect(downloaded.status()).toBe(200);
 const zip=new PizZip(await downloaded.body());
 const xml=zip.file("word/document.xml")?.asText()||"";
 expect(xml).toContain("مشتري العقد الآلي");
 expect(xml).toContain("A-103");
 expect(xml).not.toContain("{customer_name}");
 expect(xml).not.toContain("{#installments}");

});
