import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs:ClassValue[]){return twMerge(clsx(inputs));}
export function money(value:string, suffix="ج.م") {
  const [whole,fraction="00"]=value.split(".");
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g,",")+"."+fraction.padEnd(2,"0")+" "+suffix;
}
