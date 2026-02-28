import os
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from utils.vector_store import load_faiss_index, retrieve_top_k
import openai

# -------------------------------------------------------
# 1. Load FAISS index và model embedding local
# -------------------------------------------------------
def load_local_retriever():
    index, model, texts = load_faiss_index()
    return index, model, texts


# -------------------------------------------------------
# 2. Truy vấn FAISS bằng câu hỏi người dùng
# -------------------------------------------------------
def retrieve_context(query, index, model, texts, k=4):
    results = retrieve_top_k(query, index, model, texts, k)
    context = "\n\n---\n\n".join([r[0] for r in results])
    return context, results


# -------------------------------------------------------
# 3. Gọi LLM (OpenAI hoặc OpenRouter)
# -------------------------------------------------------
def call_llm(prompt, model_name="gpt-3.5-turbo", use_openrouter=False):
    import openai
    import os

    if use_openrouter:
        openai.api_base = "https://openrouter.ai/api/v1"
        openai.api_key = os.getenv("OPENROUTER_API_KEY")
    else:
        openai.api_base = "https://api.openai.com/v1"
        openai.api_key = os.getenv("OPENAI_API_KEY")

    # Gọi model
    response = openai.ChatCompletion.create(
        model=model_name,
        messages=[
            {"role": "system", "content": "You are a helpful assistant that answers based on the given context."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=512,
    )

    return response["choices"][0]["message"]["content"]



# -------------------------------------------------------
# 4. Hàm chính: RAG pipeline
# -------------------------------------------------------
def answer_query(query, top_k=4, llm_model="gpt-3.5-turbo", use_openrouter=False):
    """
    query: câu hỏi người dùng
    top_k: số đoạn văn muốn retrieve
    llm_model: tên model LLM
    use_openrouter: True nếu dùng OpenRouter API key
    """
    index, emb_model, texts = load_local_retriever()
    context, results = retrieve_context(query, index, emb_model, texts, k=top_k)

    prompt = f"""
    Use the following context from a document to answer the question.
    If the answer is not in the context, say you don't know.

    Context:
    {context}

    Question: {query}
    Answer:
    """

    answer = call_llm(prompt, model_name=llm_model, use_openrouter=use_openrouter)
    return answer, results
