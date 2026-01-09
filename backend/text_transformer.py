"""
Text Transformation using Sentence Embeddings & K-means Clustering
Pure Python implementation - no R required
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional, List


def transform_text_column(
    df: pd.DataFrame,
    column_name: str,
    n_clusters: Optional[int] = None,
) -> pd.DataFrame:
    """
    Transform a text column into categorical themes using embeddings and clustering.
    
    Args:
        df: DataFrame containing the text column
        column_name: Name of the column to transform
        n_clusters: Number of clusters (auto-detect if None using silhouette score)
    
    Returns:
        DataFrame with text column replaced by meaningful theme labels
    """
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score
        from sklearn.feature_extraction.text import TfidfVectorizer
        from collections import Counter
        import re
    except ImportError as e:
        raise ImportError(f"Required package not installed: {e}")
    
    # Get text data
    texts = df[column_name].astype(str).tolist()
    
    # Identify missing values
    missing_mask = df[column_name].isna() | (df[column_name] == "") | (df[column_name] == "NA")
    
    if missing_mask.all():
        raise ValueError(f"Column '{column_name}' contains only missing values")
    
    # Filter out missing values - only process valid texts
    if isinstance(missing_mask, pd.Series):
        valid_indices = [i for i in range(len(texts)) if not missing_mask.iloc[i]]
    else:
        valid_indices = [i for i in range(len(texts)) if not missing_mask[i]]
    valid_texts = [texts[i] for i in valid_indices]
    
    # Clean valid texts
    cleaned_texts = []
    for text in valid_texts:
        # Remove extra whitespace and newlines
        text = re.sub(r'\s+', ' ', str(text)).strip()
        cleaned_texts.append(text)
    
    # Generate embeddings with better model (only for valid texts)
    print(f"Generating embeddings for {len(cleaned_texts)} valid texts (skipping {missing_mask.sum()} missing values)...")
    # Use a better model for more semantic understanding
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(cleaned_texts, show_progress_bar=False, normalize_embeddings=True)
    
    # Auto-determine optimal number of clusters using silhouette score
    if n_clusters is None:
        valid_count = len(cleaned_texts)
        # Try different cluster counts and find the best one
        max_k = max(2, min(20, int(np.sqrt(valid_count / 2))))
        min_k = max(2, min(3, valid_count))
        
        if max_k > min_k:
            from sklearn.metrics import silhouette_score
            best_score = -1
            best_k = min_k
            
            print(f"Finding optimal number of clusters (testing {min_k} to {max_k})...")
            for k in range(min_k, max_k + 1):
                try:
                    kmeans_test = KMeans(n_clusters=k, random_state=42, n_init=10)
                    test_labels = kmeans_test.fit_predict(embeddings)
                    score = silhouette_score(embeddings, test_labels, sample_size=min(1000, len(embeddings)))
                    
                    if score > best_score:
                        best_score = score
                        best_k = k
                except:
                    continue
            
            n_clusters = best_k
            print(f"Optimal clusters: {n_clusters} (silhouette score: {best_score:.3f})")
        else:
            n_clusters = min_k
    
    print(f"Clustering into {n_clusters} themes...")
    
    # Ensure we don't have more clusters than samples
    n_clusters = min(n_clusters, len(embeddings))
    
    # Perform clustering
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    cluster_ids = kmeans.fit_predict(embeddings)
    
    # Generate theme labels with improved approach
    print("Generating theme labels...")
    theme_labels = []
    
    for cluster_id in range(n_clusters):
        # Get texts in this cluster
        cluster_mask = (cluster_ids == cluster_id)
        cluster_texts = [cleaned_texts[i] for i in range(len(cleaned_texts)) if cluster_mask[i]]
        
        if not cluster_texts:
            theme_labels.append(f"Theme_{cluster_id + 1}")
            continue
        
        # Use KeyBERT for better theme extraction if available
        try:
            from keybert import KeyBERT
            # Combine cluster texts for keyphrase extraction
            combined_text = " ".join(cluster_texts[:100])  # Sample up to 100 texts
            
            kw_model = KeyBERT('all-MiniLM-L6-v2')
            keywords = kw_model.extract_keywords(
                combined_text,
                keyphrase_ngram_range=(1, 3),
                stop_words='english',
                top_n=5,
                use_maxsum=True,
                nr_candidates=20
            )
            
            if keywords:
                # Get the top keyword phrase
                best_keyword = keywords[0][0]
                # Limit to 3 words
                words = best_keyword.split()[:3]
                label = ' '.join(words).title()
                theme_labels.append(label)
            else:
                theme_labels.append(f"Theme_{cluster_id + 1}")
                
        except ImportError:
            # Fallback to TF-IDF based approach if KeyBERT not available
            from sklearn.feature_extraction.text import TfidfVectorizer
            
            # Create TF-IDF for this cluster
            vectorizer = TfidfVectorizer(
                max_features=100,
                stop_words='english',
                ngram_range=(1, 3),
                min_df=1
            )
            
            try:
                tfidf_matrix = vectorizer.fit_transform(cluster_texts[:100])
                feature_names = vectorizer.get_feature_names_out()
                
                # Get average TF-IDF scores
                avg_scores = np.asarray(tfidf_matrix.mean(axis=0)).ravel()
                top_indices = avg_scores.argsort()[-3:][::-1]
                
                # Get top phrases
                top_phrases = [feature_names[i] for i in top_indices if avg_scores[i] > 0]
                
                if top_phrases:
                    # Use the most representative phrase
                    label = top_phrases[0].replace('_', ' ').title()
                    # Limit to 3 words
                    words = label.split()[:3]
                    theme_labels.append(' '.join(words))
                else:
                    theme_labels.append(f"Theme_{cluster_id + 1}")
            except:
                theme_labels.append(f"Theme_{cluster_id + 1}")
    
    # Map cluster labels back to original dataframe positions
    # Keep missing values as-is (they'll be handled separately)
    result_column = df[column_name].copy()
    for i, valid_idx in enumerate(valid_indices):
        result_column.iloc[valid_idx] = theme_labels[cluster_ids[i]]
    
    df[column_name] = result_column
    
    print(f"Transformation complete: {len(set(theme_labels))} unique themes created")
    print(f"Processed {len(valid_indices)} rows, skipped {missing_mask.sum()} missing values")
    print(f"Original column '{column_name}' replaced with theme labels (missing values preserved)")
    
    return df

def transform_csv(
    input_path: str,
    output_path: str,
    columns: List[str],
    n_clusters: Optional[int] = None,
) -> None:
    """
    Transform text columns in a CSV file.
    
    Args:
        input_path: Path to input CSV
        output_path: Path to output CSV
        columns: List of column names to transform
        n_clusters: Number of clusters (auto-detect if None)
    """
    # Read CSV
    df = pd.read_csv(input_path)
    
    # Validate columns
    missing_cols = [col for col in columns if col not in df.columns]
    if missing_cols:
        raise ValueError(f"Columns not found: {', '.join(missing_cols)}")
    
    # Transform each column
    for col in columns:
        print(f"\n--- Processing column: {col} ---")
        df = transform_text_column(df, col, n_clusters)
    
    # Save result
    df.to_csv(output_path, index=False)
    print(f"\nOutput written to: {output_path}")


if __name__ == "__main__":
    # Example usage
    pass
