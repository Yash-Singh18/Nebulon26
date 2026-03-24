"""Knowledge base ingestion — loads markdown docs, chunks them, stores in Qdrant."""

import sys
import os
import subprocess

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

KNOWLEDGE_DIR = Path(__file__).parent.parent / "data" / "knowledge_base"


def extract_pdf_text(pdf_file: Path) -> str:
    """Extract PDF text with a pypdf-first strategy and pdftotext fallback."""
    try:
        reader = PdfReader(str(pdf_file))
        pages = []
        for page_number, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                pages.append(f"[Page {page_number}]\n{text}")

        return "\n\n".join(pages).strip()
    except Exception as exc:
        print(f"Falling back to pdftotext for {pdf_file.name}: {exc}")
        result = subprocess.run(
            ["pdftotext", str(pdf_file), "-"],
            capture_output=True,
            text=True,
            check=True,
        )
        pages = [
            f"[Page {page_number}]\n{page.strip()}"
            for page_number, page in enumerate(result.stdout.split("\f"), start=1)
            if page.strip()
        ]
        return "\n\n".join(pages).strip()


def load_documents() -> list[dict]:
    """Load markdown and PDF files from the knowledge base directory."""
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

    for pdf_file in sorted(KNOWLEDGE_DIR.glob("*.pdf")):
        content = extract_pdf_text(pdf_file)
        if not content:
            continue

        documents.append(
            {
                "text": content,
                "metadata": {
                    "source": pdf_file.name,
                    "topic": pdf_file.stem.replace("_", " ").title(),
                    "file_type": "pdf",
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
    from services.vector_store import (
        init_vector_store,
        upsert_documents,
        get_collection_count,
        recreate_collection,
    )
    from services.keyword_search import rebuild_index

    async def main():
        print("Initializing embeddings model...")
        await init_embeddings()

        print("Connecting to Qdrant...")
        await init_vector_store()
        recreate_collection()

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
        print(f"Collection now contains {get_collection_count()} vectors")

    asyncio.run(main())
