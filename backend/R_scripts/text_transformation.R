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

## 1. Get sentence embeddings ----------------------------------------------
get_sentence_embeddings <- function(texts, model_name = "all-MiniLM-L6-v2") {
  tryCatch({
    st <- reticulate::import("sentence_transformers")
    model <- st$SentenceTransformer(model_name)
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

## 2. Find optimal K using silhouette score ---------------------------------
find_optimal_k <- function(emb_matrix, k_min = 2L, k_max = 20L) {
  n_rows <- nrow(emb_matrix)
  
  # Adjust max_k based on data size
  k_max <- min(k_max, floor(sqrt(n_rows / 2)))
  k_max <- max(k_min, k_max)
  k_min <- max(2L, min(3L, n_rows))
  
  if (k_max <= k_min) {
    return(k_min)
  }
  
  message("Finding optimal number of clusters (testing ", k_min, " to ", k_max, ")...")
  
  # Load cluster package for silhouette
  if (!requireNamespace("cluster", quietly = TRUE)) {
    warning("Package 'cluster' not installed. Using heuristic k = sqrt(n/2)")
    return(ceiling(sqrt(n_rows / 2)))
  }
  
  best_score <- -1
  best_k <- k_min
  
  for (k in k_min:k_max) {
    tryCatch({
      set.seed(42)
      km <- stats::kmeans(emb_matrix, centers = k, iter.max = 100, nstart = 10)
      sil <- cluster::silhouette(km$cluster, stats::dist(emb_matrix))
      score <- mean(sil[, 3])
      
      if (score > best_score) {
        best_score <- score
        best_k <- k
      }
    }, error = function(e) {
      # Skip this k if it fails
    })
  }
  
  message("Optimal clusters: ", best_k, " (silhouette score: ", round(best_score, 3), ")")
  best_k
}

## 3. K-means clustering on embeddings -------------------------------------
cluster_embeddings <- function(emb_matrix, k) {
  if (nrow(emb_matrix) < k) {
    k <- max(2L, nrow(emb_matrix))
  }
  
  set.seed(42)
  km <- stats::kmeans(emb_matrix, centers = k, iter.max = 100, nstart = 10)
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

## 5. Keyphrase labels using KeyBERT ---------------------------------------
get_keyphrase_labels <- function(cluster_texts, max_words = 3, model_name = "all-MiniLM-L6-v2") {
  tryCatch({
    kb <- reticulate::import("keybert")
    kw_model <- kb$KeyBERT(model_name)
    
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
  
  # Identify missing values
  na_mask <- is.na(text_vec) | text_vec == "" | text_vec == "NA"
  
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
  # Keep missing values as-is (they'll be handled separately)
  result_column <- df[[text_col]]
  for (i in seq_along(valid_indices)) {
    result_column[valid_indices[i]] <- theme_titles[cluster_ids[i]]
  }
  
  df[[text_col]] <- result_column
  
  message("Transformation complete: ", length(unique(theme_titles)), " unique themes created")
  message("Processed ", length(valid_indices), " rows, skipped ", n_missing, " missing values")
  message("Original column '", text_col, "' replaced with theme labels (missing values preserved)")
  
  df
}

## 7. CSV-based function for backend integration ---------------------------
transform_text_csv <- function(input_csv, output_csv, columns, k = NULL, model_name = "all-MiniLM-L6-v2") {
  
  # Read CSV
  df <- read.csv(input_csv, stringsAsFactors = FALSE, check.names = FALSE)
  
  # Validate columns
  invalid_cols <- columns[!columns %in% names(df)]
  if (length(invalid_cols) > 0) {
    stop(paste0("Columns not found: ", paste(invalid_cols, collapse = ", ")))
  }
  
  # Apply transformation to each text column
  for (col in columns) {
    message("\n--- Processing column: ", col, " ---")
    df <- transform_text_column(
      df, 
      text_col = col, 
      k = k, 
      max_label_words = 3,  # Fixed at 3 words
      model_name = model_name,
      max_docs_per_cluster = 100L
    )
  }
  
  # Write output
  write.csv(df, output_csv, row.names = FALSE)
  message("\nOutput written to: ", output_csv)
  
  invisible(df)
}

## 8. Example usage --------------------------------------------------------
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
