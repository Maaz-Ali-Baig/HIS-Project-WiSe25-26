# Data Reduction (MCA/FAMD) - User Guide

This guide explains how to run the Data Reduction feature, what to expect, and how to interpret results.

## 1) Quick start (end-to-end)
1. Start the app:
   - Backend: `npm run start:backend` (or `uvicorn main:app --reload --host 0.0.0.0 --port 8000` in `backend`)
   - Frontend: `npm run start:frontend`
2. Open `http://localhost:5173`.
3. Register or log in.
4. Upload a CSV file.
5. Go to **Pre-Processing**.
6. Open **Data Reduction** in the left sidebar.
7. Choose columns and click **Run Data Reduction**.

## 2) What to observe after running
- The table becomes numeric components only (DR1..DRk) plus `id`.
- A summary appears:
  - Method used (MCA or FAMD)
  - Components count
  - Input vs output columns
  - Variance explained (total + per-component)

Note: Data Reduction **appends DR columns to `selected.csv`**. This is the current behavior.

## 3) Recommended order (prerequisites)
- If you have missing values, run **Handle Missing Values** first.
- Then run **Data Reduction**.

Why: FAMD uses PCA for numeric variables, which fails with missing values.

## 4) Method selection
- **Auto (recommended)**: picks MCA if all selected columns are categorical; otherwise FAMD.
- **MCA**: use only when selected columns are categorical.
- **FAMD**: use when selected columns contain a mix of categorical and numeric.

## 5) Understanding components (k)
- `k` is the number of reduced numeric features to keep.
- Smaller `k` = more compression, less detail.
- Larger `k` = more detail, larger output.
- If variance explained is low, increase `k`.

## 6) Column selection (dropdown)
- Choose which columns are used to compute components.
- Only selected columns influence the reduction.
- Exclude high-cardinality ID-like columns if they add noise.

## 7) Advanced options
- **Rare category threshold**: groups low-frequency categories into "Other".
  - Use when many rare values exist.
- **High-cardinality protection**: skips columns with too many unique values.
  - Use when columns look like IDs or free text.
- **Preview sampling (rows)**: fit on a subset for speed on large datasets.
  - Use for quick testing; set to 0 for full data.

## 8) Example test recipes
### MCA test (categorical-only)
Select: `Sex`, `Embarked`, `storage_class`, `region`, `access_tier`, and a few `ExtraCol*` that contain values like `X/Y/Z` or `low/medium/high`.
Expected: Method = MCA, DR1..DRk output.

### FAMD test (mixed)
Select: `Age`, `Fare`, `Pclass`, `SibSp` (numeric) + `Sex`, `Embarked`, `storage_class` (categorical).
Expected: Method = FAMD. Run **Handle Missing Values** first.

## 9) Common errors
- **FactoMineR not installed**:
  - Install in R: `install.packages('FactoMineR')` and `install.packages('jsonlite')`.
- **Missing values error in FAMD/PCA**:
  - Run **Handle Missing Values** first.

## 10) Notes on current behavior
- Data Reduction **appends** components to the current dataset.
- If you want a separate output, we can change the behavior to save as a derived dataset.

