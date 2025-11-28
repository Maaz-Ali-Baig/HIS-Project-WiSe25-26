import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Outlet } from "react-router-dom";

export function MainLayout() {
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white">
        <SidebarTrigger className="-ml-1" />
        <div className="font-semibold text-lg">
          Data Pre-Processing Platform
        </div>
      </header>
      <div className="flex flex-1 bg-[#f7f8fb] min-h-[calc(100vh-4rem)] overflow-hidden">
        <Outlet />
      </div>
    </SidebarInset>
  );
}
