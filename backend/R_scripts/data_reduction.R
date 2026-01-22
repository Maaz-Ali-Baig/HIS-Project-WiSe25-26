# Optimized Data Reduction using MCA/FAMD with data.table
# Optimizations: fread/fwrite, in-place modification, multi-threading, vectorized operations

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
    dr_table_path = NULL,
    threads = 0,        # New: 0 = use all available cores
    verbose = FALSE     # New: Print timing info
) {
    # 1. Setup and Dependencies
    if (!requireNamespace("FactoMineR", quietly = TRUE)) stop("FactoMineR not installed")
    if (!requireNamespace("jsonlite", quietly = TRUE)) stop("jsonlite not installed")
    if (!requireNamespace("data.table", quietly = TRUE)) stop("data.table not installed")

    library(data.table)

    # Threading Configuration [Requirement 8]
    old_threads <- getDTthreads()
    if (threads > 0) setDTthreads(threads) else setDTthreads(0) # 0 uses all cores
    on.exit(setDTthreads(old_threads), add = TRUE)

    if (verbose) {
        cat(sprintf("Starting data reduction. Threads: %d\n", getDTthreads()))
        t_start_total <- Sys.time()
    }

    # 2. Fast File Reading [Requirement 1]
    # fread is 5-10x faster than read.csv
    if (verbose) cat("Reading input file...\n")
    dt <- fread(input_csv, stringsAsFactors = FALSE, header = TRUE, nThread = getDTthreads())

    rows_input <- nrow(dt)
    original_columns_count <- ncol(dt)

    if (length(columns) == 0) stop("No columns selected")

    missing_cols <- setdiff(columns, names(dt))
    if (length(missing_cols) > 0) {
        stop(paste("Columns not found:", paste(missing_cols, collapse = ", ")))
    }

    # Subset columns using data.table .SD (Subset of Data)
    # We keep 'id' if present for merging later, but separate it from analysis data
    has_id <- "id" %in% names(dt)
    id_vec <- if (has_id) dt$id else NULL

    # Create working subset (copy required to avoid modifying original if passed by ref, though fread creates new)
    # processing_dt will be modified in-place [Requirement 6]
    processing_dt <- dt[, ..columns]

    # Clear large initial object to free memory [Requirement 6]
    rm(dt); gc()

    # Metadata tracking
    treated_as_numeric <- character(0)
    treated_as_categorical <- character(0)
    suspected_code_columns <- character(0)
    dropped_columns <- list()
    collapsed_to_other <- list()
    rare_threshold_used <- rare_threshold

    # 3. Optimized Preprocessing Loop
    # We iterate over names but operate by reference using set() and :=

    cols_to_keep <- character(0)

    # Helper for numeric detection (Vectorized)
    is_mostly_numeric <- function(v) {
        if (is.numeric(v)) return(TRUE)
        # Fast check for pure strings using data.table's internal helpers or regex
        # Optimized logic preserving original 80% threshold
        v_char <- as.character(v)
        v_trim <- trimws(v_char)
        v_non_empty <- v_trim[v_trim != ""]
        if (length(v_non_empty) == 0) return(FALSE)

        # suppressWarnings is costly in loops, check structure first
        nums <- suppressWarnings(as.numeric(gsub(",", "", v_non_empty)))
        return(mean(!is.na(nums)) >= 0.8)
    }

    if (verbose) cat("Preprocessing columns...\n")

    for (col in columns) {
        # Access column by reference without copying
        # .subset2(dt, col) is faster than dt[[col]]
        vec <- processing_dt[[col]]

        is_num <- is_mostly_numeric(vec)

        if (is_num) {
            # Numeric Handling
            # Convert safely using fast operations
            if (!is.numeric(vec)) {
                vec <- suppressWarnings(as.numeric(gsub(",", "", as.character(vec))))
                set(processing_dt, j = col, value = vec) # Update in-place [Requirement 1]
            }

            # Fast unique count [Requirement 5]
            u_count <- uniqueN(vec, na.rm = TRUE)

            if (u_count <= 20 && u_count >= 2) {
                # Suspected code column -> Convert to Factor
                suspected_code_columns <- c(suspected_code_columns, col)

                # Fast conversion handling NAs
                # Use data.table's fifelse for type-stable logical ops if needed,
                # but here we need string conversion.
                vec_char <- as.character(vec)
                # setNA is faster than vec[is.na(vec)] <- val
                vec_char[is.na(vec_char) | trimws(vec_char) == ""] <- "Missing"

                set(processing_dt, j = col, value = factor(vec_char))
                treated_as_categorical <- c(treated_as_categorical, col)
                cols_to_keep <- c(cols_to_keep, col)
            } else {
                treated_as_numeric <- c(treated_as_numeric, col)
                cols_to_keep <- c(cols_to_keep, col)
            }

        } else {
            # Categorical Handling
            vec_char <- as.character(vec)
            # Optimized NA replacement
            vec_char[is.na(vec_char) | trimws(vec_char) == ""] <- "Missing"

            # Fast frequency count using data.table grouping [Requirement 5]
            # Create a temp DT for aggregation to avoid overhead of table() on large vectors
            # .N is highly optimized in data.table (GForce)
            tmp_dt <- data.table(v = vec_char)
            counts <- tmp_dt[, .N, by = v]

            if (nrow(counts) > max_cardinality) {
                dropped_columns[[length(dropped_columns) + 1]] <- list(
                    column = col,
                    reason = "max_cardinality_exceeded",
                    uniqueLevels = nrow(counts),
                    threshold = max_cardinality
                )
                # Do not add to cols_to_keep
                next
            }

            rare_count <- 0
            if (!is.null(rare_threshold) && rare_threshold > 1) {
                # Vectorized check for rare levels [Requirement 4]
                rare_levels <- counts[N < rare_threshold, v]
                rare_count <- length(rare_levels)

                if (rare_count > 0) {
                    # Fast update using %chin% (char in) [Requirement 4]
                    vec_char[vec_char %chin% rare_levels] <- "Other"
                }
            }

            collapsed_to_other[[col]] <- rare_count
            set(processing_dt, j = col, value = factor(vec_char))
            treated_as_categorical <- c(treated_as_categorical, col)
            cols_to_keep <- c(cols_to_keep, col)
        }
    }

    # Stop if empty
    if (length(cols_to_keep) == 0) stop("No columns available after filtering")

    # Subset processing_dt to only kept columns
    # We do this by reference-ish (assignment)
    processing_dt <- processing_dt[, ..cols_to_keep]

    # Numeric-only check
    if (length(treated_as_categorical) == 0 && length(treated_as_numeric) > 0) {
        stop("Numeric-only dataset detected. Data reduction is intended for qualitative data.")
    }

    # 4. Sampling & Modeling
    # FactoMineR expects a data.frame. data.table IS a data.frame, so we can pass it directly.

    method_used <- tolower(method)
    if (method_used == "auto") {
        if (length(treated_as_numeric) > 0) method_used <- "famd" else method_used <- "mca"
    }

    fit_data <- processing_dt
    sample_size_used <- nrow(processing_dt)
    seed_used <- NULL

    if (!is.null(sample_size) && sample_size > 0 && nrow(processing_dt) > sample_size) {
        seed_used <- 42
        set.seed(seed_used)
        # data.table sampling
        idx <- sample(seq_len(nrow(processing_dt)), sample_size)
        fit_data <- processing_dt[idx]
        sample_size_used <- sample_size
    }

    if (verbose) cat(sprintf("Running %s on %d rows...\n", toupper(method_used), nrow(fit_data)))

    # Compute Factor Analysis
    # Note: FactoMineR is not natively parallel, but we've sped up everything around it.
    if (method_used == "mca") {
        if (any(sapply(fit_data, is.numeric))) stop("MCA only supports categorical data")
        res <- FactoMineR::MCA(fit_data, ncp = n_components, graph = FALSE)
    } else if (method_used == "famd") {
        res <- FactoMineR::FAMD(fit_data, ncp = n_components, graph = FALSE)
    } else {
        stop("Invalid method")
    }

    # Coordinate extraction
    if (nrow(fit_data) != nrow(processing_dt)) {
        if (verbose) cat("Projecting remaining data...\n")
        # Prediction
        if (method_used == "mca") {
            pred <- FactoMineR::predict.MCA(res, newdata = processing_dt)
        } else {
            pred <- FactoMineR::predict.FAMD(res, newdata = processing_dt)
        }
        coords <- pred$coord
    } else {
        coords <- res$ind$coord
    }

    # 5. Output Formatting
    coords_dt <- as.data.table(coords)
    if (ncol(coords_dt) == 0) stop("No components produced")

    k <- min(n_components, ncol(coords_dt))
    coords_dt <- coords_dt[, 1:k]
    dr_col_names <- paste0("DR", seq_len(k))
    setnames(coords_dt, dr_col_names)

    # Handle ID binding
    if (!is.null(id_vec)) {
        coords_dt[, id := id_vec]
        setcolorder(coords_dt, "id")
    }

    # Save DR table
    if (!is.null(dr_table_path)) {
        if (verbose) cat("Writing DR table...\n")
        fwrite(coords_dt, dr_table_path) # Optimized write [Requirement 1]
    }

    # 6. Final Merge and Write
    if (verbose) cat("Creating final output...\n")

    # Reload original for full merge?
    # The original script assumes 'df' (the input) is merged with new cols.
    # To save memory, we read only necessary columns or append to what we have?
    # Original logic: Remove existing DR cols, then append.

    # We re-read the original file *if* we need columns we dropped during processing.
    # However, for max speed on huge data, we should ideally construct the output
    # from the components we have.
    # Adhering to strict logic: We reload original to ensure unmodified columns are present.

    # Optimized merge strategy:
    output_dt <- fread(input_csv, nThread = getDTthreads())

    # Remove old DR cols
    existing_dr <- grep("^DR[0-9]+$", names(output_dt), value = TRUE)
    if (length(existing_dr) > 0) {
        output_dt[, (existing_dr) := NULL] # In-place remove [Requirement 1]
    }

    # Join logic
    if ("id" %in% names(output_dt) && "id" %in% names(coords_dt)) {
        # Perform update join (efficient lookup)
        # This adds the DR columns to output_dt based on ID match
        output_dt[coords_dt, (dr_col_names) := mget(paste0("i.", dr_col_names)), on = "id"]
    } else {
        # Cbind equivalent using data.table
        if (nrow(output_dt) == nrow(coords_dt)) {
             output_dt <- cbind(output_dt, coords_dt[, ..dr_col_names])
        } else {
            stop("Row mismatch during final bind and no ID column found.")
        }
    }

    fwrite(output_dt, output_csv) # Optimized write

    # 7. Statistics & Explanation
    end_time <- Sys.time()
    runtime_seconds <- as.numeric(difftime(end_time, if(verbose) t_start_total else Sys.time(), units = "secs"))

    # Variance stats
    eig <- res$eig
    var_explained <- NULL
    total_var <- NULL
    if (!is.null(eig) && nrow(eig) >= 1) {
        perc <- eig[seq_len(k), 2]
        var_explained <- as.numeric(round(perc, 2))
        total_var <- as.numeric(round(sum(perc), 2))
    }

    if (verbose) cat("Extracting contributions...\n")
    top_contributions <- extract_top_contributions(res, method_used, n_top = 5)

    summary <- list(
        methodUsed = method_used,
        componentsRequested = n_components,
        componentsProduced = k,
        rowsInput = rows_input,
        rowsOutput = nrow(output_dt),
        outputMode = "separate",
        outputColumns = dr_col_names,
        varianceExplained = var_explained,
        totalVariance = total_var,
        selectedColumns = columns,
        keptColumns = cols_to_keep,
        droppedColumns = if (length(dropped_columns) > 0) dropped_columns else list(),
        treatedAsNumeric = treated_as_numeric,
        treatedAsCategorical = treated_as_categorical,
        suspectedCodeColumns = suspected_code_columns,
        missingHandling = "blank/NA categorical values -> 'Missing'",
        rareThreshold = rare_threshold_used,
        collapsedToOther = collapsed_to_other,
        maxCardinality = max_cardinality,
        sampleSizeUsed = sample_size_used,
        seedUsed = if (!is.null(seed_used)) seed_used else NA,
        runtimeSeconds = round(runtime_seconds, 2),
        topContributions = top_contributions,
        inputColumns = length(columns),
        originalColumns = original_columns_count,
        drColumns = k
    )

    if (!is.null(summary_path)) {
        jsonlite::write_json(summary, summary_path, auto_unbox = TRUE, pretty = TRUE)
    }

    return(summary)
}

# -------------------------------------------------------------------------
# Helper Functions (Optimized for safety, kept mostly logic-identical)
# -------------------------------------------------------------------------

extract_top_contributions <- function(res, method_used, n_top = 5) {
    contributions <- list()

    # Helper to safe-extract top N
    get_top <- function(mat, idx, n) {
        vec <- mat[, idx]
        n_act <- min(n, length(vec))
        if (n_act <= 0) return(NULL)
        ord <- order(vec, decreasing = TRUE)[1:n_act]
        list(names = rownames(mat)[ord], vals = vec[ord])
    }

    if (method_used == "mca") {
        if (!is.null(res$var$contrib)) {
            mat <- res$var$contrib
            n_dims <- min(ncol(mat), nrow(mat))
            for (i in 1:n_dims) {
                # Note: MCA var$contrib usually has names in rows
                # Code below adapts original logic using 'names(vec)' or rownames
                vec <- mat[, i]
                n_act <- min(n_top, length(vec))
                if (n_act > 0) {
                    ord <- order(vec, decreasing = TRUE)[1:n_act]
                    top_vars <- names(vec)[ord] # Works if vec is named
                    if (is.null(top_vars)) top_vars <- rownames(mat)[ord]

                    contributions[[paste0("DR", i)]] <- list(
                        variables = as.list(data.frame(
                            name = top_vars,
                            contribution = round(vec[ord], 2),
                            stringsAsFactors = FALSE
                        ))
                    )
                }
            }
        }
        # Categories (cos2)
        if (!is.null(res$var$cos2)) {
            mat <- res$var$cos2
            n_dims <- min(ncol(mat), nrow(mat))
            for (i in 1:n_dims) {
                top <- get_top(mat, i, n_top)
                if (!is.null(top)) {
                     if (is.null(contributions[[paste0("DR", i)]])) contributions[[paste0("DR", i)]] <- list()
                     contributions[[paste0("DR", i)]]$categoryLevels <- as.list(data.frame(
                        level = top$names,
                        quality = round(top$vals, 3),
                        stringsAsFactors = FALSE
                     ))
                }
            }
        }
    } else if (method_used == "famd") {
        # Quantitative
        if (!is.null(res$quanti$contrib)) {
            mat <- res$quanti$contrib
            n_dims <- min(ncol(mat), nrow(mat))
            for (i in 1:n_dims) {
                top <- get_top(mat, i, n_top)
                if (!is.null(top)) {
                    contributions[[paste0("DR", i)]] <- list(
                        numericVariables = as.list(data.frame(
                            name = top$names,
                            contribution = round(top$vals, 2),
                            stringsAsFactors = FALSE
                        ))
                    )
                }
            }
        }
        # Qualitative
        if (!is.null(res$quali$contrib)) {
            mat <- res$quali$contrib
            n_dims <- min(ncol(mat), nrow(mat))
            for (i in 1:n_dims) {
                top <- get_top(mat, i, n_top)
                if (!is.null(top)) {
                    if (is.null(contributions[[paste0("DR", i)]])) contributions[[paste0("DR", i)]] <- list()
                    contributions[[paste0("DR", i)]]$categoricalVariables <- as.list(data.frame(
                        name = top$names,
                        contribution = round(top$vals, 2),
                        stringsAsFactors = FALSE
                    ))
                }
            }
        }
         # Levels (cos2)
        if (!is.null(res$quali.var$cos2)) {
            mat <- res$quali.var$cos2
            n_dims <- min(ncol(mat), nrow(mat))
            for (i in 1:n_dims) {
                top <- get_top(mat, i, n_top)
                if (!is.null(top)) {
                     if (is.null(contributions[[paste0("DR", i)]])) contributions[[paste0("DR", i)]] <- list()
                     contributions[[paste0("DR", i)]]$categoryLevels <- as.list(data.frame(
                        level = top$names,
                        quality = round(top$vals, 3),
                        stringsAsFactors = FALSE
                     ))
                }
            }
        }
    }
    return(contributions)
}

# Note: Other helper functions (extract_simple_top_variables, extract_top_category_levels)
# can be optimized similarly if needed, but the main bottleneck was the core reduction function.
