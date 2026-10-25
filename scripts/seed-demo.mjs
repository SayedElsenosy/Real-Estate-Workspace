import postgres from "postgres";
import { DEMO_COMPANIES, DEMO_ROLES, demoSubject } from "../lib/demo/demo-config.ts";

const url = process.env.DATABASE_URL_ADMIN;
const databaseName = url ? new URL(url).pathname.slice(1) : "";
if (!url || process.env.ENABLE_LOCAL_MOCK_LOGIN!=="true" ||
    process.env.DEMO_SEED_ALLOW!=="I_ACKNOWLEDGE_DEMO_ONLY" ||
    !(databaseName==="foundation_test" || databaseName.endsWith("_demo"))) {
  throw new Error("Refusing to seed: requires demo-only database, ENABLE_LOCAL_MOCK_LOGIN, and explicit DEMO_SEED_ALLOW");
}
const sql=postgres(url,{max:1,prepare:false});
const mk=(n)=> n.toString(16).padStart(8,"0")+"-0000-4000-8000-"+n.toString(16).padStart(12,"0");
try {
  // No destructive reset: conflict-safe inserts won't overwrite a user's booking progress.
  for(const tenant of DEMO_COMPANIES) {
    await sql`INSERT INTO public.tenants(tenant_id,name,slug) VALUES(${tenant.id},${tenant.name},${tenant.slug})
      ON CONFLICT (tenant_id) DO NOTHING`;
    for(const role of DEMO_ROLES) {
      const email=role.toLowerCase()+"@"+tenant.slug+".example.invalid";
      await sql`INSERT INTO public.users(tenant_id,email,full_name,role,external_auth_id)
        VALUES(${tenant.id},${email},${role==="COMPANY_ADMIN"?"مدير الشركة":role==="SALES"?"مسؤول المبيعات":"المحاسب"},${role},${demoSubject(tenant.id,role)})
        ON CONFLICT DO NOTHING`;
    }
  }
  const items=[
    {t:DEMO_COMPANIES[0].id,id:mk(101),name:"أبراج النخيل",location:"الشيخ زايد، الجيزة"},
    {t:DEMO_COMPANIES[0].id,id:mk(102),name:"حدائق أوريون",location:"6 أكتوبر، الجيزة"},
    {t:DEMO_COMPANIES[1].id,id:mk(103),name:"ريزيدنس المدار",location:"القاهرة الجديدة"},
  ];
  for(const item of items){
    const ph=mk(200+Number.parseInt(item.id.slice(0,8),16)%100);
    const bu=mk(300+Number.parseInt(item.id.slice(0,8),16)%100);
    await sql`INSERT INTO public.projects(id,tenant_id,name,location,status)
      VALUES(${item.id},${item.t},${item.name},${item.location},'ACTIVE')
      ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO public.phases(id,tenant_id,project_id,name)
      VALUES(${ph},${item.t},${item.id},'المرحلة الأولى') ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO public.buildings(id,tenant_id,phase_id,name)
      VALUES(${bu},${item.t},${ph},'المبنى A') ON CONFLICT (id) DO NOTHING`;
    const count=item.t===DEMO_COMPANIES[0].id?4:2;
    for(let i=1;i<=count;i++){
      const n=Number.parseInt(item.id.slice(0,8),16)*10+i;
      const unitId=mk(n);
      const status=i===4?"SOLD":"AVAILABLE";
      const price=["1750000.00","2100000.50","2500000.01","3200000.00"][i-1];
      await sql`INSERT INTO public.units(id,tenant_id,building_id,unit_number,area,price,status)
        VALUES(${unitId},${item.t},${bu},${"A-"+(100+i)},${"85.50"},${price},${status}::unit_status)
        ON CONFLICT (id) DO NOTHING`;
    }
  }
  console.log("Seeded two demo-only tenants, six role accounts and realistic inventory; existing bookings preserved");
} finally { await sql.end(); }
