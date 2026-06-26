import sys
import json
import os
import argparse
import numpy as np

# --- Sentence Embedding and FAISS Indexing Explanation ---
# 1. FAISS (Facebook AI Similarity Search) is a library for efficient similarity search of dense vectors.
#    It contains algorithms that search in sets of vectors of any size, up to ones that possibly do not fit in RAM.
# 2. We are using IndexFlatIP (Inner Product) on L2-normalized embeddings.
#    This mathematically computes exactly the Cosine Similarity metric:
#    CosineSimilarity(A, B) = (A . B) / (||A|| * ||B||)
#    Since we normalize both chunk and query embeddings to unit length (L2 norm = 1.0), the Inner Product is exactly Cosine Similarity.
# 3. For each document, we create a custom index file (.index) and a companion metadata catalog (.json).
#    This allows us to scale retrieval per-document or merge indexes dynamically.
# 4. If FAISS-CPU fails to compile or load in this container, we implement a vectorized numpy fallback that 
#    computes the exact same normalized inner products, guaranteeing 100% service uptime.

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

def get_embedder_and_faiss():
    """
    Gracefully imports Sentence Transformers and FAISS, enabling fallbacks if needed.
    """
    sentence_transformers_available = False
    model = None
    faiss_available = False
    faiss_lib = None

    try:
        from sentence_transformers import SentenceTransformer
        sentence_transformers_available = True
        model = SentenceTransformer('all-MiniLM-L6-v2')
    except ImportError:
        pass

    try:
        import faiss
        faiss_available = True
        faiss_lib = faiss
    except ImportError:
        pass

    return sentence_transformers_available, model, faiss_available, faiss_lib

def handle_index(pdf_id, pdf_path, output_dir):
    """
    Extracts text from a PDF, creates chunks, generates embeddings,
    builds a FAISS index, and saves it to disk with metadata.
    """
    if not os.path.exists(pdf_path):
        print(json.dumps({"success": False, "error": f"PDF file not found at: {pdf_path}"}))
        sys.exit(1)

    # 1. Try PyMuPDF import
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print(json.dumps({
            "success": False, 
            "error": "PyMuPDF (fitz) is not installed in the Python environment."
        }))
        sys.exit(1)

    # 2. Try Embeddings and FAISS imports
    st_ok, model, faiss_ok, faiss = get_embedder_and_faiss()

    if not st_ok or model is None:
        print(json.dumps({
            "success": False,
            "error": "Sentence-Transformers is not available. Please ensure sentence-transformers is installed."
        }))
        sys.exit(1)

    try:
        # Create output directory for FAISS files
        os.makedirs(output_dir, exist_ok=True)
        index_file_path = os.path.join(output_dir, f"{pdf_id}.index")
        metadata_file_path = os.path.join(output_dir, f"{pdf_id}.json")

        doc = fitz.open(pdf_path)
        pages_data = []
        all_chunks = []
        embeddings_list = []
        
        chunk_counter = 0 # 0-indexed for FAISS row mapping
        
        for index, page in enumerate(doc):
            page_num = index + 1
            text = page.get_text()
            cleaned_text = text.strip()
            
            pages_data.append({
                "page": page_num,
                "text": cleaned_text
            })
            
            page_chunks = chunk_text(cleaned_text, chunk_size=500, overlap=100)
            
            for idx, ch in enumerate(page_chunks):
                # Generate embedding
                emb = model.encode(ch["text"])
                # L2 normalization for Cosine Similarity Inner Product
                emb_norm = emb / np.linalg.norm(emb)
                embeddings_list.append(emb_norm)

                chunk_payload = {
                    "chunkId": chunk_counter + 1,
                    "faissRowId": chunk_counter,
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
                all_chunks.append(chunk_payload)
                chunk_counter += 1
        
        doc.close()

        if chunk_counter == 0:
            print(json.dumps({
                "success": False,
                "error": "No text extracted from PDF. FAISS Index building skipped."
            }))
            sys.exit(0)

        # Convert embeddings list to numpy float32 matrix
        embeddings_matrix = np.array(embeddings_list).astype('float32')
        dimension = embeddings_matrix.shape[1]

        # 3. Create FAISS Index or store matrix for NumPy fallback
        using_real_faiss = False
        if faiss_ok and faiss is not None:
            try:
                # IndexFlatIP uses Inner Product (exact Cosine Similarity since vectors are normalized)
                index = faiss.IndexFlatIP(dimension)
                index.add(embeddings_matrix)
                faiss.write_index(index, index_file_path)
                using_real_faiss = True
            except Exception as fe:
                # If FAISS write fails, we will fall back to saving numpy array directly
                pass

        # If we can't use FAISS directly, we will store the raw normalized embeddings inside the metadata JSON 
        # as a robust fallback so search can still calculate cosine similarity dynamically using numpy.
        catalog = {
            "pdfId": pdf_id,
            "filename": os.path.basename(pdf_path),
            "totalPages": len(doc),
            "totalChunks": chunk_counter,
            "dimension": dimension,
            "usingRealFaiss": using_real_faiss,
            "chunks": all_chunks
        }

        # If not using real FAISS, serialize the float matrix to catalog for numpy similarity calculation
        if not using_real_faiss:
            catalog["fallbackEmbeddings"] = embeddings_matrix.tolist()

        with open(metadata_file_path, "w", encoding="utf-8") as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)

        print(json.dumps({
            "success": True,
            "filename": os.path.basename(pdf_path),
            "totalPages": len(doc),
            "totalChunks": chunk_counter,
            "dimension": dimension,
            "usingRealFaiss": using_real_faiss,
            "indexFilePath": index_file_path if using_real_faiss else None,
            "metadataFilePath": metadata_file_path
        }))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

def handle_search(pdf_id, query, output_dir, top_k=5):
    """
    Embeds the user search query, runs similarity search over index,
    and returns top K most relevant matches with metadata.
    """
    index_file_path = os.path.join(output_dir, f"{pdf_id}.index")
    metadata_file_path = os.path.join(output_dir, f"{pdf_id}.json")

    if not os.path.exists(metadata_file_path):
        print(json.dumps({"success": False, "error": f"FAISS Index/Metadata not found for Document ID: {pdf_id}. Please perform extraction/indexing first."}))
        sys.exit(1)

    # 1. Load catalog metadata
    try:
        with open(metadata_file_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to load metadata catalog: {str(e)}"}))
        sys.exit(1)

    # 2. Import sentence transformers & FAISS
    st_ok, model, faiss_ok, faiss = get_embedder_and_faiss()

    if not st_ok or model is None:
        print(json.dumps({"success": False, "error": "Sentence-Transformers is not available for query embedding."}))
        sys.exit(1)

    try:
        # Generate query embedding
        query_emb = model.encode(query)
        # Normalize for exact Cosine Similarity
        query_emb_norm = (query_emb / np.linalg.norm(query_emb)).astype('float32').reshape(1, -1)

        chunks = catalog["chunks"]
        results = []

        # Try searching with FAISS index first
        if catalog.get("usingRealFaiss") and faiss_ok and faiss is not None and os.path.exists(index_file_path):
            try:
                index = faiss.read_index(index_file_path)
                # Search FAISS index
                # D is distances/similarities (inner product), I is indices
                D, I = index.search(query_emb_norm, min(top_k, len(chunks)))
                
                for sim, row_idx in zip(D[0], I[0]):
                    if row_idx == -1 or row_idx >= len(chunks):
                        continue
                    match_chunk = chunks[row_idx]
                    results.append({
                        "chunkId": match_chunk["chunkId"],
                        "page": match_chunk["page"],
                        "text": match_chunk["text"],
                        "similarityScore": float(sim),
                        "metadata": match_chunk["metadata"]
                    })
            except Exception as fe:
                # If FAISS reading/searching fails, fall back to numpy search if fallback embeddings exist
                pass

        # NumPy Dynamic Vectorized Fallback
        if not results:
            embeddings_list = []
            if "fallbackEmbeddings" in catalog:
                embeddings_list = catalog["fallbackEmbeddings"]
            else:
                # Regenerate embeddings on-the-fly or extract if saved
                print(json.dumps({"success": False, "error": "FAISS Index file missing and no numpy fallback embeddings found. Please re-index the document."}))
                sys.exit(1)

            embeddings_matrix = np.array(embeddings_list).astype('float32')
            # Compute dot product between normalized matrix and normalized query vector (dimensions: [N, D] x [D, 1] -> [N])
            similarities = np.dot(embeddings_matrix, query_emb_norm.T).flatten()
            
            # Get indices of top K highest similarity scores
            top_indices = np.argsort(similarities)[::-1][:top_k]
            
            for idx in top_indices:
                match_chunk = chunks[idx]
                results.append({
                    "chunkId": match_chunk["chunkId"],
                    "page": match_chunk["page"],
                    "text": match_chunk["text"],
                    "similarityScore": float(similarities[idx]),
                    "metadata": match_chunk["metadata"]
                })

        print(json.dumps({
            "success": True,
            "query": query,
            "documentId": pdf_id,
            "filename": catalog["filename"],
            "totalChunksSearched": len(chunks),
            "topK": top_k,
            "results": results
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": f"Search execution failed: {str(e)}"}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FAISS Indexing & Similarity Search Engine")
    subparsers = parser.add_argument_group("Commands")
    
    # Simple manual command router
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing command (index | search)"}))
        sys.exit(1)

    cmd = sys.argv[1]
    output_directory = os.path.join(os.cwd() if hasattr(os, 'cwd') else os.getcwd(), "uploads", "faiss_indexes")

    if cmd == "index":
        # Extract arguments
        parser.add_argument("command")
        parser.add_argument("--pdf-id", required=True, type=int)
        parser.add_argument("--pdf-path", required=True)
        args = parser.parse_args()
        handle_index(args.pdf_id, args.pdf_path, output_directory)

    elif cmd == "search":
        parser.add_argument("command")
        parser.add_argument("--pdf-id", required=True, type=int)
        parser.add_argument("--query", required=True)
        parser.add_argument("--top-k", type=int, default=5)
        args = parser.parse_args()
        handle_search(args.pdf_id, args.query, output_directory, args.top_k)

    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {cmd}"}))
        sys.exit(1)
