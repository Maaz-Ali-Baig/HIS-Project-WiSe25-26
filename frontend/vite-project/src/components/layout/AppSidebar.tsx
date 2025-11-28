import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  BarChart2,
  Upload,
  Settings,
  LogOut,
  User,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

const items = [
  {
    title: "Load Data",
    url: "/",
    icon: Upload,
  },
  {
    title: "Pre-Processing",
    url: "/preprocessing",
    icon: Settings,
  },
  {
    title: "Visualization",
    url: "/visualization",
    icon: BarChart2,
  },
  {
    title: "Report",
    url: "/report",
    icon: FileText,
  },
];

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  mode?: "default" | "auth";
}

export function AppSidebar({ mode = "default", ...props }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getUserInitials = (username: string) => {
    return username
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (mode === "auth") {
    return (
      <Sidebar
        className="border-r-0 text-white bg-[linear-gradient(180deg,#3b5f9e_0%,#345ca8_100%)] [&>[data-sidebar=sidebar]]:!bg-transparent w-full lg:w-1/2 h-screen"
        collapsible="none"
        style={
          { viewTransitionName: "sidebar-container" } as React.CSSProperties
        }
        {...props}
      >
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <div className=" p-6 rounded-3xl mb-8 ">
            <img
              src="/university-logo.png"
              alt="University logo"
              className="h-32 w-auto mx-auto"
              style={
                { viewTransitionName: "sidebar-logo" } as React.CSSProperties
              }
            />
          </div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight max-w-lg">
            Data Pre-Processing Platform for Qualitative Data Analysis
          </h1>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar
      className="border-r-0 text-white bg-[linear-gradient(180deg,#3b5f9e_0%,#345ca8_100%)] [&>[data-sidebar=sidebar]]:!bg-transparent"
      collapsible="icon"
      style={{ viewTransitionName: "sidebar-container" } as React.CSSProperties}
      {...props}
    >
      <SidebarHeader className="h-32 flex items-center justify-center border-b border-white/10">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <div className="p-2 rounded-lg">
            <img
              src={
                state === "collapsed"
                  ? "/logo-compact.png"
                  : "/university-logo.png"
              }
              alt="Logo"
              className="h-18 w-auto"
              style={
                { viewTransitionName: "sidebar-logo" } as React.CSSProperties
              }
            />
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2 gap-2">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={location.pathname === item.url}
                className="text-white/70 hover:text-white hover:bg-white/10 data-[active=true]:bg-white/20 data-[active=true]:text-white transition-colors"
              >
                <Link to={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      {user && (
        <SidebarFooter className="mt-auto border-t border-white/10 p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              {state === "expanded" ? (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white text-xs font-semibold">
                    {getUserInitials(user.username)}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">
                      {user.username}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-1.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white text-xs font-semibold">
                    {getUserInitials(user.username)}
                  </div>
                </div>
              )}
            </SidebarMenuItem>
            <SidebarSeparator className="bg-white/10" />
            <SidebarMenuItem>
              {state === "expanded" ? (
                <Button
                  onClick={handleLogout}
                  variant="ghost"
                  className="w-full justify-start text-white/70 hover:text-white hover:bg-white/10 h-8"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              ) : (
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleLogout}
                        variant="ghost"
                        size="icon"
                        className="w-full h-8 text-white/70 hover:text-white hover:bg-white/10"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="sr-only">Logout</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>Logout</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
