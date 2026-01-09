# Free Text Transformation Feature

## Overview
The Free Text Transformation feature automatically converts free text columns into categorical themes using state-of-the-art AI techniques. This is useful for analyzing survey responses, customer feedback, comments, and any other unstructured text data.

## How It Works

### Technology Stack
1. **Sentence Embeddings**: Uses `sentence-transformers` to convert text into high-dimensional vectors that capture semantic meaning
2. **K-means Clustering**: Groups similar texts together based on their embeddings
3. **KeyBERT**: Automatically generates descriptive theme labels using keyphrase extraction

### Workflow
1. Text is cleaned and preprocessed
2. Each text is converted to a semantic embedding vector
3. K-means clustering groups similar texts
4. KeyBERT extracts representative keyphrases for each cluster
5. Two new columns are created:
   - `[column_name]_theme_id`: Numeric theme identifier
   - `[column_name]_theme_label`: Descriptive theme name

## Installation

### Backend Dependencies
The following Python packages are required and should be installed automatically:

```bash
cd backend
venv311\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

pip install sentence-transformers keybert
```

These are already included in `requirements.txt`:
- `sentence-transformers>=2.2.0` - For semantic embeddings
- `keybert>=0.8.0` - For automatic theme labeling

### R Dependencies
The R script uses `reticulate` to call Python libraries:

```r
install.packages("reticulate")
```

## Usage

### From the UI

1. **Navigate to Pre-Processing Page**
   - Upload or open a CSV file
   - Go to the Pre-Processing section

2. **Open Free Text Transformation Panel**
   - Located at the top of the sidebar, above "Handle Missing Values"

3. **Select Columns**
   - Choose one or more columns containing free text
   - Examples: comments, feedback, descriptions, open-ended responses

4. **Configure Parameters** (Optional)
   - **Number of Themes**: Leave empty for automatic detection, or specify 2-50
     - Automatic uses √n formula (e.g., 100 rows → ~10 themes)
     - More themes = finer categorization
   - **Max Words in Theme Labels**: 1-5 words (default: 3)
     - Controls how long the generated theme names will be

5. **Apply Transformation**
   - Click "Apply Transformation"
   - Wait for processing (may take 10-60 seconds depending on data size)
   - Two new columns will be added for each selected text column

### From the API

**Endpoint**: `POST /api/files/text-transformation`

**Request Body**:
```json
{
  "userId": "user-id",
  "fileId": "file-id",
  "selected_columns": ["feedback", "comments"],
  "k": null,  // or a number for manual theme count
  "max_label_words": 3
}
```

**Response**: Updated file data with new theme columns

## Examples

### Example 1: Customer Feedback

**Input** (column: `feedback`):
```
"The product quality is excellent!"
"Very satisfied with my purchase."
"Poor customer service experience."
"Shipping was delayed by 2 weeks."
"Great value for money."
"The item arrived damaged."
```

**Output**:
```
feedback_theme_id | feedback_theme_label
1                 | Product quality
1                 | Product quality
2                 | Customer service
3                 | Shipping delivery
1                 | Product quality
3                 | Shipping delivery
```

### Example 2: Survey Responses

**Input** (column: `why_visit`):
```
"I needed to see a doctor about my headaches."
"Annual checkup and physical examination."
"Follow-up appointment for diabetes."
"Emergency visit due to chest pain."
"Prescription refill for medication."
```

**Output**:
```
why_visit_theme_id | why_visit_theme_label
1                  | Medical symptoms
2                  | Routine checkup
3                  | Chronic condition
4                  | Emergency care
3                  | Chronic condition
```

## Parameters

### k (Number of Themes)
- **Type**: Integer or `null`
- **Default**: `null` (automatic)
- **Range**: 2-50
- **Description**: Number of themes to create
- **Recommendation**: Leave empty for automatic detection unless you have specific requirements

### max_label_words
- **Type**: Integer
- **Default**: 3
- **Range**: 1-5
- **Description**: Maximum words in generated theme labels
- **Recommendation**: 
  - Use 2-3 for concise labels
  - Use 4-5 for more descriptive labels

## Performance Considerations

### Processing Time
- **Small datasets** (<100 rows): 5-15 seconds
- **Medium datasets** (100-1000 rows): 15-45 seconds
- **Large datasets** (1000-5000 rows): 45-120 seconds

Processing time depends on:
- Number of rows
- Text length
- Number of columns
- Available CPU/GPU resources

### Memory Usage
- Embeddings are generated in batches
- Typical memory usage: 100-500 MB per column
- GPU acceleration is used if available (recommended for large datasets)

### Best Practices
1. **Column Selection**: Only select columns with meaningful free text
2. **Data Size**: For very large datasets (>5000 rows), consider sampling
3. **Empty Values**: Empty/missing values are automatically handled
4. **Original Data**: Original text columns are preserved

## Technical Details

### R Script Location
`backend/R_scripts/text_transformation.R`

### Python Integration
`backend/files/r_integration.py` - `handle_text_transformation()`

### API Endpoint
`backend/files/routes.py` - `/api/files/text-transformation`

### Frontend Components
- `frontend/.../TextTransformationPanel.tsx` - UI component
- `frontend/.../uploads.ts` - API integration

### Model Details
- **Default Model**: `all-MiniLM-L6-v2`
  - Fast and efficient
  - 384-dimensional embeddings
  - Good balance of speed and quality
- **Alternative Models**: Can be configured in R script
  - `all-mpnet-base-v2` - Better quality, slower
  - `paraphrase-multilingual-MiniLM-L12-v2` - Multilingual support

## Troubleshooting

### Error: "sentence_transformers not installed"
```bash
pip install sentence-transformers
```

### Error: "keybert not installed"
```bash
pip install keybert
```

### Error: "R is not properly configured"
- Ensure R is installed and in PATH
- Set R_HOME environment variable
- Restart the backend server

### Slow Performance
- Check if GPU is available: CUDA-enabled GPU can significantly speed up processing
- Reduce number of themes
- Process fewer columns at once
- Consider sampling large datasets

### Poor Theme Quality
- Increase number of themes (k parameter)
- Ensure text is meaningful (not just IDs or codes)
- Increase max_label_words for more descriptive names
- Check for data quality issues (too much noise, too short text)

## Future Enhancements
- Custom model selection
- Hierarchical clustering
- LLM-based theme naming
- Theme visualization
- Manual theme refinement
- Multi-language support configuration

## Support
For issues or questions, please check:
1. Backend logs for error messages
2. Frontend console for API errors
3. R script output for processing details
