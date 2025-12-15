import { ReactNode } from "react";
import { ActionsSidebar } from "./ActionsSidebar";

interface FileLayoutProps {
  children: ReactNode;
  actions?: React.ReactNode[];
}

export function FileLayout({ children, actions = [] }: FileLayoutProps) {
  const hasActions = actions.length > 0;

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 overflow-hidden">
      <div className="flex-1 min-w-0 min-h-0 overflow-auto">{children}</div>
      {hasActions && (
        <div className="h-full min-h-0 flex-shrink-0">
          <ActionsSidebar actions={actions} />
        </div>
      )}
    </div>
  );
}
