# Dimensionality Reduction with Comprehensive Explainability

## Overview

The dimensionality reduction feature has been enhanced with comprehensive explainability and tracking capabilities. Users can now understand what their DR dimensions represent, track historical runs, and access DR results separately from the original data.

## Key Features

### 1. Separate DR Results Storage

**Database Table**: `data_reduction_results`
- Stores complete metadata for each DR run
- Indexed by user_id and file_id for fast lookups
- Includes run_id for tracking individual transformations

**File Storage**: `dr_results.csv`
- Contains only DR columns (DR1, DR2, ..., DRk) with optional id column
- Saved separately from the main dataset
- Allows viewing DR results independently

### 2. Comprehensive Explainability

#### Run + Output Basics
- **methodUsed**: "mca" or "famd" (auto-detected or user-specified)
- **componentsRequested**: Number of components requested (k)
- **componentsProduced**: Actual components produced
- **rowsInput**: Number of rows in input data
- **rowsOutput**: Number of rows in output (should match input)
- **outputMode**: "append" (DR columns appended to original data)
- **outputColumns**: List of DR column names ["DR1", "DR2", ...]

#### Quality Signal
- **varianceExplained**: Array of variance explained per dimension
  - Example: [28.5, 15.2, 12.1, 8.3, 6.7] for DR1-DR5
- **totalVariance**: Sum of variance explained by all retained dimensions
  - This is the quickest "is it meaningful?" indicator

#### Data Decisions (Explainability)
- **selectedColumns**: Original column names user selected
- **keptColumns**: Columns actually used after filtering
- **droppedColumns**: Columns excluded and why
  - Example: `{"column_name": "Exceeded max_cardinality: 500 > 200"}`

#### Type Handling
- **treatedAsNumeric**: Columns treated as numeric variables
- **treatedAsCategorical**: Columns treated as factors/categories
- **suspectedCodeColumns**: Numeric columns with low unique counts (≤20) forced to categorical
  - Example: status codes, priorities, department IDs

#### Preprocessing Stats
- **missingHandling**: How missing values were handled
  - Default: "blank/NA categorical values -> 'Missing'"
- **rareThreshold**: Minimum frequency to keep category (default: 5)
- **collapsedToOther**: Per-column counts of rare values collapsed to "Other"
  - Example: `{"Priority": 12, "Department": 8}` (12 rare priorities, 8 rare departments)
- **maxCardinality**: Maximum unique values allowed per column (default: 200)
  - Columns exceeding this are dropped

#### Performance + Reproducibility
- **sampleSizeUsed**: Number of rows used for fitting
  - If sampling was used, full data is projected onto fitted model
- **seedUsed**: Random seed used for sampling (default: 42)
  - Ensures reproducibility when sampling
- **runtimeSeconds**: Total execution time in seconds

#### Top Contributions (The Key Insight!)

For each DR dimension (DR1, DR2, ...), the system identifies:

**For MCA (Multiple Correspondence Analysis):**
```json
{
  "DR1": {
    "variables": [
      {"name": "Department", "contribution": 25.3},
      {"name": "Priority", "contribution": 18.7},
      {"name": "IssueType", "contribution": 15.2},
      {"name": "Status", "contribution": 12.1},
      {"name": "Region", "contribution": 8.9}
    ],
    "categoryLevels": [
      {"level": "Department_IT", "quality": 0.756},
      {"level": "Priority_High", "quality": 0.623},
      {"level": "IssueType_Bug", "quality": 0.548},
      {"level": "Status_Open", "quality": 0.492},
      {"level": "Region_North", "quality": 0.387}
    ]
  }
}
```

**For FAMD (Factor Analysis of Mixed Data):**
```json
{
  "DR1": {
    "numericVariables": [
      {"name": "ResponseTime", "contribution": 22.5},
      {"name": "DowntimeMinutes", "contribution": 18.3}
    ],
    "categoricalVariables": [
      {"name": "Department", "contribution": 15.7},
      {"name": "Priority", "contribution": 12.1}
    ],
    "categoryLevels": [
      {"level": "Department_IT", "quality": 0.689},
      {"level": "Priority_High", "quality": 0.567}
    ]
  }
}
```

This allows the UI to display:
> **DR1** is mostly driven by: Department, Priority, IssueType
> 
> **DR2** is mostly driven by: Region, ResponseTime, Status

Instead of just showing random-looking numbers!

## API Endpoints

### 1. Run Dimensionality Reduction
**POST** `/api/files/data-reduction`

Executes dimensionality reduction and stores results in both the database and file system.

**Request:**
```json
{
  "userId": "string",
  "fileId": "string",
  "selected_columns": ["col1", "col2", "col3"],
  "method": "auto",  // "auto", "mca", or "famd"
  "n_components": 5,
  "rare_threshold": 5,
  "max_cardinality": 200,
  "sample_size": null  // optional sampling for large datasets
}
```

**Response:**
```json
{
  "columns": ["id", "col1", "col2", ..., "DR1", "DR2", "DR3"],
  "rows": [...],
  "summary": {
    "methodUsed": "famd",
    "componentsProduced": 5,
    "varianceExplained": [28.5, 15.2, 12.1, 8.3, 6.7],
    "totalVariance": 70.8,
    "topContributions": {
      "DR1": {...},
      "DR2": {...}
    },
    ...
  }
}
```

### 2. Get DR History
**GET** `/api/files/data-reduction/history/{user_id}/{file_id}?limit=10`

Retrieves historical DR runs with full metadata.

**Response:**
```json
{
  "results": [
    {
      "runId": "19b982ea047-83a53ae2c0f4",
      "methodUsed": "famd",
      "componentsProduced": 5,
      "totalVariance": 70.8,
      "createdAt": "2026-01-15T10:30:00",
      ...
    },
    ...
  ]
}
```

### 3. Get DR Table
**GET** `/api/files/data-reduction/table/{user_id}/{file_id}?run_id=optional`

Retrieves the DR results table (DR columns only).

**Response:**
```json
{
  "columns": ["id", "DR1", "DR2", "DR3", "DR4", "DR5"],
  "rows": [
    {"id": "1", "DR1": -0.234, "DR2": 1.567, ...},
    ...
  ],
  "runId": "19b982ea047-83a53ae2c0f4"
}
```

### 4. Get Specific DR Result
**GET** `/api/files/data-reduction/result/{user_id}/{file_id}/{run_id}`

Retrieves a specific DR result with full explainability metadata.

## Database Schema

### Table: `data_reduction_results`

```sql
CREATE TABLE data_reduction_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    run_id TEXT NOT NULL,
    method_used TEXT NOT NULL,
    components_requested INTEGER NOT NULL,
    components_produced INTEGER NOT NULL,
    rows_input INTEGER NOT NULL,
    rows_output INTEGER NOT NULL,
    output_mode TEXT NOT NULL,
    output_columns TEXT NOT NULL,
    variance_explained TEXT,
    total_variance REAL,
    selected_columns TEXT NOT NULL,
    kept_columns TEXT NOT NULL,
    dropped_columns TEXT,
    treated_as_numeric TEXT,
    treated_as_categorical TEXT,
    suspected_code_columns TEXT,
    missing_handling TEXT,
    rare_threshold INTEGER,
    collapsed_to_other TEXT,
    max_cardinality INTEGER,
    sample_size_used INTEGER,
    seed_used INTEGER,
    runtime_seconds REAL,
    top_contributions TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

## Usage Examples

### Frontend Integration

#### Display DR Summary
```typescript
// Show what each dimension represents
if (summary.topContributions) {
  Object.entries(summary.topContributions).forEach(([dim, contrib]) => {
    const topVars = contrib.variables?.slice(0, 3).map(v => v.name);
    console.log(`${dim} is driven by: ${topVars.join(', ')}`);
  });
}
```

#### Show Quality Metrics
```typescript
// Display variance explained with visual indicators
summary.varianceExplained.forEach((variance, idx) => {
  const quality = variance > 20 ? 'High' : variance > 10 ? 'Medium' : 'Low';
  console.log(`DR${idx+1}: ${variance}% variance (${quality} quality)`);
});
```

#### Track Preprocessing Decisions
```typescript
// Show what happened to the data
console.log('Columns used:', summary.keptColumns);
console.log('Columns dropped:', summary.droppedColumns);
console.log('Rare values collapsed:', summary.collapsedToOther);
```

#### View Previous Results
```typescript
// Let users switch between different DR runs
const history = await fetch(`/api/files/data-reduction/history/${userId}/${fileId}`);
const runs = history.results;

// Show dropdown: "Run from 2026-01-15 (FAMD, 5 components, 70.8% variance)"
runs.forEach(run => {
  const label = `${run.createdAt} (${run.methodUsed.toUpperCase()}, ` +
                `${run.componentsProduced} components, ${run.totalVariance}% variance)`;
});
```

## Benefits

1. **Transparency**: Users understand what DR dimensions represent
2. **Trust**: Full visibility into preprocessing decisions and data quality
3. **Reproducibility**: All parameters and seeds are tracked
4. **Debugging**: Easy to identify why columns were dropped or values collapsed
5. **Comparison**: Historical runs allow comparing different DR configurations
6. **Separation**: DR results available independently from main dataset

## Best Practices

### For Users
- Review `topContributions` to understand dimension meanings
- Check `totalVariance` - aim for >60% for meaningful reduction
- Examine `droppedColumns` to ensure important data wasn't excluded
- Use `suspectedCodeColumns` to verify numeric codes were handled correctly

### For Developers
- Always display `topContributions` prominently in the UI
- Show warning if `totalVariance` < 50%
- Provide tooltips explaining each metadata field
- Enable downloading full explainability report as JSON/CSV

## Files Modified

1. **backend/database/db.py**
   - Added `data_reduction_results` table
   - Added `store_dr_result()`, `get_dr_results()`, `get_dr_result_by_run_id()`

2. **backend/R_scripts/data_reduction.R**
   - Added `extract_top_contributions()` helper function
   - Enhanced `reduce_data_csv()` with comprehensive metadata tracking
   - Added `dr_table_path` parameter for separate storage

3. **backend/files/r_integration.py**
   - Updated `handle_data_reduction()` to pass `dr_table_path`
   - Enhanced error handling

4. **backend/files/routes.py**
   - Updated `DataReductionSummary` model with all new fields
   - Enhanced `/data-reduction` endpoint to store results in DB
   - Added `/data-reduction/history` endpoint
   - Added `/data-reduction/table` endpoint
   - Added `/data-reduction/result/{run_id}` endpoint

## Migration Notes

- Database schema auto-migrates on next server start
- Existing DR operations remain compatible (legacy fields preserved)
- No breaking changes to existing API contracts
