import { test, expect } from "@playwright/test";

test("local sign-in → inventory → atomic booking → immediate UI update → tenant isolation",async({page})=>{
 await page.goto("/login");
 await expect(page.getByRole("heading",{name:"الدخول لمساحة العمل"})).toBeVisible();
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة الأفق للتطوير"});
 await page.getByLabel("الدور").selectOption("SALES");
 const responsePromise=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponse=await responsePromise;
 console.log("mock login response:",loginResponse.status(),await loginResponse.text());
 await expect(page).toHaveURL(/\/dashboard$/);
 await expect(page.getByRole("heading",{name:"لوحة التحكم"})).toBeVisible();
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByRole("heading",{name:"الوحدات والمخزون"})).toBeVisible();
 const row=page.getByTestId("unit-row-A-101");
 await expect(row).toContainText("متاحة");
 await row.getByRole("button",{name:"حجز"}).click();
 await expect(page.getByRole("dialog")).toBeVisible();
 await page.getByLabel("اسم العميل").fill("عميل الاختبار آمن");
 await page.getByLabel("رقم الهاتف").fill("01010100123");
 await page.getByRole("button",{name:"تأكيد الحجز"}).click();
 await expect(row).toContainText("محجوزة");
 await expect(row.getByRole("button",{name:"حجز"})).toHaveCount(0);
 await expect(page.getByRole("status")).toContainText("تم تأكيد الحجز");
 await page.getByRole("link",{name:"الحجوزات",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toBeVisible();

 await page.getByRole("button",{name:"تبديل الحساب"}).click();
 await expect(page).toHaveURL(/\/login$/);
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة المدار العقارية"});
 const responsePromise=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponse=await responsePromise;
 console.log("mock login response:",loginResponse.status(),await loginResponse.text());
 await expect(page.getByText("شركة المدار العقارية")).toBeVisible();
 await page.getByRole("link",{name:"الحجوزات",exact:true}).click();
 await expect(page.getByText("عميل الاختبار آمن")).toHaveCount(0);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByTestId("unit-row-A-101")).toContainText("متاحة");
});

test("accountant can see inventory but cannot book",async({page})=>{
 await page.goto("/login");
 await page.getByLabel("الشركة التجريبية").selectOption({label:"شركة المدار العقارية"});
 await page.getByLabel("الدور").selectOption("ACCOUNTANT");
 const responsePromise=page.waitForResponse(r=>r.url().includes("/api/dev/login"));
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
 const loginResponse=await responsePromise;
 console.log("mock login response:",loginResponse.status(),await loginResponse.text());
 await expect(page).toHaveURL(/\/dashboard$/);
 await page.getByRole("link",{name:"المخزون",exact:true}).click();
 await expect(page.getByTestId("unit-row-A-101")).toContainText("صلاحية العرض فقط");
 await expect(page.getByTestId("unit-row-A-101").getByRole("button",{name:"حجز"})).toHaveCount(0);
});
