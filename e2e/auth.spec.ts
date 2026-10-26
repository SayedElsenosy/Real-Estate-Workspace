import { test, expect } from "@playwright/test";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";

const email="auth-security@demo-horizon.example.invalid";
const tenant="a1111111-1111-4111-8111-111111111111";
let id:string;
let db:ReturnType<typeof postgres>;
test.beforeAll(async()=>{
 const url=process.env.DATABASE_URL_ADMIN;
 if (!url || new URL(url).pathname!=="/foundation_test") throw new Error("Auth tests require disposable foundation_test");
 db=postgres(url,{max:1}); id=randomUUID();
 await db`INSERT INTO users(id,tenant_id,email,full_name,role,external_auth_id,password_hash)
  VALUES(${id},${tenant},${email},'Auth Test','COMPANY_ADMIN',${"credentials:"+id},${await hash(process.env.DEMO_ACCOUNT_PASSWORD!,12)})`;
});
test.afterAll(async()=>{if(db){await db`DELETE FROM users WHERE id=${id}`;await db.end();}});
async function login(page:import("@playwright/test").Page,password=process.env.DEMO_ACCOUNT_PASSWORD!){
 await page.goto("/login");
 await page.getByLabel("البريد الإلكتروني").fill(email);
 await page.getByLabel("كلمة المرور").fill(password);
 await page.getByRole("button",{name:"دخول مساحة العمل"}).click();
}
test("rejects unauthenticated requests, old mock cookies and forged identity headers",async({page})=>{
 await page.goto("/inventory/manage");await expect(page).toHaveURL(/\/login\?/);
 const response=await page.request.post("/api/projects",{
  headers:{authorization:"Bearer forged",cookie:"workspace_mock_session=forged","x-tenant-id":tenant,"x-role":"COMPANY_ADMIN"},
  data:{name:"Unauthorized"},
 });
 expect(response.status()).toBe(401);
 expect((await page.request.post("/api/dev/login",{data:{tenantId:tenant,role:"COMPANY_ADMIN"}})).status()).toBe(404);
});
test("rejects invalid password, signs in, hides secrets, blocks cross-site writes and signs out",async({page})=>{
 await login(page,"wrong-password-2026");await expect(page.getByRole("alert")).toBeVisible();
 await login(page);await expect(page).toHaveURL(/\/dashboard$/);
 const response=await page.request.get("/api/auth/session");const session=await response.json();
 expect(session.user.tenantId).toBe(tenant);expect(session.user.role).toBe("COMPANY_ADMIN");
 expect(JSON.stringify(session)).not.toMatch(/passwordHash|password_hash|\$2[aby]\$/);
 const cookies=await page.context().cookies();
 expect(cookies.find(c=>c.name.endsWith("authjs.session-token"))?.httpOnly).toBe(true);
 expect((await page.request.post("/api/projects",{headers:{origin:"https://evil.invalid"},data:{name:"CSRF"}})).status()).toBe(401);
 await page.getByRole("button",{name:"تسجيل الخروج",exact:true}).click();await expect(page).toHaveURL(/\/login$/);
 expect((await page.request.post("/api/projects",{data:{name:"After logout"}})).status()).toBe(401);
});
test("database role changes revoke an existing JWT and a tampered cookie cannot authorize",async({page})=>{
 await login(page);await expect(page).toHaveURL(/\/dashboard$/);
 await db`UPDATE users SET role='SALES' WHERE id=${id}`;
 expect((await page.request.post("/api/projects",{data:{name:"Stale admin"}})).status()).toBe(401);
 await page.goto("/inventory/manage");await expect(page).toHaveURL(/\/login/);
 await db`UPDATE users SET role='COMPANY_ADMIN' WHERE id=${id}`;
 await login(page);await expect(page).toHaveURL(/\/dashboard$/);
 const cookie=(await page.context().cookies()).find(c=>c.name.endsWith("authjs.session-token"))!;
 await page.context().addCookies([{...cookie,value:"forged."+cookie.value}]);
 expect((await page.request.post("/api/projects",{data:{name:"Tampered"}})).status()).toBe(401);
});
