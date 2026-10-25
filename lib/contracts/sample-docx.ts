import "server-only";
import PizZip from "pizzip";
export function sampleDocx():Buffer{
 const zip=new PizZip();
 zip.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const p=(s:string)=>'<w:p><w:r><w:t xml:space="preserve">'+s+'</w:t></w:r></w:p>';
 const cell=(s:string)=>'<w:tc>'+p(s)+'</w:tc>';
 const row=(a:string[])=>'<w:tr>'+a.map(cell).join("")+'</w:tr>';
 zip.file("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+p("Sale Contract")+p("Customer: {customer_name}")+p("Phone: {customer_phone}")+p("Unit: {unit_number}")+p("Project: {project_name}")+p("Total: {total_amount}")+p("Payment plan: {installment_plan}")+'<w:tbl>'+row(["Sequence","Due","Amount"])+row(["{#installments}{sequence}","{due_date}","{amount}{/installments}"])+'</w:tbl>'+p("Signature: __________________")+'<w:sectPr/></w:body></w:document>');
 return zip.generate({type:"nodebuffer",compression:"DEFLATE"});
}
