"""Knowledge base ingestion — loads markdown docs, chunks them, stores in Qdrant."""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter

KNOWLEDGE_DIR = Path(__file__).parent.parent / "data" / "knowledge_base"


def load_documents() -> list[dict]:
    """Load all markdown files from the knowledge base directory."""
    documents = []

    for md_file in sorted(KNOWLEDGE_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8")
        documents.append(
            {
                "text": content,
                "metadata": {
                    "source": md_file.name,
                    "topic": md_file.stem.replace("_", " ").title(),
                },
            }
        )

    return documents


def chunk_documents(documents: list[dict]) -> list[dict]:
    """Split documents into retrieval-friendly chunks."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n## ", "\n### ", "\n#### ", "\n\n", "\n", ". ", " "],
        keep_separator=True,
    )

    chunks = []
    for doc in documents:
        splits = splitter.split_text(doc["text"])
        for i, split in enumerate(splits):
            text = split.strip()
            if len(text) > 20:
                chunks.append(
                    {
                        "text": text,
                        "metadata": {**doc["metadata"], "chunk_index": i},
                    }
                )

    return chunks


# Allow running as standalone script
if __name__ == "__main__":
    import asyncio
    from services.embeddings import init_embeddings
    from services.vector_store import init_vector_store, upsert_documents, get_collection_count
    from services.keyword_search import rebuild_index

    async def main():
        print("Initializing embeddings model...")
        await init_embeddings()

        print("Connecting to Qdrant...")
        await init_vector_store()

        count = get_collection_count()
        if count > 0:
            print(f"Collection already has {count} documents. Delete collection to re-ingest.")
            return

        print(f"Loading documents from {KNOWLEDGE_DIR}...")
        documents = load_documents()
        print(f"Loaded {len(documents)} documents")

        print("Chunking documents...")
        chunks = chunk_documents(documents)
        print(f"Created {len(chunks)} chunks")

        print("Embedding and upserting to Qdrant...")
        for i in range(0, len(chunks), 100):
            batch = chunks[i : i + 100]
            n = upsert_documents(batch)
            print(f"  Batch {i // 100 + 1}: {n} chunks")

        print("Building BM25 index...")
        rebuild_index([{"text": c["text"], "metadata": c["metadata"]} for c in chunks])

        print(f"Done! Total chunks indexed: {len(chunks)}")

    asyncio.run(main())
