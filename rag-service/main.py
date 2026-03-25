from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routes.chat import router as chat_router
from routes.voice import router as voice_router
from services.embeddings import init_embeddings
from services.vector_store import init_vector_store, get_collection_count
from services.keyword_search import init_bm25, rebuild_index
from services.memory import init_redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──
    await init_embeddings()
    await init_vector_store()

    # Auto-ingest if knowledge base is empty
    if get_collection_count() == 0:
        print("Knowledge base empty — running auto-ingestion...")
        from scripts.ingest import load_documents, chunk_documents
        from services.vector_store import upsert_documents

        documents = load_documents()
        chunks = chunk_documents(documents)
        print(f"Loaded {len(documents)} docs -> {len(chunks)} chunks")

        for i in range(0, len(chunks), 100):
            batch = chunks[i : i + 100]
            upsert_documents(batch)
            print(f"  Upserted batch {i // 100 + 1}")

        rebuild_index(
            [{"text": c["text"], "metadata": c["metadata"]} for c in chunks]
        )
        print(f"Auto-ingestion complete: {len(chunks)} chunks indexed")
    else:
        print(f"Knowledge base has {get_collection_count()} documents")

    await init_bm25()
    await init_redis()
    print("RAG Service ready!")

    yield
    # ── Shutdown ──
    print("RAG Service shutting down")


app = FastAPI(
    title="Sirius RAG Service",
    description="AI Business Consultant with RAG pipeline",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "https://frontend-production-521b.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/rag")
app.include_router(voice_router, prefix="/api/rag")


@app.get("/api/rag/health")
async def health():
    count = get_collection_count()
    return {"status": "ok", "documents_indexed": count}
