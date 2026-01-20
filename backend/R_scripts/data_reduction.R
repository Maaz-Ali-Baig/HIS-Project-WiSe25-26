# Data reduction using MCA/FAMD for qualitative datasets with comprehensive explainability

use_data_table <- requireNamespace("data.table", quietly = TRUE)

fast_read_csv <- function(path) {
    if (use_data_table) {
        fread_args <- list(input = path, data.table = FALSE, showProgress = FALSE)
        if ("check.names" %in% names(formals(data.table::fread))) {
            fread_args$check.names <- FALSE
        }
        return(do.call(data.table::fread, fread_args))
    }
    utils::read.csv(path, stringsAsFactors = FALSE, check.names = FALSE)
}

fast_write_csv <- function(df, path, na = "") {
    if (use_data_table) {
        data.table::fwrite(df, path, na = na)
    } else {
        utils::write.csv(df, path, row.names = FALSE, na = na)
    }
}

fast_unique_n <- function(x) {
    if (use_data_table) {
        return(data.table::uniqueN(x, na.rm = TRUE))
    }
    length(unique(x[!is.na(x)]))
}

count_levels <- function(x) {
    if (use_data_table) {
        dt <- data.table::data.table(level = x)
        return(dt[, .N, by = level])
    }
    tab <- table(x)
    data.frame(level = names(tab), N = as.integer(tab), stringsAsFactors = FALSE)
}

# Helper function to extract top contributing variables for each dimension
extract_top_contributions <- function(res, method_used, n_top = 5) {
    contributions <- list()

    if (method_used == "mca") {
        # For MCA, use variable contributions
        if (!is.null(res$var) && !is.null(res$var$contrib)) {
            var_contrib <- res$var$contrib
            n_dims <- min(ncol(var_contrib), nrow(var_contrib))

            for (dim_idx in seq_len(n_dims)) {
                contrib_vec <- var_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_vars <- names(contrib_vec)[top_indices]
                    top_values <- contrib_vec[top_indices]

                    contributions[[paste0("DR", dim_idx)]] <- list(
                        variables = as.list(data.frame(
                            name = top_vars,
                            contribution = round(top_values, 2),
                            stringsAsFactors = FALSE
                        ))
                    )
                }
            }
        }

        # Extract top contributing category levels for MCA
        if (!is.null(res$var) && !is.null(res$var$cos2)) {
            cos2 <- res$var$cos2
            n_dims <- min(ncol(cos2), nrow(cos2))

            for (dim_idx in seq_len(n_dims)) {
                cos2_vec <- cos2[, dim_idx]
                n_top_actual <- min(n_top, length(cos2_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(cos2_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_levels <- rownames(cos2)[top_indices]
                    top_cos2_values <- cos2_vec[top_indices]

                    if (is.null(contributions[[paste0("DR", dim_idx)]])) {
                        contributions[[paste0("DR", dim_idx)]] <- list()
                    }

                    contributions[[paste0("DR", dim_idx)]]$categoryLevels <- as.list(data.frame(
                        level = top_levels,
                        quality = round(top_cos2_values, 3),
                        stringsAsFactors = FALSE
                    ))
                }
            }
        }
    } else if (method_used == "famd") {
        # For FAMD, extract both quantitative and qualitative contributions
        if (!is.null(res$quanti) && !is.null(res$quanti$contrib)) {
            quanti_contrib <- res$quanti$contrib
            n_dims <- min(ncol(quanti_contrib), nrow(quanti_contrib))

            for (dim_idx in seq_len(n_dims)) {
                contrib_vec <- quanti_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_vars <- rownames(quanti_contrib)[top_indices]
                    top_values <- contrib_vec[top_indices]

                    contributions[[paste0("DR", dim_idx)]] <- list(
                        numericVariables = as.list(data.frame(
                            name = top_vars,
                            contribution = round(top_values, 2),
                            stringsAsFactors = FALSE
                        ))
                    )
                }
            }
        }

        if (!is.null(res$quali) && !is.null(res$quali$contrib)) {
            quali_contrib <- res$quali$contrib
            n_dims <- min(ncol(quali_contrib), nrow(quali_contrib))

            for (dim_idx in seq_len(n_dims)) {
                contrib_vec <- quali_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_vars <- rownames(quali_contrib)[top_indices]
                    top_values <- contrib_vec[top_indices]

                    if (is.null(contributions[[paste0("DR", dim_idx)]])) {
                        contributions[[paste0("DR", dim_idx)]] <- list()
                    }

                    contributions[[paste0("DR", dim_idx)]]$categoricalVariables <- as.list(data.frame(
                        name = top_vars,
                        contribution = round(top_values, 2),
                        stringsAsFactors = FALSE
                    ))
                }
            }
        }

        # Extract category levels for FAMD
        if (!is.null(res$quali.var) && !is.null(res$quali.var$cos2)) {
            cos2 <- res$quali.var$cos2
            n_dims <- min(ncol(cos2), nrow(cos2))

            for (dim_idx in seq_len(n_dims)) {
                cos2_vec <- cos2[, dim_idx]
                n_top_actual <- min(n_top, length(cos2_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(cos2_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_levels <- rownames(cos2)[top_indices]
                    top_cos2_values <- cos2_vec[top_indices]

                    if (is.null(contributions[[paste0("DR", dim_idx)]])) {
                        contributions[[paste0("DR", dim_idx)]] <- list()
                    }

                    contributions[[paste0("DR", dim_idx)]]$categoryLevels <- as.list(data.frame(
                        level = top_levels,
                        quality = round(top_cos2_values, 3),
                        stringsAsFactors = FALSE
                    ))
                }
            }
        }
    }

    return(contributions)
}

# Helper function to extract simplified top contributing variables (just names)
extract_simple_top_variables <- function(res, method_used, n_top = 5) {
    simple_contributions <- list()

    if (method_used == "mca") {
        if (!is.null(res$var) && !is.null(res$var$contrib)) {
            var_contrib <- res$var$contrib
            n_dims <- min(ncol(var_contrib), nrow(var_contrib))

            for (dim_idx in seq_len(n_dims)) {
                contrib_vec <- var_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_vars <- names(contrib_vec)[top_indices]
                    simple_contributions[[paste0("DR", dim_idx)]] <- top_vars
                }
            }
        }
    } else if (method_used == "famd") {
        # Combine both quantitative and qualitative for FAMD
        if (!is.null(res$quanti) && !is.null(res$quanti$contrib)) {
            quanti_contrib <- res$quanti$contrib
            n_dims <- min(ncol(quanti_contrib), nrow(quanti_contrib))

            for (dim_idx in seq_len(n_dims)) {
                vars <- c()

                # Get top quantitative
                contrib_vec <- quanti_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    vars <- rownames(quanti_contrib)[top_indices]
                }

                simple_contributions[[paste0("DR", dim_idx)]] <- vars
            }
        }

        # Add qualitative variables
        if (!is.null(res$quali) && !is.null(res$quali$contrib)) {
            quali_contrib <- res$quali$contrib
            n_dims <- min(ncol(quali_contrib), nrow(quali_contrib))

            for (dim_idx in seq_len(n_dims)) {
                contrib_vec <- quali_contrib[, dim_idx]
                n_top_actual <- min(n_top, length(contrib_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(contrib_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    quali_vars <- rownames(quali_contrib)[top_indices]

                    # Combine with existing
                    existing <- simple_contributions[[paste0("DR", dim_idx)]]
                    if (!is.null(existing)) {
                        simple_contributions[[paste0("DR", dim_idx)]] <- c(existing, quali_vars)
                    } else {
                        simple_contributions[[paste0("DR", dim_idx)]] <- quali_vars
                    }
                }
            }
        }
    }

    return(simple_contributions)
}

# Helper function to extract top category levels across all dimensions
extract_top_category_levels <- function(res, method_used, n_top = 10) {
    category_levels <- list()

    if (method_used == "mca") {
        if (!is.null(res$var) && !is.null(res$var$cos2)) {
            cos2 <- res$var$cos2
            n_dims <- min(ncol(cos2), nrow(cos2))

            for (dim_idx in seq_len(n_dims)) {
                cos2_vec <- cos2[, dim_idx]
                n_top_actual <- min(n_top, length(cos2_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(cos2_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_levels <- rownames(cos2)[top_indices]
                    category_levels[[paste0("DR", dim_idx)]] <- top_levels
                }
            }
        }
    } else if (method_used == "famd") {
        if (!is.null(res$quali.var) && !is.null(res$quali.var$cos2)) {
            cos2 <- res$quali.var$cos2
            n_dims <- min(ncol(cos2), nrow(cos2))

            for (dim_idx in seq_len(n_dims)) {
                cos2_vec <- cos2[, dim_idx]
                n_top_actual <- min(n_top, length(cos2_vec))
                if (n_top_actual > 0) {
                    top_indices <- order(cos2_vec, decreasing = TRUE)[seq_len(n_top_actual)]
                    top_levels <- rownames(cos2)[top_indices]
                    category_levels[[paste0("DR", dim_idx)]] <- top_levels
                }
            }
        }
    }

    return(category_levels)
}

reduce_data_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = "auto",
    n_components = 5,
    rare_threshold = 5,
    max_cardinality = 200,
    sample_size = NULL,
    summary_path = NULL,
    dr_table_path = NULL
) {
    if (!requireNamespace("FactoMineR", quietly = TRUE)) {
        stop("FactoMineR not installed")
    }
    if (!requireNamespace("jsonlite", quietly = TRUE)) {
        stop("jsonlite not installed")
    }

    # Track runtime
    start_time <- Sys.time()

    df <- fast_read_csv(input_csv)
    rows_input <- nrow(df)
    original_columns_count <- ncol(df)  # Store original column count BEFORE adding DR columns

    if (length(columns) == 0) {
        stop("No columns selected")
    }

    missing_cols <- setdiff(columns, names(df))
    if (length(missing_cols) > 0) {
        stop(paste("Columns not found:", paste(missing_cols, collapse = ", ")))
    }

    data <- df[, columns, drop = FALSE]
    input_columns_count <- length(columns)  # Number of columns selected for analysis

    # Track metadata for explainability
    selected_columns <- columns
    treated_as_numeric <- character(0)
    treated_as_categorical <- character(0)
    suspected_code_columns <- character(0)
    dropped_columns <- list()
    collapsed_to_other <- list()
    rare_threshold_used <- rare_threshold

    detect_numeric <- function(vec) {
        if (is.numeric(vec)) {
            return(TRUE)
        }
        vals <- trimws(as.character(vec))
        vals <- vals[nzchar(vals)]
        if (length(vals) == 0) {
            return(FALSE)
        }
        nums <- suppressWarnings(as.numeric(gsub(",", "", vals, fixed = TRUE)))
        mean(!is.na(nums)) >= 0.8
    }

    numeric_cols <- vapply(data, detect_numeric, logical(1))
    if (all(numeric_cols)) {
        stop("Numeric-only dataset detected. Data reduction is intended for qualitative data.")
    }

    kept <- list()

    for (col_name in names(data)) {
        vec <- data[[col_name]]
        if (numeric_cols[[col_name]]) {
            vec_num <- suppressWarnings(as.numeric(gsub(",", "", as.character(vec), fixed = TRUE)))
            unique_count <- fast_unique_n(vec_num)

            # Check if numeric column should be treated as categorical (suspected code column)
            if (unique_count <= 20 && unique_count >= 2) {
                suspected_code_columns <- c(suspected_code_columns, col_name)
                vec_chr <- as.character(vec)
                trimmed <- trimws(vec_chr)
                missing_mask <- is.na(vec_chr) | trimmed == ""
                vec_chr[missing_mask] <- "Missing"
                kept[[col_name]] <- factor(vec_chr)
                treated_as_categorical <- c(treated_as_categorical, col_name)
            } else {
                kept[[col_name]] <- vec_num
                treated_as_numeric <- c(treated_as_numeric, col_name)
            }
        } else {
            vec_chr <- as.character(vec)
            trimmed <- trimws(vec_chr)
            missing_mask <- is.na(vec_chr) | trimmed == ""
            vec_chr[missing_mask] <- "Missing"
            counts <- count_levels(vec_chr)
            n_levels <- nrow(counts)

            if (n_levels > max_cardinality) {
                dropped_columns[[length(dropped_columns) + 1]] <- list(
                    column = col_name,
                    reason = "max_cardinality_exceeded",
                    uniqueLevels = n_levels,
                    threshold = max_cardinality
                )
                next
            }

            rare_count <- 0
            if (!is.null(rare_threshold) && rare_threshold > 1) {
                rare_levels <- counts$level[counts$N < rare_threshold]
                rare_count <- length(rare_levels)
                vec_chr[vec_chr %in% rare_levels] <- "Other"
            }

            collapsed_to_other[[col_name]] <- rare_count
            kept[[col_name]] <- factor(vec_chr)
            treated_as_categorical <- c(treated_as_categorical, col_name)
        }
    }

    if (length(kept) == 0) {
        stop("No columns available after filtering")
    }

    data_clean <- as.data.frame(kept, stringsAsFactors = FALSE)
    kept_columns <- names(data_clean)
    is_numeric_cols <- vapply(data_clean, is.numeric, logical(1))

    method_used <- tolower(method)
    if (method_used == "auto") {
        if (any(is_numeric_cols)) {
            method_used <- "famd"
        } else {
            method_used <- "mca"
        }
    }

    fit_data <- data_clean
    n_rows_clean <- nrow(data_clean)
    sample_size_used <- n_rows_clean
    seed_used <- NULL

    if (!is.null(sample_size) && sample_size > 0 && n_rows_clean > sample_size) {
        seed_used <- 42
        set.seed(seed_used)
        idx <- sample.int(n_rows_clean, sample_size)
        fit_data <- data_clean[idx, , drop = FALSE]
        sample_size_used <- sample_size
    }

    if (method_used == "mca") {
        if (any(is_numeric_cols)) {
            stop("MCA only supports categorical data")
        }
        res <- FactoMineR::MCA(fit_data, ncp = n_components, graph = FALSE)
        coords <- res$ind$coord
        if (nrow(fit_data) != nrow(data_clean)) {
            pred <- FactoMineR::predict.MCA(res, newdata = data_clean)
            coords <- pred$coord
        }
    } else if (method_used == "famd") {
        res <- FactoMineR::FAMD(fit_data, ncp = n_components, graph = FALSE)
        coords <- res$ind$coord
        if (nrow(fit_data) != nrow(data_clean)) {
            pred <- FactoMineR::predict.FAMD(res, newdata = data_clean)
            coords <- pred$coord
        }
    } else {
        stop("Invalid method")
    }

    coords_df <- as.data.frame(coords)
    if (ncol(coords_df) == 0) {
        stop("No components produced")
    }

    k <- min(n_components, ncol(coords_df))
    coords_df <- coords_df[, seq_len(k), drop = FALSE]
    dr_col_names <- paste0("DR", seq_len(k))
    names(coords_df) <- dr_col_names

    if ("id" %in% names(df)) {
        coords_df <- cbind(id = df$id, coords_df)
    }

    # Save DR table separately if path provided
    if (!is.null(dr_table_path)) {
        fast_write_csv(coords_df, dr_table_path, na = "")
    }

    # Remove existing DR columns to avoid duplicates
    dr_cols <- grep("^DR[0-9]+$", names(df), value = TRUE)
    if (length(dr_cols) > 0) {
        df <- df[, setdiff(names(df), dr_cols), drop = FALSE]
    }

    # Append DR columns to original dataset
    if ("id" %in% names(df) && "id" %in% names(coords_df)) {
        idx <- match(df$id, coords_df$id)
        coords_match <- coords_df[idx, , drop = FALSE]
        coords_match <- coords_match[, setdiff(names(coords_match), "id"), drop = FALSE]
        output_df <- cbind(df, coords_match)
    } else {
        output_df <- cbind(df, coords_df)
    }

    fast_write_csv(output_df, output_csv, na = "")

    # Calculate runtime
    end_time <- Sys.time()
    runtime_seconds <- as.numeric(difftime(end_time, start_time, units = "secs"))

    # Extract variance explained
    eig <- res$eig
    var_explained <- NULL
    total_var <- NULL
    if (!is.null(eig) && nrow(eig) >= 1) {
        perc <- eig[seq_len(k), 2]
        var_explained <- as.numeric(round(perc, 2))
        total_var <- as.numeric(round(sum(perc), 2))
    }

    # Extract top contributions for explainability
    top_contributions <- extract_top_contributions(res, method_used, n_top = 5)

    summary <- list(
        # Basic run info
        methodUsed = method_used,
        componentsRequested = n_components,
        componentsProduced = k,
        rowsInput = rows_input,
        rowsOutput = nrow(output_df),
        outputMode = "separate",
        outputColumns = dr_col_names,

        # Quality signal
        varianceExplained = var_explained,
        totalVariance = total_var,

        # Data decisions
        selectedColumns = selected_columns,
        keptColumns = kept_columns,
        droppedColumns = if (length(dropped_columns) > 0) dropped_columns else list(),

        # Type handling
        treatedAsNumeric = treated_as_numeric,
        treatedAsCategorical = treated_as_categorical,
        suspectedCodeColumns = suspected_code_columns,

        # Preprocessing stats
        missingHandling = "blank/NA categorical values -> 'Missing'",
        rareThreshold = rare_threshold_used,
        collapsedToOther = collapsed_to_other,
        maxCardinality = max_cardinality,

        # Performance + reproducibility
        sampleSizeUsed = sample_size_used,
        seedUsed = if (!is.null(seed_used)) seed_used else NA,
        runtimeSeconds = round(runtime_seconds, 2),

        # Explainability - top contributions
        topContributions = top_contributions,

        # Legacy fields for backward compatibility
        inputColumns = input_columns_count,
        originalColumns = original_columns_count,
        drColumns = k
    )

    if (!is.null(summary_path)) {
        jsonlite::write_json(summary, summary_path, auto_unbox = TRUE, pretty = TRUE)
    }

    return(summary)
}
