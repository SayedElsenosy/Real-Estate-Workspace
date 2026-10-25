import "server-only";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
export const MAX_TEMPLATE_BYTES=5*1024*1024;
export type ContractDocxData={customer_name:string;customer_phone:string;unit_number:string;project_name:string;total_amount:string;installment_plan:string;installments:{sequence:number;due_date:string;amount:string}[]};
export function generateContractDocx(template:Buffer,data:ContractDocxData):Buffer{
 if(template.length===0||template.length>MAX_TEMPLATE_BYTES)throw new Error("حجم قالب Word يجب ألا يتجاوز 5 ميجابايت");
 const zip=new PizZip(template);
 const doc=new Docxtemplater(zip,{paragraphLoop:true,linebreaks:true});
 doc.render(data);
 const output=doc.getZip().generate({type:"nodebuffer",compression:"DEFLATE"});
 if(output.length>15*1024*1024)throw new Error("حجم العقد الناتج كبير جدًا");
 return output;
}
