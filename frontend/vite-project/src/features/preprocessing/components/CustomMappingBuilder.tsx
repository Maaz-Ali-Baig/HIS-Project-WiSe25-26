import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { X, Plus, GripVertical } from "lucide-react";
import { getFileData } from "../../home/api/uploads";

interface CustomMappingBuilderProps {
  userId: string;
  fileId: string;
  selectedColumn: string;
  onMappingChange: (mapping: Record<string, string[]>) => void;
}

interface CategoryGroup {
  id: string;
  name: string;
  categories: string[];
}

export function CustomMappingBuilder({
  userId,
  fileId,
  selectedColumn,
  onMappingChange,
}: CustomMappingBuilderProps) {
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [newGroupName, setNewGroupName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState<{
    category: string;
    fromGroupId?: string;
  } | null>(null);

  // Fetch unique categories from the selected column
  useEffect(() => {
    if (!selectedColumn) return;

    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const data = await getFileData({ userId, fileId });
        const uniqueValues = new Set<string>();
        
        data.rows.forEach((row) => {
          const value = row[selectedColumn];
          if (value && value !== "" && value !== "NA" && value !== "NULL") {
            uniqueValues.add(value);
          }
        });

        setAvailableCategories(Array.from(uniqueValues).sort());
      } catch (error) {
        console.error("Failed to fetch categories:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [userId, fileId, selectedColumn]);

  // Update parent component when groups change
  useEffect(() => {
    const mapping: Record<string, string[]> = {};
    groups.forEach((group) => {
      if (group.categories.length > 0) {
        mapping[group.name] = group.categories;
      }
    });
    onMappingChange(mapping);
  }, [groups, onMappingChange]);

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    
    const newGroup: CategoryGroup = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      categories: [],
    };
    
    setGroups([...groups, newGroup]);
    setNewGroupName("");
  };

  const removeGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      // Return categories to available pool
      setAvailableCategories((prev) => [...prev, ...group.categories].sort());
    }
    setGroups(groups.filter((g) => g.id !== groupId));
  };

  const handleDragStart = (category: string, fromGroupId?: string) => {
    setDraggedCategory({ category, fromGroupId });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnGroup = (targetGroupId: string) => {
    if (!draggedCategory) return;

    const { category, fromGroupId } = draggedCategory;

    setGroups((prevGroups) => {
      return prevGroups.map((group) => {
        // Remove from source group
        if (group.id === fromGroupId) {
          return {
            ...group,
            categories: group.categories.filter((c) => c !== category),
          };
        }
        // Add to target group
        if (group.id === targetGroupId && !group.categories.includes(category)) {
          return {
            ...group,
            categories: [...group.categories, category],
          };
        }
        return group;
      });
    });

    // Remove from available if it was dragged from there
    if (!fromGroupId) {
      setAvailableCategories((prev) => prev.filter((c) => c !== category));
    }

    setDraggedCategory(null);
  };

  const handleDropOnAvailable = () => {
    if (!draggedCategory) return;

    const { category, fromGroupId } = draggedCategory;

    // Only handle if dragged from a group
    if (fromGroupId) {
      setGroups((prevGroups) =>
        prevGroups.map((group) => {
          if (group.id === fromGroupId) {
            return {
              ...group,
              categories: group.categories.filter((c) => c !== category),
            };
          }
          return group;
        })
      );

      setAvailableCategories((prev) => [...prev, category].sort());
    }

    setDraggedCategory(null);
  };

  const removeCategoryFromGroup = (groupId: string, category: string) => {
    setGroups((prevGroups) =>
      prevGroups.map((group) => {
        if (group.id === groupId) {
          return {
            ...group,
            categories: group.categories.filter((c) => c !== category),
          };
        }
        return group;
      })
    );
    setAvailableCategories((prev) => [...prev, category].sort());
  };

  const getUnassignedCategories = () => {
    const assignedCategories = new Set(
      groups.flatMap((group) => group.categories)
    );
    return availableCategories.filter((cat) => !assignedCategories.has(cat));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading categories...</div>;
  }

  if (!selectedColumn) {
    return (
      <div className="text-sm text-muted-foreground">
        Please select a column first to define custom mapping
      </div>
    );
  }

  const unassignedCategories = getUnassignedCategories();

  return (
    <div className="space-y-4">
      {/* Add New Group */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Create Groups</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter group name..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                addGroup();
              }
            }}
          />
          <Button onClick={addGroup} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Group
          </Button>
        </div>
      </div>

      {/* Groups */}
      {groups.length > 0 && (
        <div className="space-y-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="p-3"
              onDragOver={handleDragOver}
              onDrop={() => handleDropOnGroup(group.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">{group.name}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeGroup(group.id)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="min-h-[60px] p-2 border border-dashed rounded-md bg-muted/20">
                {group.categories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Drag categories here
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {group.categories.map((category) => (
                      <div
                        key={category}
                        draggable
                        onDragStart={() => handleDragStart(category, group.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary/10 text-primary rounded cursor-move hover:bg-primary/20"
                      >
                        <GripVertical className="h-3 w-3" />
                        {category}
                        <button
                          onClick={() => removeCategoryFromGroup(group.id, category)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Available Categories */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Available Categories ({unassignedCategories.length})
        </Label>
        <Card
          className="p-3 max-h-[200px] overflow-y-auto"
          onDragOver={handleDragOver}
          onDrop={handleDropOnAvailable}
        >
          {unassignedCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              All categories assigned
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {unassignedCategories.map((category) => (
                <div
                  key={category}
                  draggable
                  onDragStart={() => handleDragStart(category)}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded cursor-move hover:bg-secondary/80"
                >
                  <GripVertical className="h-3 w-3" />
                  {category}
                </div>
              ))}
            </div>
          )}
        </Card>
        <p className="text-xs text-muted-foreground">
          Drag and drop categories into groups above
        </p>
      </div>

      {groups.length === 0 && (
        <p className="text-xs text-amber-600">
          ⚠️ Create at least one group and assign categories to it
        </p>
      )}
    </div>
  );
}
