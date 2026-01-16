import type { DataReductionSummary } from "../../home/api/uploads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DataReductionSummaryViewProps {
  summary: DataReductionSummary;
}

export function DataReductionSummaryView({ summary }: DataReductionSummaryViewProps) {
  const methodName = summary.methodUsed || summary.method || "Unknown";
  const componentsProduced = summary.componentsProduced || summary.components || 0;
  const componentsRequested = summary.componentsRequested || summary.components || 0;

  return (
    <div className="w-full p-4 space-y-4 bg-background">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-lg font-semibold mb-4">Data Reduction Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {/* Method Card */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Method</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <Badge variant="secondary" className="text-sm px-2 py-0.5">
                {methodName.toUpperCase()}
              </Badge>
            </CardContent>
          </Card>

          {/* Components Card */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Components</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-lg font-bold">
                {componentsProduced}
                {componentsRequested !== componentsProduced && (
                  <span className="text-xs text-muted-foreground ml-2">
                    (requested: {componentsRequested})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Columns Card */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Columns</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xs space-y-0.5">
                <div>Input: <span className="font-semibold">{summary.inputColumns || 0}</span></div>
                <div>Original: <span className="font-semibold">{summary.originalColumns || 0}</span></div>
                <div>Total Output: <span className="font-semibold">{summary.outputColumns || 0}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Rows Card */}
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground">Rows</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xs space-y-0.5">
                <div>Input: <span className="font-semibold">{summary.rowsInput?.toLocaleString() || 0}</span></div>
                {summary.rowsUsedForFit && summary.rowsUsedForFit !== summary.rowsInput && (
                  <div>Used for Fit: <span className="font-semibold">{summary.rowsUsedForFit.toLocaleString()}</span></div>
                )}
                {summary.seedUsed && (
                  <div>Seed: <span className="font-semibold">{summary.seedUsed}</span></div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Variance Card */}
          {(summary.totalVariance || summary.varianceExplained) && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Variance Explained</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {summary.totalVariance && (
                  <div className="text-lg font-bold mb-1">
                    {summary.totalVariance.toFixed(2)}%
                  </div>
                )}
                {summary.varianceExplained && summary.varianceExplained.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    Top 3: {summary.varianceExplained.slice(0, 3).map(v => v.toFixed(2)).join("%, ")}%
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Runtime Card */}
          {summary.runtimeSeconds !== undefined && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">Processing Time</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="text-lg font-bold">
                  {summary.runtimeSeconds.toFixed(2)}s
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Selected Columns */}
        {summary.selectedColumns && Array.isArray(summary.selectedColumns) && summary.selectedColumns.length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Selected Columns ({summary.selectedColumns.length})</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="flex flex-wrap gap-1">
                {summary.selectedColumns.map((col, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">{col}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* DR Column Names */}
        {summary.drColumnNames && Array.isArray(summary.drColumnNames) && summary.drColumnNames.length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Dimension Reduction Columns ({summary.drColumnNames.length})</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="flex flex-wrap gap-1">
                {summary.drColumnNames.map((col, idx) => (
                  <Badge key={idx} variant="default" className="text-xs px-1.5 py-0">{col}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Variance Explained Per Component */}
        {summary.varianceExplained && Array.isArray(summary.varianceExplained) && summary.varianceExplained.length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Variance Explained by Component</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="space-y-1.5">
                {summary.varianceExplained.map((variance, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-medium min-w-[70px]">
                      {summary.drColumnNames?.[idx] || `Component ${idx + 1}`}:
                    </span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-primary h-full flex items-center justify-end pr-1.5 text-[10px] text-primary-foreground font-medium"
                        style={{ width: `${Math.min(variance, 100)}%` }}
                      >
                        {variance > 5 && `${variance.toFixed(2)}%`}
                      </div>
                    </div>
                    {variance <= 5 && (
                      <span className="text-[10px] text-muted-foreground min-w-[45px]">
                        {variance.toFixed(2)}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Contributing Variables */}
        {(summary.topContributions || summary.topContributingVariables) && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Top Contributing Variables</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="space-y-2">
                {Object.entries(summary.topContributions || summary.topContributingVariables || {}).map(([component, variables]) => {
                  // Ensure variables is an array
                  const variablesArray = Array.isArray(variables) ? variables : [];
                  
                  return (
                    <div key={component} className="border-b pb-2 last:border-b-0">
                      <div className="font-medium text-xs mb-1.5">{component}</div>
                      <div className="flex flex-wrap gap-1">
                        {variablesArray.map((variable, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">{variable}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dropped Columns */}
        {summary.droppedColumns && Array.isArray(summary.droppedColumns) && summary.droppedColumns.length > 0 && (
          <Card className="mb-3 border-amber-200">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs text-amber-700">Dropped Columns ({summary.droppedColumns.length})</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="space-y-1.5">
                {summary.droppedColumns.map((dropped, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-1.5 bg-amber-50 rounded">
                    <Badge variant="outline" className="mt-0.5 text-xs px-1.5 py-0">{dropped.column}</Badge>
                    <div className="flex-1 text-xs">
                      <div className="text-muted-foreground">
                        Reason: <span className="font-medium text-foreground">{dropped.reason}</span>
                      </div>
                      {dropped.uniqueLevels && (
                        <div className="text-[10px] text-muted-foreground">
                          Unique levels: {dropped.uniqueLevels}
                          {dropped.threshold && ` (threshold: ${dropped.threshold})`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Column Treatment */}
        {((summary.treatedAsNumeric && summary.treatedAsNumeric.length > 0) || 
          (summary.treatedAsCategorical && summary.treatedAsCategorical.length > 0)) && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Column Treatment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3 px-3">
              {summary.treatedAsNumeric && Array.isArray(summary.treatedAsNumeric) && summary.treatedAsNumeric.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1.5">Treated as Numeric ({summary.treatedAsNumeric.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {summary.treatedAsNumeric.map((col, idx) => (
                      <Badge key={idx} variant="outline" className="bg-blue-50 text-xs px-1.5 py-0">{col}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {summary.treatedAsCategorical && Array.isArray(summary.treatedAsCategorical) && summary.treatedAsCategorical.length > 0 && (
                <div>
                  <div className="text-xs font-medium mb-1.5">Treated as Categorical ({summary.treatedAsCategorical.length})</div>
                  <div className="flex flex-wrap gap-1">
                    {summary.treatedAsCategorical.map((col, idx) => (
                      <Badge key={idx} variant="outline" className="bg-green-50 text-xs px-1.5 py-0">{col}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Missing & Rare Level Handling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {summary.missingHandling && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs">Missing Value Handling</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                {typeof summary.missingHandling === 'string' ? (
                  <div className="text-xs">{summary.missingHandling}</div>
                ) : (
                  <div className="text-xs">
                    {summary.missingHandling.categoricalBlankOrNAReplacedWith && (
                      <div>
                        Categorical blanks/NA replaced with:{" "}
                        <Badge variant="secondary" className="text-xs px-1.5 py-0">
                          {summary.missingHandling.categoricalBlankOrNAReplacedWith}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(summary.rareLevelHandling || summary.rareThreshold) && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs">Rare Level Handling</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="text-xs space-y-0.5">
                  {summary.rareThreshold && (
                    <div>
                      Threshold: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.rareThreshold}</Badge>
                    </div>
                  )}
                  {summary.rareLevelHandling?.rareLevelsReplacedWith && (
                    <div>
                      Replaced with: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.rareLevelHandling.rareLevelsReplacedWith}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Collapsed to Other */}
        {summary.collapsedToOther && Object.keys(summary.collapsedToOther).length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Collapsed Rare Categories</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="space-y-2">
                {Object.entries(summary.collapsedToOther).map(([column, categories]) => {
                  const categoriesArray = Array.isArray(categories) ? categories : [];
                  return (
                    <div key={column} className="border-b pb-2 last:border-b-0">
                      <div className="font-medium text-xs mb-1.5">{column}</div>
                      <div className="flex flex-wrap gap-1 text-[10px]">
                        {categoriesArray.map((cat, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] px-1 py-0">{cat}</Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Settings */}
        {(summary.maxCardinality || summary.outputMode) && (
          <Card>
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Additional Settings</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="text-xs space-y-1.5">
                {summary.outputMode && (
                  <div>
                    Output Mode: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.outputMode}</Badge>
                  </div>
                )}
                {summary.maxCardinality && (
                  <div>
                    Max Cardinality: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.maxCardinality}</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
