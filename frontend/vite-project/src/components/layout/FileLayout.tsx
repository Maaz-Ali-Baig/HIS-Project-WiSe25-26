import { ReactNode } from "react";
import { ActionsSidebar } from "./ActionsSidebar";

interface FileLayoutProps {
  children: ReactNode;
  actions?: React.ReactNode[];
}

export function FileLayout({ children, actions = [] }: FileLayoutProps) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <div className="flex-1 overflow-auto min-w-0">{children}</div>
      {actions.length > 0 && <ActionsSidebar actions={actions} />}
    </div>
  );
}
