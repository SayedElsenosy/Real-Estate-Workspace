const cairoFormatter=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",calendar:"gregory"});
/** Egypt business calendar date in YYYY-MM-DD, independent of server timezone. */
export function businessDate(value:Date|string):string{
 if(typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
 const date=value instanceof Date?value:new Date(value);
 if(Number.isNaN(date.getTime()))throw new RangeError("Invalid business date");
 const parts=cairoFormatter.formatToParts(date);
 const get=(type:string)=>parts.find(p=>p.type===type)?.value;
 return `${get("year")}-${get("month")}-${get("day")}`;
}
