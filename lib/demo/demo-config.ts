/** Fixed demo identities ONLY. Never provision these tenants in a customer database. */
export const DEMO_COMPANIES = [
  { id:"a1111111-1111-4111-8111-111111111111", name:"شركة الأفق للتطوير", slug:"demo-horizon" },
  { id:"b2222222-2222-4222-8222-222222222222", name:"شركة المدار العقارية", slug:"demo-orbit" },
] as const;
export const DEMO_ROLES = ["COMPANY_ADMIN","SALES","ACCOUNTANT"] as const;
export type DemoRole = typeof DEMO_ROLES[number];
export function demoSubject(tenantId:string, role:DemoRole) {
  return "local-demo:" + tenantId + ":" + role;
}
