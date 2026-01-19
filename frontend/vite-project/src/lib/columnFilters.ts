/**
 * Utility functions for filtering columns based on their type
 */

/**
 * Detects if a column contains datetime/timestamp data
 * @param columnName - The name of the column
 * @param rows - Sample rows to check the data format
 * @returns true if the column appears to contain datetime/timestamp data
 */
export function isDateTimeColumn(columnName: string, rows: Array<Record<string, string>>): boolean {
  // Check column name patterns
  const dateTimeNamePatterns = [
    /date/i, 
    /time/i, 
    /timestamp/i, 
    /datetime/i,
    /_at$/i,  // created_at, updated_at, etc.
    /_date$/i,
    /_time$/i,
    /_ts$/i,  // timestamp suffix
  ];
  
  const hasDateTimeName = dateTimeNamePatterns.some(pattern => 
    pattern.test(columnName)
  );
  
  // Get sample values (up to 50)
  const values = rows
    .slice(0, 50)
    .map((row) => row[columnName])
    .filter((v) => v !== null && v !== undefined && v.trim() !== "");
  
  if (values.length === 0) return false;
  
  // Datetime value patterns - comprehensive list
  const dateTimePatterns = [
    /^\d{4}-\d{2}-\d{2}$/,                      // Date: 2024-01-15
    /^\d{2}\/\d{2}\/\d{4}$/,                    // Date: 01/15/2024
    /^\d{2}-\d{2}-\d{4}$/,                      // Date: 15-01-2024
    /^\d{4}\/\d{2}\/\d{2}$/,                    // Date: 2024/01/15
    /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}$/,        // DateTime: 12-06-2024 13:39
    /^\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}:\d{2}$/,  // DateTime: 12-06-2024 13:39:45
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,     // ISO timestamp: 2024-01-15T14:30:45
    /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/,   // Timestamp: 2024-01-15 14:30:45
    /^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/,       // DateTime: 01/15/2024 14:30
    /^\d{2}:\d{2}:\d{2}$/,                      // Time: 14:30:45
    /^\d{2}:\d{2}$/,                            // Time: 14:30
    /^\d{13}$/,                                 // Unix timestamp milliseconds
    /^\d{10}$/,                                 // Unix timestamp seconds
  ];
  
  // Check if majority of values match datetime patterns
  const matchCount = values.filter(value => 
    dateTimePatterns.some(pattern => pattern.test(value.trim()))
  ).length;
  
  // If column name suggests datetime OR >50% of values match patterns, it's datetime
  return hasDateTimeName || (matchCount / values.length > 0.5);
}

/**
 * Filters out ID columns and datetime columns from a list
 * @param columns - Array of column names
 * @param rows - Data rows for datetime detection
 * @returns Filtered array of column names
 */
export function filterAnalysisColumns(
  columns: string[], 
  rows: Array<Record<string, string>>
): string[] {
  return columns.filter(col => {
    // Filter out id column
    if (col.toLowerCase() === 'id') return false;
    
    // Filter out datetime columns
    if (isDateTimeColumn(col, rows)) return false;
    
    return true;
  });
}

/**
 * Filters out only the ID column
 * @param columns - Array of column names
 * @returns Filtered array of column names
 */
export function filterIdColumn(columns: string[]): string[] {
  return columns.filter(col => col.toLowerCase() !== 'id');
}
