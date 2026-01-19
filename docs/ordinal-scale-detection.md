# Ordinal Scale Detection System

## Overview

A comprehensive system for automatic detection and handling of ordinal scales throughout the project. This system automatically recognizes common ordinal patterns (Likert scales, numeric ranges, quality ratings, etc.) and applies appropriate ordering for visualizations and correlation analysis.

## What Was Implemented

### 1. Backend Python Module (`backend/ordinal_scales.py`)

**Features:**
- 70+ preset ordinal scales covering:
  - Numeric scales (3, 4, 5, 7, 10-point scales)
  - Likert agreement scales (4, 5, 7-point)
  - Satisfaction, happiness, NPS scales
  - Quality, performance, risk, severity scales
  - Frequency, effort, difficulty scales
  - Progress/status, priority scales
  - Education, seniority, experience levels
  - Sizes, star ratings, and more

**Key Functions:**
- `detect_numeric_scale()` - Automatically detects numeric ordinal scales (1-5, 0-10, etc.)
- `detect_ordinal_preset()` - Matches values against 70+ preset scales
- `get_column_order()` - Returns ordering information for any column
- `analyze_dataframe_columns()` - Batch analysis of all columns in a DataFrame
- `get_neutral_point()` - Finds neutral point for Likert-style diverging charts

### 2. R Script Module (`backend/R_scripts/ordinal_scales.R`)

**Mirrors Python functionality for R visualizations:**
- Same 70+ preset definitions
- `detect_numeric_scale()` - Numeric scale detection
- `detect_ordinal_preset()` - Preset matching
- `get_column_order()` - Column ordering info
- `get_neutral_point()` - Neutral point detection for Likert scales
- `apply_ordinal_factor()` - Convert to ordered factor

### 3. Integration with Visualization System

**Updated `backend/R_scripts/visualization.R`:**
- Sources ordinal_scales.R automatically
- **Ordered Bar Charts**: Auto-detects ordinal scales, applies proper ordering
- **Cumulative Percent Charts**: Uses detected ordinal ordering
- **Likert Divergent Charts**: Auto-detects neutral point in Likert scales

**How it works:**
- When user selects "Ordered Bar" or "Cumulative Percent" without specifying levels
- System automatically detects if data matches known ordinal patterns
- Applies appropriate ordering (e.g., "Low < Medium < High")
- Falls back to manual ordering if no pattern detected

### 4. New API Endpoints

#### `/api/visualization/column-metadata/{userId}/{fileId}` (GET)

Returns metadata for all columns including detected ordinal scales.

**Response:**
```json
{
  "columns": {
    "satisfaction": {
      "name": "satisfaction",
      "unique_count": 5,
      "has_missing": false,
      "missing_count": 0,
      "ordinal": {
        "is_ordinal": true,
        "preset_name": "satisfaction_5",
        "levels": ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"],
        "detection_method": "preset"
      }
    },
    "age_group": {
      "name": "age_group",
      "unique_count": 5,
      "has_missing": false,
      "missing_count": 0,
      "ordinal": {
        "is_ordinal": true,
        "preset_name": "numeric_5",
        "levels": ["1", "2", "3", "4", "5"],
        "detection_method": "numeric"
      }
    }
  },
  "row_count": 1000
}
```

#### Updated `/api/correlation/columns` (GET)

Now includes `ordinal_info` in response for automatic ordinal type suggestion in correlation analysis.

**Response:**
```json
{
  "columns": ["satisfaction", "age_group", "department"],
  "categories": {
    "satisfaction": ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"]
  },
  "ordinal_info": {
    "satisfaction": {
      "is_ordinal": true,
      "preset_name": "satisfaction_5",
      "levels": ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"]
    }
  }
}
```

### 5. Frontend Utilities (`frontend/vite-project/src/lib/ordinalScales.ts`)

**Types:**
- `OrdinalInfo` - Information about detected ordinal scale
- `ColumnMetadata` - Column metadata including ordinal info
- `ColumnMetadataResponse` - API response type

**Helper Functions:**
- `getPresetDisplayName()` - Human-readable names for presets
- `shouldSuggestOrdered()` - Check if column should use ordered visualization
- `getOrdinalBadgeText()` - UI badge text for ordinal columns
- `formatLevelsForDisplay()` - Format level order for display

### 6. Updated API Functions

**`frontend/vite-project/src/features/home/api/visualization.ts`:**
- Added `getColumnMetadata()` function to fetch ordinal metadata
- Types imported from ordinalScales module

## How to Use

### For Ordered Bar / Cumulative Percent Charts

**Automatic Detection (No Code Changes Needed):**
```typescript
// When generating ordered bar or cumulative percent:
// System automatically detects ordinal scales

// Example: If column contains ["Low", "Medium", "High"]
// It automatically applies: Low < Medium < High

// If column contains ["1", "2", "3", "4", "5"]
// It automatically orders numerically: 1 < 2 < 3 < 4 < 5
```

**Manual Override (Optional):**
```typescript
await createPlot({
  userId,
  fileId,
  chartType: "ordered_bar",
  xColumn: "satisfaction",
  options: {
    levels: ["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"]
  }
});
```

### For Likert Divergent Charts

**Automatic Neutral Detection:**
```typescript
// System automatically finds "Neutral" in scales like:
// ["Strongly Disagree", "Disagree", "Neutral", "Agree", "Strongly Agree"]

// Or uses middle point for odd-numbered scales without explicit neutral
```

**Manual Neutral Specification:**
```typescript
await createPlot({
  userId,
  fileId,
  chartType: "likert_diverging",
  xColumn: "department",
  yColumn: "satisfaction",
  options: {
    neutral_value: "Neutral"  // or "3" for numeric
  }
});
```

### For Correlation Analysis

**Automatic Ordinal Detection:**
The correlation API now automatically suggests "ordinal" type for columns with detected ordinal scales. Frontend can use this to:
1. Pre-select variable type as "ordinal"
2. Pre-populate ordering
3. Show appropriate correlation methods

### Fetching Column Metadata

```typescript
import { getColumnMetadata } from "@/features/home/api/visualization";
import { shouldSuggestOrdered, formatLevelsForDisplay } from "@/lib/ordinalScales";

// Get metadata
const metadata = await getColumnMetadata(userId, fileId);

// Check if column should use ordered visualization
const column = metadata.columns["satisfaction"];
if (shouldSuggestOrdered(column)) {
  // Show "Recommended: Use Ordered Bar" badge
}

// Display detected ordering
if (column.ordinal?.is_ordinal) {
  const display = formatLevelsForDisplay(column.ordinal.levels);
  // Shows: "very low < low < medium < high < very high"
}
```

## Complete Preset List

### Numeric Scales
- 3-point: 1 < 2 < 3
- 4-point: 1 < 2 < 3 < 4
- 5-point: 1 < 2 < 3 < 4 < 5
- 7-point: 1 < 2 < 3 < 4 < 5 < 6 < 7
- 10-point (0-based): 0 < 1 < ... < 10
- 10-point (1-based): 1 < 2 < ... < 10

### Quality & Performance
- Quality 4-point: Poor < Fair < Good < Excellent
- Quality 5-point: Poor < Fair < Good < Very good < Excellent
- Performance 5-point: Very poor < Poor < Average < Good < Excellent

### Agreement (Likert)
- 4-point (no neutral): Strongly disagree < Disagree < Agree < Strongly agree
- 5-point: Strongly disagree < Disagree < Neutral < Agree < Strongly agree
- 7-point: Strongly disagree < Disagree < Somewhat disagree < Neutral < Somewhat agree < Agree < Strongly agree

### Satisfaction & Sentiment
- Satisfaction: Very dissatisfied < Dissatisfied < Neutral < Satisfied < Very satisfied
- Happiness: Very unhappy < Unhappy < Neutral < Happy < Very happy
- NPS: Very unlikely < Unlikely < Neutral < Likely < Very likely

### Frequency
- 5-point: Never < Rarely < Sometimes < Often < Always
- 6-point: Never < Very rarely < Rarely < Sometimes < Often < Always

### Risk & Severity
- Risk 4-level: Low < Medium < High < Extreme
- Risk 5-level: Very low < Low < Medium < High < Very high
- Severity: None < Low < Medium < High < Critical
- Impact: None < Low < Medium < High < Very high

### Intensity & Effort
- Intensity: None < Low < Medium < High
- Effort: Very low < Low < Medium < High < Very high
- Difficulty: Very easy < Easy < Medium < Hard < Very hard
- Complexity: Simple < Moderate < Complex < Very complex

### Priority & Urgency
- Priority 3-level: Low < Medium < High
- Priority 4-level: Low < Medium < High < Critical
- P-levels: P4 < P3 < P2 < P1
- Urgency: Low < Medium < High < Immediate

### Progress & Status
- Progress 3-level: Not started < In progress < Completed
- Progress 5-level: Not started < Started < In progress < Nearly done < Completed
- Ticket lifecycle: Open < In progress < Resolved < Closed
- Project phase: Planning < Design < Development < Testing < Deployment

### Experience & Education
- Experience: Beginner < Intermediate < Advanced < Expert
- Seniority: Junior < Mid < Senior < Lead < Principal
- Education: Primary < Secondary < High school < Bachelor < Master < Doctorate

### Other Scales
- Sizes: XS < S < M < L < XL < XXL
- Star ratings: 1 star < 2 stars < 3 stars < 4 stars < 5 stars
- Pain scale: None < Mild < Moderate < Severe < Unbearable
- Health status: Very poor < Poor < Fair < Good < Excellent
- Confidence: Very low < Low < Medium < High < Very high
- Probability: Very unlikely < Unlikely < Possible < Likely < Very likely

## Detection Logic

### 1. Numeric Detection
- Checks if all values can be converted to numbers
- Identifies continuous ranges (1-5, 0-10, etc.)
- Matches against numeric preset patterns

### 2. Preset Matching
- Normalizes values (lowercase, trim whitespace)
- Checks if values are subset of any preset
- Returns preset levels filtered to actual values

### 3. Column Name Heuristics
- If column name contains keywords like "priority", "severity", "risk", "level", "stage", "phase", "order", "rank"
- Suggests possible ordinal nature (but doesn't force ordering)

### 4. Manual Override
- Always accepts user-specified `levels` parameter
- User choice takes precedence over auto-detection

## Benefits

1. **Automatic Ordering**: No need to manually specify order for common scales
2. **Consistent Visualizations**: Ordinal data displays in logical order
3. **Better Correlation Analysis**: Appropriate ordinal correlation methods suggested
4. **User Experience**: Less configuration needed, "just works" for standard scales
5. **Flexibility**: Manual override always available for custom or organization-specific scales
6. **Extensible**: Easy to add new preset patterns

## Future Enhancements

Possible additions:
- UI components to display detected ordinal info with badges
- Auto-suggest chart type based on detected scale
- Interactive level reordering in frontend
- Custom preset creation and saving by users
- Language localization support for presets
