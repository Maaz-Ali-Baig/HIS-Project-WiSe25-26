"""
Ordinal Scale Detection and Preset Definitions
Provides utilities to detect and apply common ordinal scales to categorical data.
"""

from typing import Dict, List, Optional, Tuple
import re


# ============================================================================
# ORDINAL SCALE PRESETS
# ============================================================================

ORDINAL_PRESETS: Dict[str, List[str]] = {
    # Numeric scales (3-point)
    "numeric_3": ["1", "2", "3"],
    "level_3_low_high": ["low", "medium", "high"],
    
    # Numeric scales (4-point)
    "numeric_4": ["1", "2", "3", "4"],
    "quality_4": ["poor", "fair", "good", "excellent"],
    "quality_4_alt": ["poor", "average", "good", "excellent"],
    "usage_4": ["not at all", "low", "medium", "high"],
    "intensity_4": ["none", "low", "medium", "high"],
    "risk_4": ["low", "medium", "high", "extreme"],
    "urgency_4": ["low", "medium", "high", "immediate"],
    "priority_4": ["low", "medium", "high", "critical"],
    "difficulty_4": ["simple", "moderate", "complex", "very complex"],
    "compliance_4": ["non-compliant", "partially compliant", "mostly compliant", "fully compliant"],
    "agreement_4_no_neutral": ["strongly disagree", "disagree", "agree", "strongly agree"],
    
    # Numeric scales (5-point)
    "numeric_5": ["1", "2", "3", "4", "5"],
    "level_5": ["very low", "low", "medium", "high", "very high"],
    "quality_5": ["poor", "fair", "good", "very good", "excellent"],
    "performance_5": ["very poor", "poor", "average", "good", "excellent"],
    "risk_5": ["very low", "low", "medium", "high", "very high"],
    "severity_5": ["none", "low", "medium", "high", "critical"],
    "severity_5_alt": ["trivial", "minor", "major", "severe", "critical"],
    "impact_5": ["none", "low", "medium", "high", "very high"],
    "confidence_5": ["very low", "low", "medium", "high", "very high"],
    "certainty_5": ["very uncertain", "uncertain", "neutral", "certain", "very certain"],
    "probability_5": ["very unlikely", "unlikely", "possible", "likely", "very likely"],
    "difficulty_5": ["very easy", "easy", "medium", "hard", "very hard"],
    "effort_5": ["very low", "low", "medium", "high", "very high"],
    "reliability_5": ["very low", "low", "medium", "high", "very high"],
    "magnitude_5": ["negligible", "minor", "moderate", "major", "extreme"],
    "maturity_5": ["initial", "managed", "defined", "quantitatively managed", "optimizing"],
    "pain_5": ["none", "mild", "moderate", "severe", "unbearable"],
    "health_5": ["very poor", "poor", "fair", "good", "excellent"],
    
    # Likert agreement scales
    "agreement_5": ["strongly disagree", "disagree", "neutral", "agree", "strongly agree"],
    "agreement_7": ["strongly disagree", "disagree", "somewhat disagree", "neutral", 
                    "somewhat agree", "agree", "strongly agree"],
    
    # Satisfaction scales
    "satisfaction_5": ["very dissatisfied", "dissatisfied", "neutral", "satisfied", "very satisfied"],
    "happiness_5": ["very unhappy", "unhappy", "neutral", "happy", "very happy"],
    "nps_5": ["very unlikely", "unlikely", "neutral", "likely", "very likely"],
    
    # Frequency scales
    "frequency_5": ["never", "rarely", "sometimes", "often", "always"],
    "frequency_6": ["never", "very rarely", "rarely", "sometimes", "often", "always"],
    
    # Numeric scales (7-point and 10-point)
    "numeric_7": ["1", "2", "3", "4", "5", "6", "7"],
    "numeric_10_0": ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    "numeric_10_1": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    
    # Progress/Status
    "progress_3": ["not started", "in progress", "completed"],
    "progress_5": ["not started", "started", "in progress", "nearly done", "completed"],
    "ticket_4": ["open", "in progress", "resolved", "closed"],
    "phase_5": ["planning", "design", "development", "testing", "deployment"],
    
    # Priority (special cases)
    "priority_3": ["low", "medium", "high"],
    "priority_p_levels": ["p4", "p3", "p2", "p1"],
    
    # Education/Seniority
    "education_6": ["primary", "secondary", "high school", "bachelor", "master", "doctorate"],
    "seniority_5": ["junior", "mid", "senior", "lead", "principal"],
    "experience_4": ["beginner", "intermediate", "advanced", "expert"],
    
    # Sizes
    "sizes_6": ["xs", "s", "m", "l", "xl", "xxl"],
    
    # Star ratings
    "stars_5": ["1 star", "2 stars", "3 stars", "4 stars", "5 stars"],
}


# ============================================================================
# DETECTION FUNCTIONS
# ============================================================================

def normalize_value(value: str) -> str:
    """Normalize a value for comparison: lowercase and trim whitespace."""
    if value is None:
        return ""
    return str(value).strip().lower()


def detect_numeric_scale(values: List[str]) -> Optional[Tuple[str, List[str]]]:
    """
    Detect if values form a numeric ordinal scale.
    Returns (preset_name, ordered_levels) or None.
    """
    # Try to convert to numbers
    numeric_values = []
    for v in values:
        try:
            # Remove commas and try to parse
            cleaned = v.replace(",", "").strip()
            numeric_values.append(float(cleaned))
        except (ValueError, AttributeError):
            return None
    
    if not numeric_values:
        return None
    
    # Check if they're integers
    if all(v == int(v) for v in numeric_values):
        numeric_values = [int(v) for v in numeric_values]
    
    # Sort and get unique values
    unique_sorted = sorted(set(numeric_values))
    
    # Check for common numeric scales
    unique_count = len(unique_sorted)
    min_val = min(unique_sorted)
    max_val = max(unique_sorted)
    
    # Check for continuous ranges
    if unique_count <= 20 and max_val - min_val == unique_count - 1:
        # Continuous range detected
        ordered = [str(int(v)) if v == int(v) else str(v) for v in unique_sorted]
        
        if unique_count == 3 and min_val == 1:
            return ("numeric_3", ordered)
        elif unique_count == 4 and min_val == 1:
            return ("numeric_4", ordered)
        elif unique_count == 5 and min_val == 1:
            return ("numeric_5", ordered)
        elif unique_count == 7 and min_val == 1:
            return ("numeric_7", ordered)
        elif unique_count == 10 and min_val == 1:
            return ("numeric_10_1", ordered)
        elif unique_count == 11 and min_val == 0 and max_val == 10:
            return ("numeric_10_0", ordered)
        else:
            # Generic numeric scale
            return ("numeric_custom", ordered)
    
    return None


def detect_ordinal_preset(values: List[str]) -> Optional[Tuple[str, List[str]]]:
    """
    Detect if values match a known ordinal preset.
    Returns (preset_name, ordered_levels) or None.
    
    Args:
        values: List of unique values from a column
        
    Returns:
        Tuple of (preset_name, ordered_levels) if matched, else None
    """
    if not values:
        return None
    
    # Normalize values
    normalized_values = {normalize_value(v) for v in values if v is not None and str(v).strip()}
    
    if not normalized_values:
        return None
    
    # First try numeric detection
    numeric_result = detect_numeric_scale(list(normalized_values))
    if numeric_result:
        return numeric_result
    
    # Try to match against presets
    for preset_name, preset_levels in ORDINAL_PRESETS.items():
        normalized_preset = [normalize_value(level) for level in preset_levels]
        
        # Check if all values match the preset (subset or exact match)
        if normalized_values.issubset(set(normalized_preset)):
            # Return in the order defined by preset, filtered to actual values
            ordered = [level for level in preset_levels 
                      if normalize_value(level) in normalized_values]
            return (preset_name, ordered)
    
    return None


def get_column_order(values: List[str], column_name: Optional[str] = None) -> Optional[Dict]:
    """
    Get ordering information for a column's values.
    
    Args:
        values: List of unique values from the column
        column_name: Optional column name for context
        
    Returns:
        Dict with ordering info or None if not ordinal
        {
            "is_ordinal": bool,
            "preset_name": str or None,
            "levels": List[str],
            "detection_method": "numeric" | "preset" | "manual"
        }
    """
    result = detect_ordinal_preset(values)
    
    if result:
        preset_name, levels = result
        return {
            "is_ordinal": True,
            "preset_name": preset_name,
            "levels": levels,
            "detection_method": "numeric" if "numeric" in preset_name else "preset"
        }
    
    # Check if column name suggests ordering
    if column_name:
        name_lower = column_name.lower()
        if any(keyword in name_lower for keyword in 
               ["priority", "severity", "risk", "level", "stage", "phase", "order", "rank"]):
            # Suggest it might be ordinal but don't force an order
            return {
                "is_ordinal": False,
                "preset_name": None,
                "levels": sorted(values),  # Default alphabetical
                "detection_method": "suggested",
                "note": "Column name suggests ordinal data. Consider setting manual order."
            }
    
    return None


def apply_ordinal_order(data_series, levels: List[str]) -> List:
    """
    Reorder data according to specified ordinal levels.
    
    Args:
        data_series: List or array of categorical values
        levels: Ordered list of levels
        
    Returns:
        Reordered data with ordinal levels applied
    """
    # Create a mapping for ordering
    level_map = {normalize_value(level): i for i, level in enumerate(levels)}
    
    # Sort data according to level order
    def sort_key(value):
        normalized = normalize_value(value)
        return level_map.get(normalized, len(levels))  # Unknown values go to end
    
    return sorted(data_series, key=sort_key)


def get_neutral_point(levels: List[str], preset_name: Optional[str] = None) -> Optional[int]:
    """
    Determine the neutral point index for Likert-style scales.
    
    Args:
        levels: Ordered list of scale levels
        preset_name: Optional preset name for context
        
    Returns:
        Index of neutral point (0-based) or None
    """
    normalized_levels = [normalize_value(level) for level in levels]
    
    # Look for explicit neutral keywords
    neutral_keywords = ["neutral", "neither", "undecided", "unsure", "moderate"]
    for i, level in enumerate(normalized_levels):
        if any(keyword in level for keyword in neutral_keywords):
            return i
    
    # For odd-numbered scales without explicit neutral, use middle
    if len(levels) % 2 == 1:
        return len(levels) // 2
    
    # For agreement scales with even numbers, there's no true neutral
    if preset_name and "agreement" in preset_name and "no_neutral" in preset_name:
        return None
    
    return None


# ============================================================================
# BATCH ANALYSIS
# ============================================================================

def analyze_dataframe_columns(df) -> Dict[str, Dict]:
    """
    Analyze all columns in a dataframe for ordinal scales.
    
    Args:
        df: pandas DataFrame
        
    Returns:
        Dict mapping column names to their ordinal info
    """
    import pandas as pd
    
    results = {}
    
    for col in df.columns:
        if col == "id":
            continue
            
        # Get unique values
        unique_values = df[col].dropna().unique()
        
        # Skip if too many unique values (likely not ordinal)
        if len(unique_values) > 50:
            continue
        
        # Try to detect ordinal scale
        order_info = get_column_order(list(unique_values), column_name=col)
        
        if order_info and order_info.get("is_ordinal"):
            results[col] = order_info
    
    return results
