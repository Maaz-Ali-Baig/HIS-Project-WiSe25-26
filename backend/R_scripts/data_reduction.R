# Data reduction using MCA/FAMD for qualitative datasets

reduce_data_csv <- function(
    input_csv,
    output_csv,
    columns,
    method = "auto",
    n_components = 5,
    rare_threshold = 5,
    max_cardinality = 200,
    sample_size = NULL,
    summary_path = NULL
) {
    if (!requireNamespace("FactoMineR", quietly = TRUE)) {
        stop("FactoMineR not installed")
    }
    if (!requireNamespace("jsonlite", quietly = TRUE)) {
        stop("jsonlite not installed")
    }

    df <- utils::read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
    if (length(columns) == 0) {
        stop("No columns selected")
    }

    missing_cols <- setdiff(columns, names(df))
    if (length(missing_cols) > 0) {
        stop(paste("Columns not found:", paste(missing_cols, collapse = ", ")))
    }

    data <- df[, columns, drop = FALSE]

    detect_numeric <- function(vec) {
        if (is.numeric(vec)) {
            return(TRUE)
        }
        vals <- trimws(as.character(vec))
        vals <- vals[vals != ""]
        if (length(vals) == 0) {
            return(FALSE)
        }
        nums <- suppressWarnings(as.numeric(gsub(",", "", vals)))
        mean(!is.na(nums)) >= 0.8
    }

    numeric_cols <- sapply(data, detect_numeric)
    if (all(numeric_cols)) {
        stop("Numeric-only dataset detected. Data reduction is intended for qualitative data.")
    }

    kept <- list()

    for (col_name in names(data)) {
        vec <- data[[col_name]]
        if (numeric_cols[[col_name]]) {
            vec_num <- suppressWarnings(as.numeric(gsub(",", "", as.character(vec))))
            kept[[col_name]] <- vec_num
        } else {
            vec_chr <- as.character(vec)
            vec_chr[is.na(vec_chr) | trimws(vec_chr) == ""] <- "Missing"
            tbl <- table(vec_chr)
            if (length(tbl) > max_cardinality) {
                next
            }
            if (!is.null(rare_threshold) && rare_threshold > 1) {
                rare_levels <- names(tbl)[tbl < rare_threshold]
                vec_chr[vec_chr %in% rare_levels] <- "Other"
            }
            kept[[col_name]] <- factor(vec_chr)
        }
    }

    if (length(kept) == 0) {
        stop("No columns available after filtering")
    }

    data_clean <- as.data.frame(kept, stringsAsFactors = FALSE)

    method_used <- tolower(method)
    if (method_used == "auto") {
        if (any(sapply(data_clean, is.numeric))) {
            method_used <- "famd"
        } else {
            method_used <- "mca"
        }
    }

    fit_data <- data_clean
    if (!is.null(sample_size) && sample_size > 0 && nrow(data_clean) > sample_size) {
        set.seed(42)
        idx <- sample(seq_len(nrow(data_clean)), sample_size)
        fit_data <- data_clean[idx, , drop = FALSE]
    }

    if (method_used == "mca") {
        if (any(sapply(fit_data, is.numeric))) {
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
    names(coords_df) <- paste0("DR", seq_len(k))

    if ("id" %in% names(df)) {
        coords_df <- cbind(id = df$id, coords_df)
    }

    # Remove existing DR columns to avoid duplicates
    dr_cols <- grep("^DR[0-9]+$", names(df), value = TRUE)
    if (length(dr_cols) > 0) {
        df <- df[, setdiff(names(df), dr_cols), drop = FALSE]
    }

    # Append DR columns to original dataset
    if ("id" %in% names(df) && "id" %in% names(coords_df)) {
        idx <- match(df$id, coords_df$id)
        output_df <- df
        for (col_name in names(coords_df)) {
            if (col_name == "id") {
                next
            }
            output_df[[col_name]] <- coords_df[[col_name]][idx]
        }
    } else {
        output_df <- cbind(df, coords_df)
    }

    utils::write.csv(output_df, output_csv, row.names = FALSE, na = "")
    eig <- res$eig
    var_explained <- NULL
    total_var <- NULL
    if (!is.null(eig) && nrow(eig) >= 1) {
        perc <- eig[seq_len(k), 2]
        var_explained <- as.numeric(round(perc, 2))
        total_var <- as.numeric(round(sum(perc), 2))
    }
    summary <- list(
        method = method_used,
        components = k,
        inputColumns = length(columns),
        originalColumns = ncol(df),
        drColumns = k,
        outputColumns = ncol(output_df),
        varianceExplained = var_explained,
        totalVariance = total_var
    )

    if (!is.null(summary_path)) {
        jsonlite::write_json(summary, summary_path, auto_unbox = TRUE)
    }

    return(summary)
}







