import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";

export function PersistentLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === "/login" || location.pathname === "/register";

  useEffect(() => {
    console.log(`[PersistentLayout] MOUNTED`);
    return () => {
      console.log(`[PersistentLayout] UNMOUNTED`);
    };
  }, []);

  useEffect(() => {
    console.log(`[PersistentLayout] Route changed to: ${location.pathname}`);
  }, [location.pathname]);

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar mode={isAuthPage ? "auth" : "default"} />
      
      {isAuthPage ? (
        // Auth pages: just render the form (LoginPage/RegisterPage will render the card)
        <div className="flex-1 flex items-center justify-center bg-[#f7f8fb] p-8">
          <Outlet />
        </div>
      ) : (
        // Protected pages: use SidebarInset with header
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 bg-white">
            <SidebarTrigger className="-ml-1" />
            <div className="font-semibold text-lg">Data Pre-Processing Platform</div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 bg-[#f7f8fb] min-h-[calc(100vh-4rem)]">
            <Outlet />
          </div>
        </SidebarInset>
      )}
    </SidebarProvider>
  );
}
