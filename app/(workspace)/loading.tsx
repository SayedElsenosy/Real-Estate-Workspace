import {getServerI18n} from "@/lib/i18n/server";
import {LoaderCircle} from "lucide-react";
export default async function WorkspaceLoading(){const {t}=await getServerI18n();return <section role="status" aria-live="polite" className="flex min-h-[55vh] flex-col items-center justify-center gap-4 rounded-2xl bg-white/80 p-10 text-[#17766c]"><LoaderCircle className="size-10 animate-spin"/><h2 className="text-xl font-bold">{t("ui.workspaceLoading")}</h2><p className="text-sm text-slate-500">{t("ui.workspaceLoadingDetail")}</p></section>;}
