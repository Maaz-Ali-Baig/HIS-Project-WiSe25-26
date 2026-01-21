import * as React from "react";
import { X, ChevronDown, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export interface MultiSelectProps {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select columns...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const toggleOption = (option: string) => {
    if (value.includes(option)) {
      onChange(value.filter((v) => v !== option));
    } else {
      onChange([...value, option]);
    }
  };

  const removeOption = (option: string) => {
    onChange(value.filter((v) => v !== option));
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className={cn("space-y-2", className)} ref={containerRef}>
      {/* Dropdown Trigger */}
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="w-full justify-between h-9 font-normal"
        >
          <span className="text-sm text-muted-foreground">
            {value.length === 0
              ? placeholder
              : `${value.length} column${value.length !== 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown
            className={cn(
              "ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </Button>

        {/* Dropdown Content */}
        {open && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
            <div className="p-2">
              {/* Search Input */}
              <Input
                type="text"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 mb-2"
                autoFocus
              />

              {/* Select All / Deselect All Buttons */}
              <div className="flex gap-1 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Select all filtered options
                    const newValue = [...new Set([...value, ...filteredOptions])];
                    onChange(newValue);
                  }}
                  className="h-7 text-xs flex-1"
                  disabled={filteredOptions.length === 0}
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Deselect all filtered options
                    const newValue = value.filter(
                      (v) => !filteredOptions.includes(v)
                    );
                    onChange(newValue);
                  }}
                  className="h-7 text-xs flex-1"
                  disabled={value.length === 0}
                >
                  Deselect All
                </Button>
              </div>

              {/* Options List */}
              <ScrollArea className="h-48">
                <div className="space-y-0.5">
                  {filteredOptions.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No options found
                    </div>
                  ) : (
                    filteredOptions.map((option) => {
                      const isSelected = value.includes(option);
                      return (
                        <div
                          key={option}
                          onClick={() => toggleOption(option)}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 text-sm rounded cursor-pointer transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent",
                          )}
                        >
                          <div className="flex h-4 w-4 items-center justify-center shrink-0">
                            {isSelected && <Check className="h-4 w-4" />}
                          </div>
                          <span className="truncate flex-1">{option}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}
      </div>

      {/* Selected Items as Badges */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-md">
          {value.map((option) => (
            <Badge key={option} variant="default" className="gap-1 pr-1">
              <span className="truncate max-w-[120px]">{option}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeOption(option);
                }}
                className="hover:bg-primary-foreground/20 rounded-sm p-0.5"
                aria-label={`Remove ${option}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
