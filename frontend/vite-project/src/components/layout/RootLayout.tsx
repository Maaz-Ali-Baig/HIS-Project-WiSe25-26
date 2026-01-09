import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Outlet, useLocation } from "react-router-dom";

export function RootLayout() {
  const location = useLocation();
  const isAuthPage = ["/login", "/register"].includes(location.pathname);
  const mode = isAuthPage ? "auth" : "default";

  return (
    <SidebarProvider
      defaultOpen={true}
      className={isAuthPage ? "flex-col lg:flex-row" : ""}
    >
      <AppSidebar mode={mode} />

      {isAuthPage ? (
        <SidebarInset
          className="p-0 bg-[#f7f8fb] min-h-screen flex flex-col justify-center items-center"
          style={{ viewTransitionName: "auth-content" } as React.CSSProperties}
        >
          <Outlet />
        </SidebarInset>
      ) : (
        <Outlet />
      )}
    </SidebarProvider>
  );
}
