import type { DataReductionSummary } from "../../home/api/uploads";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface DataReductionSummaryViewProps {
  summary: DataReductionSummary;
}

export function DataReductionSummaryView({ summary }: DataReductionSummaryViewProps) {
  const methodName = summary.method || "Unknown";
  const components = summary.components || 0;

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
              <div className="text-lg font-bold">{components}</div>
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
                <div>DR Columns: <span className="font-semibold">{summary.drColumns || 0}</span></div>
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
        {summary.topContributingVariables && Object.keys(summary.topContributingVariables).length > 0 && (
          <Card className="mb-3">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-xs">Top Contributing Variables by Component</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 px-3">
              <div className="space-y-3">
                {Object.entries(summary.topContributingVariables).map(([component, data]: [string, any]) => {
                  // Handle both old format (array) and new format (object with numericVariables/categoricalVariables)
                  const isNewFormat = data && typeof data === 'object' && !Array.isArray(data);
                  
                  return (
                    <div key={component} className="border rounded-md p-2 bg-muted/30">
                      <div className="font-semibold text-sm mb-2 text-primary">{component}</div>
                      
                      {isNewFormat ? (
                        <div className="space-y-2">
                          {/* Numeric Variables */}
                          {data.numericVariables && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Numeric Variables:</div>
                              <div className="space-y-1">
                                {Array.isArray(data.numericVariables.name) ? (
                                  data.numericVariables.name.map((name: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <Badge variant="default" className="text-xs px-1.5 py-0">{name}</Badge>
                                      <span className="text-muted-foreground">
                                        {data.numericVariables.contribution?.[idx]?.toFixed(2)}%
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-muted-foreground">No data</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Categorical Variables */}
                          {data.categoricalVariables && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Categorical Variables:</div>
                              <div className="space-y-1">
                                {Array.isArray(data.categoricalVariables.name) ? (
                                  data.categoricalVariables.name.map((name: string, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <Badge variant="secondary" className="text-xs px-1.5 py-0">{name}</Badge>
                                      <span className="text-muted-foreground">
                                        {data.categoricalVariables.contribution?.[idx]?.toFixed(2)}%
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-muted-foreground">No data</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Category Levels (quality representation) */}
                          {data.categoryLevels && (
                            <div>
                              <div className="text-xs font-medium text-muted-foreground mb-1">Top Category Levels:</div>
                              <div className="flex flex-wrap gap-1">
                                {Array.isArray(data.categoryLevels.level) && data.categoryLevels.level.slice(0, 5).map((level: string, idx: number) => (
                                  <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                                    {level}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Old format - just array of variable names
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(data) && data.map((variable: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">{variable}</Badge>
                          ))}
                        </div>
                      )}
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

        {/* Missing & Rare Level Handling */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          {summary.missingHandling && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs">Missing Value Handling</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
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
              </CardContent>
            </Card>
          )}

          {summary.rareLevelHandling && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-xs">Rare Level Handling</CardTitle>
              </CardHeader>
              <CardContent className="pb-3 px-3">
                <div className="text-xs space-y-0.5">
                  {summary.rareLevelHandling.rareThreshold && (
                    <div>
                      Threshold: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.rareLevelHandling.rareThreshold}</Badge>
                    </div>
                  )}
                  {summary.rareLevelHandling.rareLevelsReplacedWith && (
                    <div>
                      Replaced with: <Badge variant="secondary" className="text-xs px-1.5 py-0">{summary.rareLevelHandling.rareLevelsReplacedWith}</Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
