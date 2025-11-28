import { ScrollArea } from "@/components/ui/scroll-area";

interface ActionsSidebarProps {
  actions: React.ReactNode[];
}

export function ActionsSidebar({ actions }: ActionsSidebarProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <aside className="w-1/4 border-l bg-white flex-shrink-0">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          {actions.map((action, index) => (
            <div key={index}>{action}</div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
