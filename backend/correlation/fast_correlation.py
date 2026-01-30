"""
High-Performance Correlation Analysis Engine
Uses vectorized operations, parallel processing, and batch computation
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple, Any, Literal
from scipy import stats
from scipy.stats import chi2_contingency
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing as mp
from functools import partial
import warnings

warnings.filterwarnings('ignore')

# Optimize NumPy for performance
np.seterr(divide='ignore', invalid='ignore')


# ==================== Vectorized Correlation Methods ====================

def cramers_v_vectorized(contingency_table: np.ndarray) -> Tuple[float, float]:
    """
    Compute Cramér's V and p-value from contingency table
    
    Args:
        contingency_table: 2D numpy array (contingency table)
        
    Returns:
        (cramers_v, p_value)
    """
    try:
        chi2, p_value, dof, expected = chi2_contingency(contingency_table)
        n = contingency_table.sum()
        min_dim = min(contingency_table.shape[0] - 1, contingency_table.shape[1] - 1)
        
        if min_dim == 0 or n == 0:
            return 0.0, 1.0
        
        cramers_v = np.sqrt(chi2 / (n * min_dim))
        return float(cramers_v), float(p_value)
    except:
        return 0.0, 1.0


def chi_square_vectorized(contingency_table: np.ndarray) -> Dict[str, Any]:
    """
    Compute Chi-square test of independence
    
    Returns:
        Dict with statistic, p_value, df, effect_size
    """
    chi2, p_value, dof, expected = chi2_contingency(contingency_table)
    cramers_v, _ = cramers_v_vectorized(contingency_table)
    
    return {
        "statistic": float(chi2),
        "p_value": float(p_value),
        "df": int(dof),
        "effect_size": cramers_v,
        "effect_size_name": "Cramer's V"
    }


def phi_coefficient_vectorized(contingency_table: np.ndarray) -> Dict[str, Any]:
    """
    Compute Phi coefficient for 2x2 tables
    
    Returns:
        Dict with statistic, p_value, effect_size
    """
    if contingency_table.shape != (2, 2):
        return {"error": "Phi coefficient requires 2x2 table"}
    
    chi2, p_value, dof, expected = chi2_contingency(contingency_table)
    n = contingency_table.sum()
    phi = np.sqrt(chi2 / n)
    
    return {
        "statistic": float(phi),
        "p_value": float(p_value),
        "effect_size": float(phi),
        "effect_size_name": "Phi"
    }


def spearman_vectorized(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Compute Spearman rank correlation (optimized)
    
    Args:
        x, y: Numeric arrays (already converted from ordinal)
        
    Returns:
        Dict with statistic, p_value, effect_size
    """
    # Remove NaN pairs
    mask = ~(np.isnan(x) | np.isnan(y))
    x_clean = x[mask]
    y_clean = y[mask]
    
    if len(x_clean) < 3:
        return {"error": "Insufficient data (need at least 3 observations)"}
    
    # Scipy's spearmanr is already optimized
    rho, p_value = stats.spearmanr(x_clean, y_clean)
    
    return {
        "statistic": float(rho),
        "p_value": float(p_value),
        "effect_size": float(rho),
        "effect_size_name": "Spearman's ρ"
    }


def kendall_vectorized(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Compute Kendall's tau-b (optimized with 'auto' method)
    
    Args:
        x, y: Numeric arrays
        
    Returns:
        Dict with statistic, p_value, effect_size
    """
    mask = ~(np.isnan(x) | np.isnan(y))
    x_clean = x[mask]
    y_clean = y[mask]
    
    if len(x_clean) < 3:
        return {"error": "Insufficient data"}
    
    # Use 'auto' for optimal algorithm selection
    tau, p_value = stats.kendalltau(x_clean, y_clean, method='auto')
    
    return {
        "statistic": float(tau),
        "p_value": float(p_value),
        "effect_size": float(tau),
        "effect_size_name": "Kendall's τb",
        "z_value": float(tau * np.sqrt(9 * len(x_clean) * (len(x_clean) - 1) / (2 * (2 * len(x_clean) + 5))))
    }


def kendall_batch_optimized(ordinal_df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    """
    OPTIMIZED: Compute Kendall's tau for all pairs using batch processing
    Uses 'auto' method for optimal algorithm selection and float32 for efficiency
    
    Args:
        ordinal_df: DataFrame with ordinal columns as numeric
        
    Returns:
        (correlation_matrix, p_value_matrix) as numpy arrays
    """
    n_cols = ordinal_df.shape[1]
    tau_matrix = np.ones((n_cols, n_cols), dtype=np.float32)
    p_matrix = np.zeros((n_cols, n_cols), dtype=np.float32)
    
    # Pre-convert to numpy array for faster access
    cols = ordinal_df.values.T
    
    # Compute upper triangle (lower is mirror)
    for i in range(n_cols):
        for j in range(i + 1, n_cols):
            mask = ~(np.isnan(cols[i]) | np.isnan(cols[j]))
            if mask.sum() >= 3:
                # Use 'auto' for optimal algorithm
                tau, p_val = stats.kendalltau(cols[i][mask], cols[j][mask], method='auto')
                tau_matrix[i, j] = tau_matrix[j, i] = tau
                p_matrix[i, j] = p_matrix[j, i] = p_val
    
    return tau_matrix, p_matrix


def pearson_vectorized(x: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Compute Pearson correlation (for ordinal as numeric)
    
    Args:
        x, y: Numeric arrays
        
    Returns:
        Dict with statistic, p_value, confidence_interval, effect_size
    """
    mask = ~(np.isnan(x) | np.isnan(y))
    x_clean = x[mask]
    y_clean = y[mask]
    
    if len(x_clean) < 3:
        return {"error": "Insufficient data"}
    
    r, p_value = stats.pearsonr(x_clean, y_clean)
    
    # Compute 95% confidence interval using Fisher z-transformation
    n = len(x_clean)
    z = np.arctanh(r)
    se = 1 / np.sqrt(n - 3)
    z_crit = 1.96  # 95% CI
    ci_lower = np.tanh(z - z_crit * se)
    ci_upper = np.tanh(z + z_crit * se)
    
    return {
        "statistic": float(r),
        "p_value": float(p_value),
        "confidence_interval": [float(ci_lower), float(ci_upper)],
        "effect_size": float(r),
        "effect_size_name": "Pearson r"
    }


# ==================== Batch Matrix Computation ====================

def compute_correlation_matrix_batch(
    df: pd.DataFrame,
    columns: List[str],
    variable_configs: Dict[str, Dict[str, Any]],
    methods_by_pair_type: Dict[str, str],
    missing_value_method: Literal["remove", "mode", "median", "missing_category"] = "remove"
) -> Dict[str, Any]:
    """
    Compute full correlation matrix using vectorized batch operations
    
    Args:
        df: Full dataframe
        columns: List of column names to analyze
        variable_configs: Dict mapping column names to their configs (type, categories, ordering)
        methods_by_pair_type: Dict mapping pair types to methods
        missing_value_method: How to handle missing values
        
    Returns:
        Dict with matrix data and pair details
    """
    n_cols = len(columns)
    n_pairs = (n_cols * (n_cols - 1)) // 2
    
    print(f"🚀 Computing {n_pairs:,} correlations for {n_cols} columns...")
    
    # Prepare data: convert all columns to appropriate format (optimized for memory)
    processed_data = {}
    for col in columns:
        config = variable_configs[col]
        col_type = config["type"]
        
        if col_type == "ordinal":
            # Convert ordinal to numeric using ordering (float32 for memory efficiency)
            ordering = config.get("ordering", {})
            if ordering:
                # Map categories to numeric values
                processed_data[col] = df[col].map(ordering).astype(np.float32)
            else:
                # Create natural ordering
                unique_vals = sorted(df[col].dropna().unique())
                ordering = {val: i for i, val in enumerate(unique_vals)}
                processed_data[col] = df[col].map(ordering).astype(np.float32)
        else:
            # Keep nominal as categorical (category dtype for memory efficiency)
            processed_data[col] = df[col].astype('category')
    
    processed_df = pd.DataFrame(processed_data)
    
    # Separate columns by type for efficient batch processing
    ordinal_cols = [col for col in columns if variable_configs[col]["type"] == "ordinal"]
    nominal_cols = [col for col in columns if variable_configs[col]["type"] == "nominal"]
    
    pair_results = {}
    
    # Strategy 1: Batch process all ordinal-ordinal pairs using matrix operations
    if len(ordinal_cols) > 1:
        print(f"⚡ Processing {len(ordinal_cols)} ordinal columns in batch (VECTORIZED)...")
        ordinal_df = processed_df[ordinal_cols].astype(float)
        
        # Get method for ordinal-ordinal
        ord_ord_method = methods_by_pair_type.get("ordinal-ordinal", "spearman")
        
        if ord_ord_method == "spearman":
            # Compute full Spearman correlation matrix at once (VERY FAST)
            corr_matrix = ordinal_df.corr(method='spearman')
            
            # Compute p-values using vectorized approach
            n = len(ordinal_df.dropna())
            with np.errstate(divide='ignore', invalid='ignore'):
                t_stat = corr_matrix.values * np.sqrt((n - 2) / (1 - corr_matrix.values**2 + 1e-10))
            p_values = 2 * stats.t.sf(np.abs(t_stat), n - 2)
            
            # Extract upper triangle (i < j pairs)
            for i in range(len(ordinal_cols)):
                for j in range(i + 1, len(ordinal_cols)):
                    col_i = ordinal_cols[i]
                    col_j = ordinal_cols[j]
                    
                    corr_val = corr_matrix.iloc[i, j]
                    p_val = p_values[i, j]
                    
                    pair_results[f"{col_i}::{col_j}"] = {
                        "method": "spearman",
                        "method_name": "Spearman's rank correlation",
                        "result": {
                            "statistic": float(corr_val),
                            "p_value": float(p_val),
                            "effect_size": float(corr_val),
                            "effect_size_name": "Spearman's ρ",
                            "interpretation": f"Spearman's ρ = {corr_val:.3f}. " +
                                            ("Weak" if abs(corr_val) < 0.3 else 
                                             ("Moderate" if abs(corr_val) < 0.7 else "Strong")) +
                                            f" {'positive' if corr_val > 0 else 'negative'} correlation. " +
                                            ("Significant (p < 0.05)" if p_val < 0.05 else "Not significant (p >= 0.05)")
                        },
                        "variable1_name": col_i,
                        "variable2_name": col_j,
                        "sample_size": n
                    }
        
        elif ord_ord_method == "pearson_ordinal":
            # Compute Pearson correlation matrix (even faster)
            corr_matrix = ordinal_df.corr(method='pearson')
            n = len(ordinal_df.dropna())
            with np.errstate(divide='ignore', invalid='ignore'):
                t_stat = corr_matrix.values * np.sqrt((n - 2) / (1 - corr_matrix.values**2 + 1e-10))
            p_values = 2 * stats.t.sf(np.abs(t_stat), n - 2)
            
            for i in range(len(ordinal_cols)):
                for j in range(i + 1, len(ordinal_cols)):
                    col_i = ordinal_cols[i]
                    col_j = ordinal_cols[j]
                    
                    corr_val = corr_matrix.iloc[i, j]
                    p_val = p_values[i, j]
                    
                    pair_results[f"{col_i}::{col_j}"] = {
                        "method": "pearson_ordinal",
                        "method_name": "Pearson correlation on ordinal scores",
                        "result": {
                            "statistic": float(corr_val),
                            "p_value": float(p_val),
                            "effect_size": float(corr_val),
                            "effect_size_name": "Pearson r",
                            "interpretation": f"Pearson r = {corr_val:.3f}. " +
                                            ("Weak" if abs(corr_val) < 0.3 else 
                                             ("Moderate" if abs(corr_val) < 0.7 else "Strong")) +
                                            f" {'positive' if corr_val > 0 else 'negative'} linear relationship. " +
                                            ("Significant (p < 0.05)" if p_val < 0.05 else "Not significant (p >= 0.05)")
                        },
                        "variable1_name": col_i,
                        "variable2_name": col_j,
                        "sample_size": n
                    }
        
        elif ord_ord_method == "kendall_tau":
            # OPTIMIZED: Batch processing with optimized algorithm
            print(f"⚡ Computing Kendall tau (batch optimized)...")
            tau_matrix, p_matrix = kendall_batch_optimized(ordinal_df)
            n = len(ordinal_df)
            
            for i in range(len(ordinal_cols)):
                for j in range(i + 1, len(ordinal_cols)):
                    col_i = ordinal_cols[i]
                    col_j = ordinal_cols[j]
                    tau_val = tau_matrix[i, j]
                    p_val = p_matrix[i, j]
                    
                    pair_results[f"{col_i}::{col_j}"] = {
                        "method": "kendall_tau",
                        "method_name": "Kendall's tau-b",
                        "result": {
                            "statistic": float(tau_val),
                            "p_value": float(p_val),
                            "effect_size": float(tau_val),
                            "effect_size_name": "Kendall's τb",
                            "interpretation": f"Kendall's τb = {tau_val:.3f}. " +
                                ("Weak" if abs(tau_val) < 0.3 else ("Moderate" if abs(tau_val) < 0.7 else "Strong")) +
                                f" {'positive' if tau_val > 0 else 'negative'} association. " +
                                ("Significant (p < 0.05)" if p_val < 0.05 else "Not significant (p >= 0.05)")
                        },
                        "variable1_name": col_i,
                        "variable2_name": col_j,
                        "sample_size": n
                    }
    
    # Strategy 2: Parallel process nominal-nominal pairs
    if len(nominal_cols) > 1:
        nom_nom_method = methods_by_pair_type.get("nominal-nominal", "cramers_v")
        nom_pairs = [(nominal_cols[i], nominal_cols[j]) 
                    for i in range(len(nominal_cols)) 
                    for j in range(i + 1, len(nominal_cols))]
        
        print(f"⚡ Processing {len(nom_pairs)} nominal pairs (32 workers)...")
        
        def process_nominal_pair(col_i: str, col_j: str):
            """Process single nominal-nominal pair"""
            contingency = pd.crosstab(processed_df[col_i], processed_df[col_j])
            
            if nom_nom_method == "cramers_v":
                cramers_v, p_value = cramers_v_vectorized(contingency.values)
                return {
                    "method": "cramers_v",
                    "method_name": "Cramér's V",
                    "result": {
                        "statistic": cramers_v,
                        "p_value": p_value,
                        "effect_size": cramers_v,
                        "effect_size_name": "Cramer's V",
                        "interpretation": f"Cramer's V = {cramers_v:.3f}. " +
                            ("Weak" if cramers_v < 0.1 else ("Moderate" if cramers_v < 0.3 else "Strong")) +
                            " association. " +
                            ("Significant (p < 0.05)" if p_value < 0.05 else "Not significant (p >= 0.05)")
                    }
                }
            elif nom_nom_method == "chi_square":
                result = chi_square_vectorized(contingency.values)
                result["interpretation"] = "Significant association detected (p < 0.05)" if result["p_value"] < 0.05 else "No significant association detected (p >= 0.05)"
                return {
                    "method": "chi_square",
                    "method_name": "Chi-square test of independence",
                    "result": result
                }
            elif nom_nom_method == "phi":
                result = phi_coefficient_vectorized(contingency.values)
                if "error" not in result:
                    result["interpretation"] = f"Phi = {result['statistic']:.3f}. " + \
                        ("Weak" if abs(result['statistic']) < 0.1 else ("Moderate" if abs(result['statistic']) < 0.3 else "Strong")) + \
                        " association. " + \
                        ("Significant (p < 0.05)" if result['p_value'] < 0.05 else "Not significant (p >= 0.05)")
                return {
                    "method": "phi",
                    "method_name": "Phi coefficient",
                    "result": result
                }
        
        # Parallel processing with 32 workers (CPU count * 2 for I/O bound tasks)
        max_workers = min(mp.cpu_count() * 2, 32)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for col_i, col_j in nom_pairs:
                future = executor.submit(process_nominal_pair, col_i, col_j)
                futures.append((col_i, col_j, future))
            
            for col_i, col_j, future in futures:
                result = future.result()
                result["variable1_name"] = col_i
                result["variable2_name"] = col_j
                result["sample_size"] = len(processed_df)
                pair_results[f"{col_i}::{col_j}"] = result
    
    # Strategy 3: Process mixed pairs (nominal-ordinal) in parallel
    mixed_pairs = []
    for nom_col in nominal_cols:
        for ord_col in ordinal_cols:
            mixed_pairs.append((nom_col, ord_col))
    
    if mixed_pairs:
        mixed_method = methods_by_pair_type.get("nominal-ordinal", "kruskal_wallis")
        print(f"⚡ Processing {len(mixed_pairs)} mixed (nominal-ordinal) pairs (32 workers)...")
        
        def process_mixed_pair(nom_col: str, ord_col: str):
            """Process single nominal-ordinal pair with vectorized group extraction"""
            # Vectorized group extraction using NumPy boolean indexing
            nom_arr = processed_df[nom_col].values
            ord_arr = processed_df[ord_col].values.astype(np.float32)
            
            # Get unique categories efficiently
            unique_cats = np.unique(nom_arr[pd.notna(nom_arr)])
            
            # Vectorized group extraction
            groups = []
            for cat in unique_cats:
                if str(cat) != 'nan':
                    mask = (nom_arr == cat) & ~np.isnan(ord_arr)
                    if mask.sum() > 0:
                        groups.append(ord_arr[mask])
            
            if len(groups) < 2:
                return {
                    "method": mixed_method,
                    "result": {"error": "Insufficient groups for analysis"}
                }
            
            if mixed_method == "kruskal_wallis":
                h_stat, p_value = stats.kruskal(*groups)
                
                # Compute epsilon squared (effect size)
                n = sum(len(g) for g in groups)
                epsilon_squared = (h_stat - len(groups) + 1) / (n - len(groups))
                epsilon_squared = max(0, epsilon_squared)  # Ensure non-negative
                
                return {
                    "method": "kruskal_wallis",
                    "method_name": "Kruskal-Wallis H test",
                    "result": {
                        "h_statistic": float(h_stat),
                        "p_value": float(p_value),
                        "epsilon_squared": float(epsilon_squared),
                        "effect_size": float(epsilon_squared),
                        "effect_size_name": "ε²",
                        "df": len(groups) - 1,
                        "interpretation": f"H({len(groups)-1}) = {h_stat:.2f}, p = {p_value:.4f}. " +
                            f"ε² = {epsilon_squared:.3f} (" +
                            ("small" if epsilon_squared < 0.04 else ("medium" if epsilon_squared < 0.16 else "large")) +
                            " effect size). " +
                            ("Significant group differences detected (p < 0.05)" if p_value < 0.05 else "No significant group differences (p >= 0.05)")
                    }
                }
            elif mixed_method == "anova_eta":
                # One-way ANOVA
                f_stat, p_value = stats.f_oneway(*groups)
                
                # Vectorized eta squared calculation
                all_data = np.concatenate(groups)
                grand_mean = all_data.mean()
                group_sizes = np.array([len(g) for g in groups])
                group_means = np.array([g.mean() for g in groups])
                
                ss_between = np.sum(group_sizes * (group_means - grand_mean)**2)
                ss_total = np.sum((all_data - grand_mean)**2)
                eta_squared = ss_between / ss_total if ss_total > 0 else 0
                
                return {
                    "method": "anova_eta",
                    "method_name": "One-way ANOVA with eta squared",
                    "result": {
                        "f_statistic": float(f_stat),
                        "p_value": float(p_value),
                        "eta_squared": float(eta_squared),
                        "effect_size": float(eta_squared),
                        "effect_size_name": "η²",
                        "df": len(groups) - 1,
                        "interpretation": f"F({len(groups)-1}, {len(np.concatenate(groups))-len(groups)}) = {f_stat:.2f}, p = {p_value:.4f}. " +
                            f"η² = {eta_squared:.3f} (" +
                            ("small" if eta_squared < 0.06 else ("medium" if eta_squared < 0.14 else "large")) +
                            " effect size). " +
                            ("Significant group differences detected (p < 0.05)" if p_value < 0.05 else "No significant group differences (p >= 0.05)")
                    }
                }
        
        # Maximum parallelism: CPU count * 2 for I/O bound tasks
        max_workers = min(mp.cpu_count() * 2, 32)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for nom_col, ord_col in mixed_pairs:
                future = executor.submit(process_mixed_pair, nom_col, ord_col)
                futures.append((nom_col, ord_col, future))
            
            for nom_col, ord_col, future in futures:
                result = future.result()
                result["variable1_name"] = nom_col
                result["variable2_name"] = ord_col
                result["sample_size"] = len(processed_df)
                pair_results[f"{nom_col}::{ord_col}"] = result
    
    print(f"✅ Completed {len(pair_results):,} correlations!")
    return pair_results


# ==================== Helper Functions ====================

def build_correlation_matrix(
    pair_results: Dict[str, Any],
    columns: List[str]
) -> List[List[Dict[str, Any]]]:
    """
    Build symmetric correlation matrix from pair results
    
    Args:
        pair_results: Dict mapping "col1::col2" to result dict
        columns: Ordered list of column names
        
    Returns:
        2D list of correlation matrix cells
    """
    n = len(columns)
    matrix = []
    
    for i in range(n):
        row = []
        for j in range(n):
            if i == j:
                # Diagonal
                row.append({
                    "row": i,
                    "col": j,
                    "row_name": columns[i],
                    "col_name": columns[j],
                    "correlation": 1.0,
                    "p_value": 0.0,
                    "method": "self",
                    "is_diagonal": True
                })
            else:
                # Off-diagonal: look up result
                col_i = columns[i]
                col_j = columns[j]
                
                # Try both orderings
                key1 = f"{col_i}::{col_j}"
                key2 = f"{col_j}::{col_i}"
                
                pair_data = pair_results.get(key1) or pair_results.get(key2)
                
                if pair_data:
                    result = pair_data.get("result", {})
                    row.append({
                        "row": i,
                        "col": j,
                        "row_name": col_i,
                        "col_name": col_j,
                        "correlation": result.get("effect_size") or result.get("statistic"),
                        "p_value": result.get("p_value"),
                        "method": pair_data.get("method"),
                        "is_diagonal": False
                    })
                else:
                    # Missing data
                    row.append({
                        "row": i,
                        "col": j,
                        "row_name": col_i,
                        "col_name": col_j,
                        "correlation": None,
                        "p_value": None,
                        "method": None,
                        "is_diagonal": False
                    })
        
        matrix.append(row)
    
    return matrix
