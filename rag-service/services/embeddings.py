from fastembed import TextEmbedding
from config import EMBEDDING_MODEL

_model = None


async def init_embeddings():
    global _model
    print(f"Loading embedding model: {EMBEDDING_MODEL}")
    _model = TextEmbedding(EMBEDDING_MODEL)
    # Warm up with a dummy embed
    list(_model.embed(["warmup"]))
    print("Embedding model ready")


def get_embeddings(texts: list[str]) -> list[list[float]]:
    if _model is None:
        raise RuntimeError("Embeddings not initialized. Call init_embeddings() first.")
    return [emb.tolist() for emb in _model.embed(texts)]


def get_embedding(text: str) -> list[float]:
    return get_embeddings([text])[0]
