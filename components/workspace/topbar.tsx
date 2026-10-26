import { DisplayPreferences } from "@/components/workspace/display-preferences";
export function WorkspaceTopbar(){
 return <div className="mb-6 flex items-center justify-end rounded-xl border border-[#e5eae9] bg-white px-4 py-3">
   <DisplayPreferences/>
 </div>;
}
