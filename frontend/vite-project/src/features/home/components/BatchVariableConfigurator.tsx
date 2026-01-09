/**
 * BatchVariableConfigurator Component
 * Configure variable types and orderings for multiple columns
 */
import React, { useState } from "react";
import type { VariableConfig, VariableType } from "../api/correlation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronUp, ChevronDown, GripVertical } from "lucide-react";

interface BatchVariableConfiguratorProps {
  columns: string[];
  categories: Record<string, string[]>;
  variableConfigs: Record<string, VariableConfig>;
  onConfigChange: (columnName: string, config: VariableConfig) => void;
}

export const BatchVariableConfigurator: React.FC<
  BatchVariableConfiguratorProps
> = ({ columns, categories, variableConfigs, onConfigChange }) => {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  const handleTypeChange = (columnName: string, type: VariableType) => {
    const cats = categories[columnName] || [];
    const config: VariableConfig = {
      columnName,
      type,
      categories: cats,
      ordering: type === "ordinal" ? createDefaultOrdering(cats) : null,
    };
    onConfigChange(columnName, config);
  };

  const handleOrderingChange = (
    columnName: string,
    category: string,
    newRank: number,
  ) => {
    const config = variableConfigs[columnName];
    if (!config || config.type !== "ordinal" || !config.ordering) return;

    const oldRank = config.ordering[category];
    
    // Validate the new rank
    if (isNaN(newRank) || newRank < 1 || newRank > config.categories.length) {
      return;
    }

    // If rank hasn't changed, do nothing
    if (oldRank === newRank) return;

    const newOrdering = { ...config.ordering };
    
    // Update all affected ranks
    if (newRank > oldRank) {
      // Moving down: shift items between oldRank and newRank up by 1
      Object.keys(newOrdering).forEach((cat) => {
        const rank = newOrdering[cat];
        if (cat !== category && rank > oldRank && rank <= newRank) {
          newOrdering[cat] = rank - 1;
        }
      });
    } else {
      // Moving up: shift items between newRank and oldRank down by 1
      Object.keys(newOrdering).forEach((cat) => {
        const rank = newOrdering[cat];
        if (cat !== category && rank >= newRank && rank < oldRank) {
          newOrdering[cat] = rank + 1;
        }
      });
    }
    
    // Set the new rank for the category
    newOrdering[category] = newRank;

    onConfigChange(columnName, { ...config, ordering: newOrdering });
  };

  const moveCategory = (columnName: string, category: string, direction: "up" | "down") => {
    const config = variableConfigs[columnName];
    if (!config || config.type !== "ordinal" || !config.ordering) return;

    const currentRank = config.ordering[category];
    const targetRank = direction === "up" ? currentRank - 1 : currentRank + 1;

    if (targetRank < 1 || targetRank > config.categories.length) return;

    // Find category with target rank and swap
    const categoryToSwap = Object.entries(config.ordering).find(
      ([_, rank]) => rank === targetRank
    )?.[0];

    if (!categoryToSwap) return;

    const newOrdering = { ...config.ordering };
    newOrdering[category] = targetRank;
    newOrdering[categoryToSwap] = currentRank;

    onConfigChange(columnName, { ...config, ordering: newOrdering });
  };

  const handleDragStart = (category: string) => {
    setDraggedItem(category);
  };

  const handleDragOver = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    setDraggedOver(category);
  };

  const handleDrop = (e: React.DragEvent, columnName: string, targetCategory: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetCategory) {
      setDraggedItem(null);
      setDraggedOver(null);
      return;
    }

    const config = variableConfigs[columnName];
    if (!config || config.type !== "ordinal" || !config.ordering) return;

    const draggedRank = config.ordering[draggedItem];
    const targetRank = config.ordering[targetCategory];

    const newOrdering = { ...config.ordering };
    newOrdering[draggedItem] = targetRank;
    newOrdering[targetCategory] = draggedRank;

    onConfigChange(columnName, { ...config, ordering: newOrdering });
    
    setDraggedItem(null);
    setDraggedOver(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedOver(null);
  };

  const createDefaultOrdering = (cats: string[]): Record<string, number> => {
    const ordering: Record<string, number> = {};
    cats.forEach((cat, idx) => {
      ordering[cat] = idx + 1;
    });
    return ordering;
  };

  const isConfigured = (columnName: string): boolean => {
    return !!variableConfigs[columnName];
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium text-foreground">
          Configure Variables
        </h3>
        <Badge variant="outline" className="text-muted-foreground text-xs">
          {columns.length} Variables
        </Badge>
      </div>

      <div className="grid gap-3">
        {columns.map((column) => {
          const config = variableConfigs[column];
          const configured = isConfigured(column);
          const currentType = config?.type;
          const columnCategories = categories[column] || [];

          return (
            <Card
              key={column}
              className={`transition-colors ${
                configured ? "border-primary/20 bg-card" : "border-border/60"
              }`}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">
                      {column}
                    </CardTitle>
                    {configured && (
                      <Badge
                        variant="secondary"
                        className="text-[0.65rem] font-normal py-0 px-1.5"
                      >
                        {config.type}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {columnCategories.length} unique values
                    </span>
                  </div>
                  {!configured && (
                    <Badge variant="outline" className="text-[0.65rem] text-muted-foreground py-0 px-1.5">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pb-3 px-3">
                <div className="grid gap-2 md:grid-cols-12">
                  {/* Left Panel: Categories Preview */}
                  <div className="md:col-span-6">
                    <div className="border rounded bg-muted/5">
                      <div className="p-1.5 border-b bg-muted/20">
                        <Label className="font-medium text-[0.7rem]">
                          Categories
                        </Label>
                      </div>
                      <ScrollArea className="h-[160px]">
                        <div className="p-1.5 flex flex-wrap gap-1">
                          {columnCategories.slice(0, 50).map((cat) => (
                            <Badge
                              key={cat}
                              variant="secondary"
                              className="px-1.5 py-0 text-[0.7rem] bg-background border-border"
                            >
                              {cat}
                            </Badge>
                          ))}
                          {columnCategories.length > 50 && (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[0.7rem] text-muted-foreground"
                            >
                              +{columnCategories.length - 50}
                            </Badge>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  {/* Right Panel: Type Selection and Configuration */}
                  <div className="md:col-span-6">
                    <div className="flex gap-2">
                      <div className="flex-shrink-0 w-[70px]">
                        <Label className="text-xs font-medium mb-1 block">
                          Type
                        </Label>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1">
                            <input
                              type="radio"
                              id={`nominal-${column}`}
                              name={`type-${column}`}
                              value="nominal"
                              checked={currentType === "nominal"}
                              onChange={() => handleTypeChange(column, "nominal")}
                              className="accent-primary h-3 w-3 cursor-pointer"
                            />
                            <Label
                              htmlFor={`nominal-${column}`}
                              className="font-normal cursor-pointer text-xs"
                            >
                              Nominal
                            </Label>
                          </div>
                          <div className="flex items-center space-x-1">
                            <input
                              type="radio"
                              id={`ordinal-${column}`}
                              name={`type-${column}`}
                              value="ordinal"
                              checked={currentType === "ordinal"}
                              onChange={() => handleTypeChange(column, "ordinal")}
                              className="accent-primary h-3 w-3 cursor-pointer"
                            />
                            <Label
                              htmlFor={`ordinal-${column}`}
                              className="font-normal cursor-pointer text-xs"
                            >
                              Ordinal
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Ordinal Configuration */}
                      {currentType === "ordinal" && config?.ordering && (
                        <div className="flex-1 border rounded bg-muted/10">
                          <div className="p-1.5 border-b bg-muted/20 flex items-center justify-between">
                            <Label className="font-medium text-xs">
                              Ranking
                            </Label>
                            <span className="text-[0.7rem] text-muted-foreground">
                              1 = lowest
                            </span>
                          </div>
                          <ScrollArea className="h-[140px]">
                            <Table>
                              <TableHeader>
                                <TableRow className="text-xs border-b">
                                  <TableHead className="w-[24px] h-6 p-0.5"></TableHead>
                                  <TableHead className="h-6 p-1 pl-1.5">Category</TableHead>
                                  <TableHead className="w-[50px] h-6 p-1">Rank</TableHead>
                                  <TableHead className="w-[50px] h-6 p-0.5 text-center">↕</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {config.categories
                                  .sort((a, b) => (config.ordering![a] || 0) - (config.ordering![b] || 0))
                                  .map((cat) => {
                                    const rank = config.ordering![cat];
                                    const isFirst = rank === 1;
                                    const isLast = rank === config.categories.length;
                                    const isDragging = draggedItem === cat;
                                    const isDraggedOver = draggedOver === cat;

                                    return (
                                      <TableRow
                                        key={cat}
                                        className={`hover:bg-muted/40 transition-colors h-6 border-b ${
                                          isDragging ? "opacity-50" : ""
                                        } ${isDraggedOver ? "bg-primary/10" : ""}`}
                                        draggable
                                        onDragStart={() => handleDragStart(cat)}
                                        onDragOver={(e) => handleDragOver(e, cat)}
                                        onDrop={(e) => handleDrop(e, column, cat)}
                                        onDragEnd={handleDragEnd}
                                      >
                                        <TableCell className="text-center cursor-move p-0.5">
                                          <GripVertical className="h-3 w-3 text-muted-foreground mx-auto" />
                                        </TableCell>
                                        <TableCell className="font-medium p-1 pl-1.5 text-xs">
                                          {cat}
                                        </TableCell>
                                        <TableCell className="p-1">
                                          <Input
                                            type="number"
                                            min={1}
                                            max={config.categories.length}
                                            value={rank || ""}
                                            onChange={(e) => {
                                              const value = parseInt(e.target.value);
                                              if (!isNaN(value)) {
                                                handleOrderingChange(column, cat, value);
                                              }
                                            }}
                                            className="h-6 w-11 text-xs px-1"
                                          />
                                        </TableCell>
                                        <TableCell className="p-0.5">
                                          <div className="flex justify-center">
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-5 p-0"
                                              onClick={() => moveCategory(column, cat, "up")}
                                              disabled={isFirst}
                                              title="Move up"
                                            >
                                              <ChevronUp className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-5 p-0"
                                              onClick={() => moveCategory(column, cat, "down")}
                                              disabled={isLast}
                                              title="Move down"
                                            >
                                              <ChevronDown className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                              </TableBody>
                            </Table>
                          </ScrollArea>
                        </div>
                      )}

                      {!currentType && (
                        <div className="flex-1 flex items-center justify-center border rounded border-dashed bg-muted/5 p-2">
                          <p className="text-xs text-muted-foreground text-center">
                            Select a type
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
