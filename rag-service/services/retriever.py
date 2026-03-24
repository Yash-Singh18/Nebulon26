from services.embeddings import get_embeddings
from services.vector_store import search as vector_search
from services.keyword_search import search as bm25_search
from config import TOP_K_VECTOR, TOP_K_BM25, FINAL_TOP_K, CONFIDENCE_STRONG, CONFIDENCE_MEDIUM


def retrieve_parallel(
    queries: list[str],
    top_k_vector: int = TOP_K_VECTOR,
    top_k_bm25: int = TOP_K_BM25,
) -> dict:
    """Run vector and BM25 retrieval for all queries."""

    all_vector_results = []
    all_bm25_results = []

    # Batch embed all queries at once
    embeddings = get_embeddings(queries)

    for i, query in enumerate(queries):
        # Vector search
        v_results = vector_search(embeddings[i], top_k=top_k_vector)
        for r in v_results:
            r["source"] = "vector"
        all_vector_results.extend(v_results)

        # BM25 search
        b_results = bm25_search(query, top_k=top_k_bm25)
        all_bm25_results.extend(b_results)

    return {"vector": all_vector_results, "bm25": all_bm25_results}


def reciprocal_rank_fusion(results_dict: dict, k: int = 60) -> list[dict]:
    """Merge results from multiple retrievers using RRF."""

    doc_scores = {}

    for source, results in results_dict.items():
        for rank, result in enumerate(results):
            text = result["text"]
            rrf_score = 1.0 / (k + rank + 1)

            if text in doc_scores:
                doc_scores[text]["score"] += rrf_score
            else:
                doc_scores[text] = {"score": rrf_score, "doc": result}

    sorted_docs = sorted(
        doc_scores.values(), key=lambda x: x["score"], reverse=True
    )

    return [
        {
            "text": item["doc"]["text"],
            "score": item["score"],
            "original_score": item["doc"].get("score", 0),
            "metadata": item["doc"].get("metadata", {}),
        }
        for item in sorted_docs
    ]


def calculate_confidence(vector_results: list[dict]) -> float:
    """Confidence = max cosine similarity from vector search."""
    if not vector_results:
        return 0.0
    return max(r.get("score", 0) for r in vector_results)


def retrieve_and_score(queries: list[str]) -> dict:
    """Full retrieval: parallel search -> RRF merge -> confidence gate -> top-k."""

    results = retrieve_parallel(queries)
    merged = reciprocal_rank_fusion(results)
    confidence = calculate_confidence(results["vector"])
    top_chunks = merged[:FINAL_TOP_K]

    if confidence >= CONFIDENCE_STRONG:
        confidence_level = "strong"
    elif confidence >= CONFIDENCE_MEDIUM:
        confidence_level = "medium"
    else:
        confidence_level = "weak"

    return {
        "chunks": top_chunks,
        "confidence": confidence,
        "confidence_level": confidence_level,
        "total_retrieved": len(merged),
    }
