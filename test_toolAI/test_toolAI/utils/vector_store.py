import os
import faiss
import numpy as np
import pickle
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

MODEL_NAME = "all-MiniLM-L6-v2"
INDEX_DIR = "data/index"

def ensure_index_dir():
    os.makedirs(INDEX_DIR, exist_ok=True)

def build_embeddings_model(model_name=MODEL_NAME):
    return SentenceTransformer(model_name)

def create_faiss_index(chunks, model=None, index_path=None):

    ensure_index_dir()
    if model is None:
        model = build_embeddings_model()

    # compute embeddings (float32)
    embeddings = []
    for chunk in tqdm(chunks, desc="Embedding chunks"):
        emb = model.encode(chunk, show_progress_bar=False)
        embeddings.append(emb.astype("float32"))
    embeddings = np.vstack(embeddings)  # shape (n, dim)

    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # cosine via normalized vectors; use inner product
    # normalize vectors for cosine similarity
    faiss.normalize_L2(embeddings)
    index.add(embeddings)  # add to index

    # save to disk: index + embeddings texts
    if index_path is None:
        index_path = os.path.join(INDEX_DIR, "faiss_index.bin")
    faiss.write_index(index, index_path)

    # save texts and optionally original embeddings for retrieval metadata
    meta_path = os.path.join(INDEX_DIR, "meta.pkl")
    with open(meta_path, "wb") as f:
        pickle.dump({"texts": chunks, "model_name": model}, f)

    return index, embeddings, chunks

def load_faiss_index(index_path=None):
    ensure_index_dir()
    if index_path is None:
        index_path = os.path.join(INDEX_DIR, "faiss_index.bin")
    meta_path = os.path.join(INDEX_DIR, "meta.pkl")
    if not os.path.exists(index_path) or not os.path.exists(meta_path):
        raise FileNotFoundError("Index or meta not found. Build index first.")

    index = faiss.read_index(index_path)
    with open(meta_path, "rb") as f:
        meta = pickle.load(f)
    texts = meta["texts"]
    model = build_embeddings_model(meta.get("model_name", MODEL_NAME))
    return index, model, texts

def retrieve_top_k(query, index, model, texts, k=4):
    q_emb = model.encode(query).astype("float32")
    faiss.normalize_L2(q_emb.reshape(1, -1))
    D, I = index.search(q_emb.reshape(1, -1), k)  # D = scores, I = indices
    results = []
    for score, idx in zip(D[0], I[0]):
        if idx < 0 or idx >= len(texts):
            continue
        results.append((texts[idx], float(score)))
    return results
