/**
 * BatchVariableConfigurator Component
 * Configure variable types and orderings for multiple columns
 */
import React from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BatchVariableConfiguratorProps {
  columns: string[];
  categories: Record<string, string[]>;
  variableConfigs: Record<string, VariableConfig>;
  onConfigChange: (columnName: string, config: VariableConfig) => void;
}

export const BatchVariableConfigurator: React.FC<
  BatchVariableConfiguratorProps
> = ({ columns, categories, variableConfigs, onConfigChange }) => {
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
    order: number,
  ) => {
    const config = variableConfigs[columnName];
    if (!config || config.type !== "ordinal") return;

    const newOrdering = { ...(config.ordering || {}) };
    newOrdering[category] = order;

    onConfigChange(columnName, { ...config, ordering: newOrdering });
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-foreground">
          Configure Variables
        </h3>
        <Badge variant="outline" className="text-muted-foreground">
          {columns.length} Variables
        </Badge>
      </div>

      <div className="grid gap-6">
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
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      {column}
                      {configured && (
                        <Badge
                          variant="secondary"
                          className="text-xs font-normal"
                        >
                          {config.type}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {columnCategories.length} unique values
                    </CardDescription>
                  </div>
                  {!configured && (
                    <Badge variant="outline" className="text-muted-foreground">
                      Pending
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="grid gap-6 md:grid-cols-12">
                  {/* Left Panel: Type Selection */}
                  <div className="md:col-span-4 space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-medium">
                        Variable Type
                      </Label>
                      <div className="space-y-3 mt-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`nominal-${column}`}
                            name={`type-${column}`}
                            value="nominal"
                            checked={currentType === "nominal"}
                            onChange={() => handleTypeChange(column, "nominal")}
                            className="accent-primary h-4 w-4 cursor-pointer"
                          />
                          <Label
                            htmlFor={`nominal-${column}`}
                            className="font-normal cursor-pointer"
                          >
                            Nominal
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`ordinal-${column}`}
                            name={`type-${column}`}
                            value="ordinal"
                            checked={currentType === "ordinal"}
                            onChange={() => handleTypeChange(column, "ordinal")}
                            className="accent-primary h-4 w-4 cursor-pointer"
                          />
                          <Label
                            htmlFor={`ordinal-${column}`}
                            className="font-normal cursor-pointer"
                          >
                            Ordinal
                          </Label>
                        </div>
                      </div>
                      <p className="text-[0.8rem] text-muted-foreground leading-relaxed">
                        {currentType === "nominal"
                          ? "Categories have no intrinsic order (e.g., Color, Gender)."
                          : currentType === "ordinal"
                            ? "Categories have a meaningful rank or order (e.g., Low/Med/High)."
                            : "Select a type to configure this variable."}
                      </p>
                    </div>
                  </div>

                  {/* Right Panel: Configuration or Preview */}
                  <div className="md:col-span-8">
                    {currentType === "ordinal" && config?.ordering ? (
                      <div className="border rounded-md bg-muted/10">
                        <div className="p-4 border-b bg-muted/20">
                          <Label className="font-medium">
                            Category Ranking
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            Assign numerical ranks to categories (1 = lowest
                            rank).
                          </p>
                        </div>
                        <ScrollArea className="h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[60%] pl-6">
                                  Category
                                </TableHead>
                                <TableHead className="w-[40%]">Rank</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {config.categories.map((cat) => (
                                <TableRow
                                  key={cat}
                                  className="hover:bg-muted/40"
                                >
                                  <TableCell className="font-medium pl-6">
                                    {cat}
                                  </TableCell>
                                  <TableCell>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={config.categories.length}
                                      value={config.ordering![cat] || ""}
                                      onChange={(e) =>
                                        handleOrderingChange(
                                          column,
                                          cat,
                                          parseInt(e.target.value) || 0,
                                        )
                                      }
                                      className="h-8 w-24"
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    ) : currentType === "nominal" ? (
                      <div className="border rounded-md p-4 space-y-3 bg-muted/5 h-full">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                          Category Preview
                        </Label>
                        <div className="flex flex-wrap gap-2">
                          {columnCategories.slice(0, 15).map((cat) => (
                            <Badge
                              key={cat}
                              variant="secondary"
                              className="px-2.5 py-1 text-sm bg-background hover:bg-background border-border"
                            >
                              {cat}
                            </Badge>
                          ))}
                          {columnCategories.length > 15 && (
                            <span className="text-xs text-muted-foreground self-center pl-1 font-medium">
                              +{columnCategories.length - 15} more
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="hidden md:flex h-full items-center justify-center border rounded-md border-dashed bg-muted/5 p-8 text-center">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">
                            Select a variable type to begin configuration.
                          </p>
                        </div>
                      </div>
                    )}
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
