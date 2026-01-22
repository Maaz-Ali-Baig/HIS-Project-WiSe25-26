## ============================================================================
## Text Transformation using Sentence Embeddings & Clustering
## ============================================================================
## This script transforms free text columns into categorical themes using:
## 1. Sentence embeddings (sentence-transformers)
## 2. K-means clustering
## 3. KeyBERT for automatic theme labeling
## ============================================================================

# Check and load required packages
if (!requireNamespace("reticulate", quietly = TRUE)) {
  stop("Package 'reticulate' is required. Install it with: install.packages('reticulate')")
}

library(reticulate)

# Verify Python packages are available
tryCatch({
  st_test <- reticulate::import("sentence_transformers")
}, error = function(e) {
  stop("Python package 'sentence-transformers' not found. Install it with: pip install sentence-transformers")
})

tryCatch({
  kb_test <- reticulate::import("keybert")
}, error = function(e) {
  stop("Python package 'keybert' not found. Install it with: pip install keybert")
})

## Global cache for models to avoid reloading
.text_transform_cache <- new.env()

## Helper to get cached sentence transformer model
get_cached_sentence_model <- function(model_name = "all-MiniLM-L6-v2") {
  cache_key <- paste0("st_model_", model_name)
  
  if (!exists(cache_key, envir = .text_transform_cache)) {
    message("Loading sentence transformer model (first time only)...")
    st <- reticulate::import("sentence_transformers")
    model <- st$SentenceTransformer(model_name)
    assign(cache_key, model, envir = .text_transform_cache)
  }
  
  get(cache_key, envir = .text_transform_cache)
}

## Helper to get cached KeyBERT model
get_cached_keybert_model <- function(model_name = "all-MiniLM-L6-v2") {
  cache_key <- paste0("kb_model_", model_name)
  
  if (!exists(cache_key, envir = .text_transform_cache)) {
    message("Loading KeyBERT model (first time only)...")
    kb <- reticulate::import("keybert")
    model <- kb$KeyBERT(model_name)
    assign(cache_key, model, envir = .text_transform_cache)
  }
  
  get(cache_key, envir = .text_transform_cache)
}

## 1. Get sentence embeddings (with caching) ------------------------------
get_sentence_embeddings <- function(texts, model_name = "all-MiniLM-L6-v2") {
  tryCatch({
    model <- get_cached_sentence_model(model_name)
    emb <- model$encode(texts, normalize_embeddings = TRUE, show_progress_bar = FALSE)
    emb <- as.matrix(emb)
    rownames(emb) <- NULL
    emb
  }, error = function(e) {
    stop(paste0(
      "Failed to generate embeddings. ",
      "Ensure 'sentence-transformers' is installed: pip install sentence-transformers. ",
      "Error: ", conditionMessage(e)
    ))
  })
}

## 2. Find optimal K using fast heuristic ---------------------------------
find_optimal_k <- function(emb_matrix, k_min = 2L, k_max = 15L) {
  n_rows <- nrow(emb_matrix)
  
  # Use simple heuristic: sqrt(n/2) - MUCH faster than testing multiple K
  k <- ceiling(sqrt(n_rows / 2))
  k <- max(k_min, min(k, k_max))
  k <- min(k, n_rows)
  
  message("Using ", k, " clusters (heuristic: sqrt(n/2))")
  k
}

## 3. K-means clustering on embeddings -------------------------------------
cluster_embeddings <- function(emb_matrix, k) {
  if (nrow(emb_matrix) < k) {
    k <- max(2L, nrow(emb_matrix))
  }
  
  set.seed(42)
  # Reduced iterations for speed: iter.max=50, nstart=3
  km <- stats::kmeans(emb_matrix, centers = k, iter.max = 50, nstart = 3)
  list(cluster = km$cluster, centers = km$centers)
}

## 4. Build cluster documents for labeling ---------------------------------
build_cluster_texts <- function(text_clean, cluster_ids, max_docs = 100L) {
  K <- max(cluster_ids)
  cluster_texts <- vector("list", K)
  
  for (c in seq_len(K)) {
    idx <- which(cluster_ids == c)
    if (length(idx) == 0) {
      cluster_texts[[c]] <- ""
      next
    }
    
    # Sample if too many documents
    if (length(idx) > max_docs) {
      idx <- sample(idx, max_docs)
    }
    cluster_texts[[c]] <- paste(text_clean[idx], collapse = " ")
  }
  
  cluster_texts
}

## 5. Keyphrase labels using KeyBERT (with caching) -----------------------
get_keyphrase_labels <- function(cluster_texts, max_words = 3, model_name = "all-MiniLM-L6-v2") {
  tryCatch({
    kw_model <- get_cached_keybert_model(model_name)
    
    K <- length(cluster_texts)
    labels <- character(K)
    
    for (i in seq_len(K)) {
      txt <- cluster_texts[[i]]
      
      if (is.null(txt) || is.na(txt) || nchar(txt) < 5) {
        labels[i] <- paste0("Theme_", i)
        next
      }
      
      # Extract keyphrases
      kw <- kw_model$extract_keywords(
        txt,
        keyphrase_ngram_range = c(1L, 3L),
        stop_words = "english",
        top_n = 5L
      )
      
      if (length(kw) == 0) {
        labels[i] <- paste0("Theme_", i)
        next
      }
      
      # Get first keyphrase
      kw_df <- as.data.frame(kw, stringsAsFactors = FALSE)
      phrase <- as.character(kw_df[1, 1])
      
      # Enforce max_words
      words <- strsplit(phrase, "\\s+")[[1]]
      if (length(words) > max_words) {
        phrase <- paste(words[1:max_words], collapse = " ")
      }
      
      # Capitalize first letter
      phrase <- paste0(toupper(substring(phrase, 1, 1)), substring(phrase, 2))
      labels[i] <- phrase
    }
    
    labels
  }, error = function(e) {
    warning(paste0("KeyBERT labeling failed, using default labels. Error: ", conditionMessage(e)))
    paste0("Theme_", seq_len(length(cluster_texts)))
  })
}

## 6. Main transformation function -----------------------------------------
transform_text_column <- function(df, text_col, k = NULL, max_label_words = 3, 
                                  model_name = "all-MiniLM-L6-v2", 
                                  max_docs_per_cluster = 100L) {
  
  # Validate column exists
  if (!text_col %in% names(df)) {
    stop(paste0("Column '", text_col, "' not found in data"))
  }
  
  text_vec <- df[[text_col]]
  
  # Define missing value tokens (consistent with MissingValues.R)
  missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                      "#n/a", "#na", "missing", "n.a.", "<na>")
  
  # Identify missing values using comprehensive check
  na_mask <- is.na(text_vec)
  if (is.character(text_vec)) {
    text_trimmed <- tolower(trimws(text_vec))
    na_mask <- na_mask | (text_trimmed %in% missing_tokens)
  }
  
  if (all(na_mask)) {
    stop(paste0("Column '", text_col, "' contains only empty/missing values"))
  }
  
  # Filter out missing values - only process valid texts
  valid_indices <- which(!na_mask)
  valid_texts <- text_vec[valid_indices]
  
  # Clean valid texts
  text_clean <- gsub("[\r\n]+", " ", valid_texts)
  text_clean <- gsub("\\s+", " ", text_clean)
  text_clean <- trimws(text_clean)
  
  # Generate embeddings (only for valid texts)
  n_missing <- sum(na_mask)
  message("Generating embeddings for ", length(text_clean), " valid texts (skipping ", n_missing, " missing values)...")
  emb <- get_sentence_embeddings(text_clean, model_name = model_name)
  
  # Auto-determine optimal K if not provided
  if (is.null(k)) {
    k <- find_optimal_k(emb, k_min = 2L, k_max = 20L)
  } else {
    message("Clustering into ", k, " themes...")
  }
  
  # Ensure we don't have more clusters than samples
  k <- min(k, nrow(emb))
  
  # Perform clustering
  cl <- cluster_embeddings(emb, k)
  cluster_ids <- cl$cluster
  
  # Build cluster texts for labeling
  cluster_texts <- build_cluster_texts(
    text_clean,
    cluster_ids,
    max_docs_per_cluster = max_docs_per_cluster
  )
  
  # Get theme labels
  message("Generating theme labels...")
  theme_titles <- get_keyphrase_labels(
    cluster_texts,
    max_words = max_label_words,
    model_name = model_name
  )
  
  # Map cluster labels back to original dataframe positions
  # Initialize result column - convert to character first
  result_column <- as.character(df[[text_col]])
  
  # Only replace valid (non-missing) entries with theme labels
  for (i in seq_along(valid_indices)) {
    result_column[valid_indices[i]] <- theme_titles[cluster_ids[i]]
  }
  
  # Convert all missing value positions back to NA
  # This ensures they stay as missing and don't get theme labels
  result_column[na_mask] <- NA
  
  df[[text_col]] <- result_column
  
  message("Transformation complete: ", length(unique(theme_titles)), " unique themes created")
  message("Processed ", length(valid_indices), " valid rows, preserved ", n_missing, " missing values as NA")
  message("Original column '", text_col, "' replaced with theme labels (missing values = NA)")
  
  df
}

## 7. Batch transformation for multiple columns (OPTIMIZED) ---------------
transform_text_columns_batch <- function(df, text_cols, k = NULL, model_name = "all-MiniLM-L6-v2") {
  
  message("\n=== BATCH MODE: Processing ", length(text_cols), " columns together ===")
  
  # Define missing value tokens
  missing_tokens <- c("", "na", "n/a", "nan", "none", "null", "nil", 
                      "#n/a", "#na", "missing", "n.a.", "<na>")
  
  # Collect all texts from all columns
  all_texts <- character()
  text_origins <- list()  # Track which column and row each text came from
  col_row_mapping <- list()
  
  for (col in text_cols) {
    if (!col %in% names(df)) {
      warning(paste0("Column '", col, "' not found, skipping"))
      next
    }
    
    text_vec <- as.character(df[[col]])
    
    # Identify missing values
    na_mask <- is.na(text_vec)
    if (is.character(text_vec)) {
      text_trimmed <- tolower(trimws(text_vec))
      na_mask <- na_mask | (text_trimmed %in% missing_tokens)
    }
    
    # Store valid text indices for this column
    valid_indices <- which(!na_mask)
    
    if (length(valid_indices) > 0) {
      valid_texts <- text_vec[valid_indices]
      
      # Clean texts
      valid_texts <- gsub("[\r\n]+", " ", valid_texts)
      valid_texts <- gsub("\\s+", " ", valid_texts)
      valid_texts <- trimws(valid_texts)
      
      # Store mapping
      start_idx <- length(all_texts) + 1
      end_idx <- start_idx + length(valid_texts) - 1
      text_origins[[col]] <- list(
        indices = start_idx:end_idx,
        row_indices = valid_indices,
        na_mask = na_mask
      )
      
      all_texts <- c(all_texts, valid_texts)
    } else {
      text_origins[[col]] <- list(
        indices = integer(0),
        row_indices = integer(0),
        na_mask = na_mask
      )
    }
  }
  
  if (length(all_texts) == 0) {
    stop("No valid text found in any of the selected columns")
  }
  
  message("Total valid texts collected: ", length(all_texts))
  
  # Generate embeddings ONCE for all texts from all columns
  message("Generating embeddings for all texts...")
  emb <- get_sentence_embeddings(all_texts, model_name = model_name)
  
  # Find optimal K if not provided
  if (is.null(k)) {
    k <- find_optimal_k(emb, k_min = 2L, k_max = 15L)
  } else {
    message("Clustering into ", k, " themes...")
  }
  
  k <- min(k, nrow(emb))
  
  # Perform clustering ONCE
  message("Clustering all texts...")
  cl <- cluster_embeddings(emb, k)
  cluster_ids <- cl$cluster
  
  # Build cluster texts and get labels ONCE
  cluster_texts <- build_cluster_texts(all_texts, cluster_ids, max_docs = 100L)
  
  message("Generating theme labels...")
  theme_titles <- get_keyphrase_labels(cluster_texts, max_words = 3, model_name = model_name)
  
  message("\nApplying themes to individual columns...")
  
  # Map results back to each column
  for (col in names(text_origins)) {
    origin <- text_origins[[col]]
    
    if (length(origin$indices) == 0) {
      # All missing in this column
      df[[col]] <- NA
      message("  ", col, ": All values were missing, set to NA")
      next
    }
    
    # Get cluster assignments for this column's texts
    col_clusters <- cluster_ids[origin$indices]
    col_themes <- theme_titles[col_clusters]
    
    # Initialize result column
    result_column <- as.character(df[[col]])
    
    # Apply themes to valid rows
    result_column[origin$row_indices] <- col_themes
    
    # Set missing values to NA
    result_column[origin$na_mask] <- NA
    
    df[[col]] <- result_column
    
    n_valid <- length(origin$row_indices)
    n_missing <- sum(origin$na_mask)
    message("  ", col, ": ", n_valid, " rows themed, ", n_missing, " set to NA")
  }
  
  message("\n=== BATCH TRANSFORMATION COMPLETE ===")
  message("Created ", length(unique(theme_titles)), " unique themes across all columns")
  
  df
}

## 8. CSV-based function for backend integration ---------------------------
transform_text_csv <- function(input_csv, output_csv, columns, k = NULL, model_name = "all-MiniLM-L6-v2") {
  
  # Read CSV
  df <- read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
  
  # Validate columns
  invalid_cols <- columns[!columns %in% names(df)]
  if (length(invalid_cols) > 0) {
    stop(paste0("Columns not found: ", paste(invalid_cols, collapse = ", ")))
  }
  
  # Use batch processing for multiple columns (MUCH FASTER)
  if (length(columns) > 1) {
    df <- transform_text_columns_batch(
      df, 
      text_cols = columns,
      k = k,
      model_name = model_name
    )
  } else {
    # Single column - use original method
    message("\n--- Processing single column: ", columns[1], " ---")
    df <- transform_text_column(
      df, 
      text_col = columns[1], 
      k = k, 
      max_label_words = 3,
      model_name = model_name,
      max_docs_per_cluster = 100L
    )
  }
  
  # Write output
  write.csv(df, output_csv, row.names = FALSE)
  message("\nOutput written to: ", output_csv)
  
  invisible(df)
}

## 9. Example usage --------------------------------------------------------
# df <- data.frame(
#   id = 1:6,
#   text = c(
#     "Mr. Chairman, I would like to speak about the procedure.",
#     "I oppose this nomination to the Supreme Court.",
#     "Protesters are shouting in the gallery.",
#     "This hearing is part of our constitutional duty.",
#     "Security must remove the demonstrators.",
#     "I support the nominee for the Court."
#   ),
#   stringsAsFactors = FALSE
# )
#
# result <- transform_text_column(
#   df,
#   text_col = "text",
#   k = 3,
#   max_label_words = 3,
#   model_name = "all-MiniLM-L6-v2"
# )
#
# print(result)
