# Column Type Filter Implementation

## Overview
Added a UI component in the column selection panel that allows users to filter columns by type (All, Categorical Only, or Numeric Only). This filter is applied globally across all downstream operations including preprocessing, correlation analysis, visualization, and report generation.

## Changes Made

### Frontend Changes

#### 1. **ColumnSelectionPanel Component** (`frontend/vite-project/src/components/ColumnSelectionPanel.tsx`)
- Added `ColumnTypeFilter` type: `"all" | "categorical" | "numeric"`
- Added radio group UI with three options:
  - All Columns (Categorical + Numeric)
  - Categorical Only
  - Numeric Only
- Updated component to track and pass `columnTypeFilter` state
- Added descriptive text explaining the filter applies to all operations

#### 2. **FileStore** (`frontend/vite-project/src/store/fileStore.ts`)
- Added `columnTypeFilter` to `FileState` interface
- Updated `setFile` method to accept `columnTypeFilter` parameter
- Updated `updateColumnSelection` method to include `columnTypeFilter`
- Set default value to `'all'` in `initialState`

#### 3. **HomePage** (`frontend/vite-project/src/features/home/pages/HomePage.tsx`)
- Imported `ColumnTypeFilter` type
- Destructured `columnTypeFilter` from fileStore
- Updated `handleApplyColumnSelection` to accept and pass `columnTypeFilter`
- Updated `handleResetColumnSelection` to reset filter to `'all'`
- Updated `setFile` call to include `columnTypeFilter` from API response
- Passed `currentColumnTypeFilter` prop to `ColumnSelectionPanel`

#### 4. **API Layer** (`frontend/vite-project/src/features/home/api/uploads.ts`)
- Added `columnTypeFilter` to `FileDataResponse` interface
- Added `columnTypeFilter` parameter to `UpdateColumnSelectionParams`
- Updated `updateColumnSelection` function to include `columnTypeFilter` in request

### Backend Changes

#### 1. **Routes** (`backend/files/routes.py`)

**Request Model:**
- Updated `ColumnSelectionRequest` to include `columnTypeFilter: str = "all"`

**Response Model:**
- Updated `FileDataResponse` to include `columnTypeFilter: str = "all"`

**Column Type Detection Logic:**
- Added logic to detect column types after range selection
- Numeric columns: >= 80% of values can be parsed as numbers
- Categorical columns: All non-numeric columns
- Always includes 'id' column regardless of filter

**Endpoints Updated:**
- `POST /api/files/selection`: 
  - Accepts `columnTypeFilter` parameter
  - Applies type-based filtering after range selection
  - Returns filtered columns based on selected type
  - Stores filter preference in metadata

- `GET /api/files/data`:
  - Returns stored `columnTypeFilter` from metadata
  - Defaults to `"all"` for backward compatibility

#### 2. **Database** (`backend/database/db.py`)

**Schema Migration:**
- Added `column_type_filter` column to `files` table with default value `'all'`
- Migration automatically runs on database initialization

**Functions Updated:**
- `upsert_file_metadata()`: Now accepts and stores `column_type_filter` parameter
- `get_file_metadata()`: Returns `column_type_filter` from database (defaults to `'all'`)

## User Flow

1. User uploads a file and navigates to the home page
2. User opens the "Column Selection" panel in the sidebar
3. User selects column ranges using the slider controls
4. User selects column type filter:
   - **All Columns**: No filtering, uses all columns in selected ranges
   - **Categorical Only**: Filters to only categorical columns
   - **Numeric Only**: Filters to only numeric columns
5. User clicks "Apply"
6. Backend processes the selection:
   - Applies range selection
   - Detects column types for selected columns
   - Filters based on user's type preference
   - Stores both ranges and filter preference
7. Filtered columns are used for:
   - Display in data table
   - Preprocessing operations
   - Correlation analysis
   - Visualization generation
   - Report creation

## Column Type Detection

**Numeric Detection:**
- Takes all non-null values from the column
- Attempts to parse each value as a number (handles commas)
- If >= 80% of values parse successfully, column is numeric

**Categorical Detection:**
- Any column that is not numeric
- Text columns with varied content
- Columns with repeated categorical values

**Special Cases:**
- `id` column is always included regardless of filter
- Empty columns are skipped
- Columns with all null values are skipped

## Benefits

1. **Focused Analysis**: Users can analyze only relevant column types
2. **Better Performance**: Reduces data processed in correlation analysis
3. **Cleaner Visualizations**: Excludes irrelevant column types from charts
4. **Simplified Reports**: Reports only include columns of interest
5. **Global Application**: Filter applies consistently across all features

## Backward Compatibility

- Default filter value is `"all"` for existing files
- Migration automatically adds column to existing databases
- Frontend handles missing `columnTypeFilter` gracefully

## Testing Recommendations

1. Upload a mixed dataset (numeric + categorical columns)
2. Apply column ranges
3. Test each filter option:
   - Verify "All" shows all selected columns
   - Verify "Categorical Only" shows only text/categorical columns
   - Verify "Numeric Only" shows only numeric columns
4. Verify filter persists after page reload
5. Test downstream operations use filtered columns:
   - Preprocessing
   - Correlation analysis
   - Visualization
   - Report generation
