/**
 * Ordinal Scale Detection and Utilities for Frontend
 * Provides client-side ordinal scale detection and display helpers
 */

export interface OrdinalInfo {
  is_ordinal: boolean;
  preset_name: string | null;
  levels: string[];
  detection_method: "numeric" | "preset" | "suggested" | "manual";
  note?: string;
}

export interface ColumnMetadata {
  name: string;
  unique_count: number;
  has_missing: boolean;
  missing_count: number;
  ordinal?: OrdinalInfo;
}

export interface ColumnMetadataResponse {
  columns: Record<string, ColumnMetadata>;
  row_count: number;
}

/**
 * Get human-readable name for preset ordinal scales
 */
export function getPresetDisplayName(presetName: string): string {
  const displayNames: Record<string, string> = {
    // Numeric scales
    numeric_3: "Numeric 3-point (1-3)",
    numeric_4: "Numeric 4-point (1-4)",
    numeric_5: "Numeric 5-point (1-5)",
    numeric_7: "Numeric 7-point (1-7)",
    numeric_10_0: "Numeric 0-10",
    numeric_10_1: "Numeric 1-10",
    numeric_custom: "Numeric Scale",

    // Level scales
    level_3_low_high: "3-level (Low/Medium/High)",
    level_5: "5-level Intensity",

    // Quality
    quality_4: "Quality 4-point",
    quality_4_alt: "Quality 4-point (Alternative)",
    quality_5: "Quality 5-point",

    // Performance
    performance_5: "Performance 5-point",

    // Risk/Severity
    risk_4: "Risk 4-level",
    risk_5: "Risk 5-level",
    severity_5: "Severity 5-level",
    severity_5_alt: "Severity 5-level (Alternative)",
    impact_5: "Impact 5-level",

    // Agreement scales
    agreement_4_no_neutral: "Agreement 4-level (No Neutral)",
    agreement_5: "Likert 5-point Agreement",
    agreement_7: "Likert 7-point Agreement",

    // Satisfaction
    satisfaction_5: "Satisfaction 5-point",
    happiness_5: "Happiness 5-point",
    nps_5: "NPS 5-point (Likelihood)",

    // Frequency
    frequency_5: "Frequency 5-point",
    frequency_6: "Frequency 6-point",

    // Intensity/Effort
    intensity_4: "Intensity 4-level",
    effort_5: "Effort 5-level",
    difficulty_4: "Complexity 4-level",
    difficulty_5: "Difficulty 5-level",

    // Others
    usage_4: "Usage Intensity 4-level",
    urgency_4: "Urgency 4-level",
    priority_3: "Priority 3-level",
    priority_4: "Priority 4-level",
    priority_p_levels: "Priority (P-levels)",
    confidence_5: "Confidence 5-level",
    certainty_5: "Certainty 5-level",
    probability_5: "Probability 5-level",
    reliability_5: "Reliability 5-level",
    magnitude_5: "Magnitude 5-level",
    maturity_5: "Maturity 5-level (CMMI)",
    compliance_4: "Compliance 4-level",
    pain_5: "Pain Scale 5-level",
    health_5: "Health Status 5-level",

    // Progress/Status
    progress_3: "Progress 3-level",
    progress_5: "Progress 5-level",
    ticket_4: "Ticket Lifecycle",
    phase_5: "Project Phase 5-stage",

    // Education/Experience
    education_6: "Education Level",
    seniority_5: "Seniority Level",
    experience_4: "Experience Level",

    // Sizes
    sizes_6: "Clothing Sizes",

    // Ratings
    stars_5: "Star Ratings",
  };

  return displayNames[presetName] || presetName;
}

/**
 * Check if a column should suggest ordered bar vs regular bar
 */
export function shouldSuggestOrdered(metadata: ColumnMetadata): boolean {
  if (metadata.ordinal?.is_ordinal) {
    return true;
  }

  // Suggest if column name implies ordering
  const nameLower = metadata.name.toLowerCase();
  const orderKeywords = [
    "priority",
    "severity",
    "risk",
    "level",
    "stage",
    "phase",
    "order",
    "rank",
    "grade",
    "rating",
  ];

  return orderKeywords.some((keyword) => nameLower.includes(keyword));
}

/**
 * Get a user-friendly badge/label for ordinal columns
 */
export function getOrdinalBadgeText(ordinalInfo: OrdinalInfo): string {
  if (ordinalInfo.detection_method === "numeric") {
    return "Numeric Order";
  } else if (ordinalInfo.detection_method === "preset") {
    return "Ordinal Scale";
  } else if (ordinalInfo.detection_method === "suggested") {
    return "Possibly Ordinal";
  }
  return "Custom Order";
}

/**
 * Format levels for display in UI
 */
export function formatLevelsForDisplay(levels: string[], maxShow: number = 5): string {
  if (levels.length <= maxShow) {
    return levels.join(" < ");
  }

  const shown = levels.slice(0, maxShow);
  return `${shown.join(" < ")} ... (${levels.length} total)`;
}
