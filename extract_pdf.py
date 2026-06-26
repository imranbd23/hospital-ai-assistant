import sys
import json
import os

# --- Sentence Embedding Generation Explanation ---
# Sentence Transformers is a Python framework for state-of-the-art sentence, text, and image embeddings.
# The model 'all-MiniLM-L6-v2' is a lightweight yet extremely powerful model from the Hugging Face hub.
# It is specifically tuned for semantic search, grouping, and retrieval tasks (RAG - Retrieval-Augmented Generation).
# Key properties of all-MiniLM-L6-v2:
# 1. Output Dimension: 384 dimensions (a 384-float vector).
# 2. Maximum Sequence Length: 256 tokens (roughly 1000 characters). Our 500-character chunks fit comfortably within this limit.
# 3. Training Objective: Trained on over 1 billion sentence pairs, learning to map semantically similar sentences close to each other in a multi-dimensional space.
# 4. Use Case: Ideal for RAG applications because we can calculate Cosine Similarity between user query embeddings and document chunk embeddings to find relevant contexts.

def chunk_text(text, chunk_size=500, overlap=100):
    """
    Splits text into overlapping chunks of a given character size.
    Preserves text continuity by carrying over 'overlap' number of characters.
    """
    chunks = []
    if not text:
        return chunks
    
    start = 0
    text_len = len(text)
    
    while start < text_len:
        end = start + chunk_size
        chunk = text[start:end]
        
        chunks.append({
            "text": chunk,
            "startIndex": start,
            "endIndex": min(end, text_len),
            "length": len(chunk)
        })
        
        # If the end of text has been reached, we break
        if end >= text_len:
            break
            
        # Move forward by (chunk_size - overlap)
        step = chunk_size - overlap
        if step <= 0:
            step = 1  # prevent infinite loop
        start += step
        
    return chunks

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path specified as argument"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    # 1. Import PyMuPDF (fitz)
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print(json.dumps({
            "success": False, 
            "error": "PyMuPDF (fitz) is not installed in the Python environment. Please run pip install pymupdf."
        }))
        sys.exit(1)

    # 2. Import Sentence Transformers
    # If the system is still installing sentence-transformers or fails, we gracefully capture and report.
    sentence_transformers_available = False
    model = None
    try:
        from sentence_transformers import SentenceTransformer
        sentence_transformers_available = True
        
        # --- Loading the Embedding Model ---
        # We load the all-MiniLM-L6-v2 model. If the model weights are not present on disk,
        # SentenceTransformer automatically downloads them from the Hugging Face repository and caches them.
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except ImportError:
        # We do not crash; we can proceed with text extraction and let the user know sentence-transformers needs installation.
        pass
    except Exception as model_err:
        print(json.dumps({"success": False, "error": f"Failed to load SentenceTransformer: {str(model_err)}"}))
        sys.exit(1)

    try:
        doc = fitz.open(pdf_path)
        pages_data = []
        all_chunks = []
        
        chunk_counter = 1
        
        # 3. Parse and chunk document page-by-page
        for index, page in enumerate(doc):
            page_num = index + 1
            # Extract plain text from page
            text = page.get_text()
            cleaned_text = text.strip()
            
            pages_data.append({
                "page": page_num,
                "text": cleaned_text
            })
            
            # Generate RAG chunks for this page (500 chars with 100-char overlap)
            page_chunks = chunk_text(cleaned_text, chunk_size=500, overlap=100)
            
            for idx, ch in enumerate(page_chunks):
                chunk_payload = {
                    "chunkId": chunk_counter,
                    "page": page_num,
                    "text": ch["text"],
                    "length": ch["length"],
                    "startIndex": ch["startIndex"],
                    "endIndex": ch["endIndex"],
                    "metadata": {
                        "fileName": os.path.basename(pdf_path),
                        "pageNumber": page_num,
                        "chunkOnPage": idx + 1,
                        "overlap": 100,
                        "chunkSize": 500
                    }
                }
                
                # --- Embedding Generation via SentenceTransformer ---
                # We feed the clean textual chunk to our loaded transformer model.
                # The model performs tokenization, feeds the tokens to the transformer layers, 
                # pools the final hidden state, and outputs a normalized dense vector of floats.
                if sentence_transformers_available and model is not None:
                    try:
                        # encode() generates a numpy array. We convert it to a standard Python list of floats 
                        # so that it can be cleanly serialized to JSON and stored in a vector-ready database.
                        embedding_vector = model.encode(ch["text"]).tolist()
                        chunk_payload["embedding"] = embedding_vector
                        chunk_payload["embeddingModel"] = "all-MiniLM-L6-v2"
                        chunk_payload["embeddingDimension"] = len(embedding_vector)
                    except Exception as enc_err:
                        chunk_payload["embeddingError"] = str(enc_err)
                else:
                    chunk_payload["embedding"] = None
                    chunk_payload["embeddingWarning"] = "sentence-transformers library not installed. Standard text extraction succeeded, but dense embeddings were skipped."

                all_chunks.append(chunk_payload)
                chunk_counter += 1
        
        doc.close()
        
        # Add totalChunks count to metadata
        total_chunks = len(all_chunks)
        for ch in all_chunks:
            ch["metadata"]["totalChunksInDocument"] = total_chunks
            
        print(json.dumps({
            "success": True,
            "filename": os.path.basename(pdf_path),
            "totalPages": len(doc),
            "pages": pages_data,
            "chunks": all_chunks,
            "sentenceTransformersInstalled": sentence_transformers_available
        }, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
