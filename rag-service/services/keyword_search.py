import re
from rank_bm25 import BM25Okapi

_bm25 = None
_documents = []


def _tokenize(text: str) -> list[str]:
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if len(t) > 1]


async def init_bm25():
    global _bm25, _documents
    from services.vector_store import get_all_documents

    _documents = get_all_documents()

    if _documents:
        corpus = [_tokenize(doc["text"]) for doc in _documents]
        _bm25 = BM25Okapi(corpus)
        print(f"BM25 index built with {len(_documents)} documents")
    else:
        print("No documents found for BM25 index")


def rebuild_index(documents: list[dict]):
    global _bm25, _documents
    _documents = documents
    if _documents:
        corpus = [_tokenize(doc["text"]) for doc in _documents]
        _bm25 = BM25Okapi(corpus)


def search(query: str, top_k: int = 10) -> list[dict]:
    if _bm25 is None or not _documents:
        return []

    tokens = _tokenize(query)
    if not tokens:
        return []

    scores = _bm25.get_scores(tokens)

    top_indices = sorted(
        range(len(scores)), key=lambda i: scores[i], reverse=True
    )[:top_k]

    results = []
    for idx in top_indices:
        if scores[idx] > 0:
            results.append(
                {
                    "text": _documents[idx]["text"],
                    "score": float(scores[idx]),
                    "metadata": _documents[idx].get("metadata", {}),
                    "source": "bm25",
                }
            )

    return results
