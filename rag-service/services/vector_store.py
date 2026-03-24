from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
import uuid
from config import QDRANT_HOST, QDRANT_PORT, QDRANT_COLLECTION, EMBEDDING_DIM

_client = None


def _ensure_collection():
    collections = _client.get_collections().collections
    exists = any(c.name == QDRANT_COLLECTION for c in collections)

    if not exists:
        _client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=EMBEDDING_DIM,
                distance=Distance.COSINE,
            ),
        )
        print(f"Created collection: {QDRANT_COLLECTION}")
    else:
        print(f"Collection {QDRANT_COLLECTION} already exists")


async def init_vector_store():
    global _client
    print(f"Connecting to Qdrant at {QDRANT_HOST}:{QDRANT_PORT}")
    _client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    _ensure_collection()


def recreate_collection():
    if _client is None:
        raise RuntimeError("Vector store not initialized. Call init_vector_store() first.")

    collections = _client.get_collections().collections
    exists = any(c.name == QDRANT_COLLECTION for c in collections)
    if exists:
        _client.delete_collection(collection_name=QDRANT_COLLECTION)
        print(f"Deleted collection: {QDRANT_COLLECTION}")

    _ensure_collection()


def upsert_documents(chunks: list[dict]) -> int:
    """Upsert document chunks into Qdrant.
    chunks: [{"text": str, "metadata": dict}]
    """
    from services.embeddings import get_embeddings

    texts = [c["text"] for c in chunks]
    embeddings = get_embeddings(texts)

    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=emb,
            payload={"text": chunk["text"], **chunk.get("metadata", {})},
        )
        for chunk, emb in zip(chunks, embeddings)
    ]

    _client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return len(points)


def search(query_embedding: list[float], top_k: int = 10) -> list[dict]:
    response = _client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=query_embedding,
        limit=top_k,
        with_payload=True,
    )
    results = response.points

    return [
        {
            "text": (r.payload or {}).get("text", ""),
            "score": r.score,
            "metadata": {
                k: v for k, v in (r.payload or {}).items() if k != "text"
            },
        }
        for r in results
    ]


def get_all_documents() -> list[dict]:
    """Get all documents for BM25 index building."""
    results = _client.scroll(
        collection_name=QDRANT_COLLECTION,
        limit=10000,
        with_payload=True,
    )

    return [
        {
            "text": r.payload.get("text", ""),
            "id": str(r.id),
            "metadata": {k: v for k, v in r.payload.items() if k != "text"},
        }
        for r in results[0]
    ]


def get_collection_count() -> int:
    try:
        info = _client.get_collection(QDRANT_COLLECTION)
        return info.points_count or 0
    except Exception:
        return 0
