import { ScrollArea } from "@/components/ui/scroll-area";

interface ActionsSidebarProps {
  actions: React.ReactNode[];
}

export function ActionsSidebar({ actions }: ActionsSidebarProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <aside className="flex h-[calc(100vh-64px)] w-full flex-shrink-0 border-l bg-white overflow-hidden">
      <ScrollArea className="h-full w-full">
        <div className="p-4 space-y-4">
          {actions.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
