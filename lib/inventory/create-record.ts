import {and,eq,sql} from "drizzle-orm";
import type {PostgresJsDatabase} from "drizzle-orm/postgres-js";
import * as schema from "../db/schema";
import {projects,phases,buildings,units,users} from "../db/schema";
export class InventoryWriteError extends Error{
 constructor(readonly code:string,message:string,readonly status:number){super(message);this.name="InventoryWriteError";}
}
export type InventoryCreate =
 | {kind:"project";name:string;location:string}
 | {kind:"phase";projectId:string;name:string}
 | {kind:"building";phaseId:string;name:string}
 | {kind:"unit";buildingId:string;unitNumber:string;area:string;price:string};
export async function createInventoryRecord(db:PostgresJsDatabase<typeof schema>,identity:{tenantId:string;externalAuthId:string},input:InventoryCreate){
 return db.transaction(async tx=>{
  await tx.execute(sql`SELECT set_config('app.tenant_id',${identity.tenantId},true)`);
  const [actor]=await tx.select({id:users.id,role:users.role}).from(users).where(and(eq(users.tenantId,identity.tenantId),eq(users.externalAuthId,identity.externalAuthId))).limit(1);
  if(!actor)throw new InventoryWriteError("UNAUTHORIZED","المستخدم غير مرتبط بالشركة",401);
  if(actor.role!=="COMPANY_ADMIN")throw new InventoryWriteError("FORBIDDEN","إنشاء المخزون متاح لمدير الشركة فقط",403);
  await tx.execute(sql`select set_config('app.actor_id',${actor.id},true)`);
  const tenantId=identity.tenantId;
  if(input.kind==="project"){
   const [created]=await tx.insert(projects).values({tenantId,name:input.name,location:input.location,status:"PLANNED"}).returning({id:projects.id,name:projects.name});
   return created;
  }
  if(input.kind==="phase"){
   const [parent]=await tx.select({id:projects.id}).from(projects).where(and(eq(projects.tenantId,tenantId),eq(projects.id,input.projectId))).limit(1);
   if(!parent)throw new InventoryWriteError("PARENT_NOT_FOUND","المشروع غير موجود بهذه الشركة",404);
   const [created]=await tx.insert(phases).values({tenantId,projectId:parent.id,name:input.name}).returning({id:phases.id,name:phases.name});
   return created;
  }
  if(input.kind==="building"){
   const [parent]=await tx.select({id:phases.id}).from(phases).where(and(eq(phases.tenantId,tenantId),eq(phases.id,input.phaseId))).limit(1);
   if(!parent)throw new InventoryWriteError("PARENT_NOT_FOUND","المرحلة غير موجودة بهذه الشركة",404);
   const [created]=await tx.insert(buildings).values({tenantId,phaseId:parent.id,name:input.name}).returning({id:buildings.id,name:buildings.name});
   return created;
  }
  const [parent]=await tx.select({id:buildings.id}).from(buildings).where(and(eq(buildings.tenantId,tenantId),eq(buildings.id,input.buildingId))).limit(1);
  if(!parent)throw new InventoryWriteError("PARENT_NOT_FOUND","المبنى غير موجود بهذه الشركة",404);
  const [created]=await tx.insert(units).values({tenantId,buildingId:parent.id,unitNumber:input.unitNumber,area:input.area,price:input.price,status:"AVAILABLE"}).returning({id:units.id,unitNumber:units.unitNumber,status:units.status});
  return created;
 });
}
