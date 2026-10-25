import { getVerifiedWorkspaceSession } from "@/lib/workspace/server-data";
import { Sidebar } from "@/components/workspace/sidebar";
export const dynamic="force-dynamic";
export default async function WorkspaceLayout({children}:{children:React.ReactNode}) {
 const identity=await getVerifiedWorkspaceSession();
 return <div className="min-h-screen bg-[#f7faf9] md:flex">
   <Sidebar companyName={identity.companyName} role={identity.role}/>
   <main className="min-w-0 flex-1 px-4 pb-12 pt-8 sm:px-8 md:px-11 md:pt-11"><div className="mx-auto max-w-[1270px]">{children}</div></main>
 </div>;
}
