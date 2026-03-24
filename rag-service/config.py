import os
from dotenv import load_dotenv

load_dotenv()

# Groq API Keys (3 keys for load distribution)
GROQ_API_KEY_1 = os.getenv("GROQ_API_KEY_1", "")
GROQ_API_KEY_2 = os.getenv("GROQ_API_KEY_2", "")
GROQ_API_KEY_3 = os.getenv("GROQ_API_KEY_3", "")

# Qdrant
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_COLLECTION = "smb_knowledge"

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# Models
MAIN_MODEL = "llama-3.3-70b-versatile"
LIGHT_MODEL = "llama-3.1-8b-instant"
WHISPER_MODEL = "whisper-large-v3"

# Embeddings
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384

# Retrieval
TOP_K_VECTOR = 10
TOP_K_BM25 = 10
FINAL_TOP_K = 8

# Confidence thresholds
CONFIDENCE_STRONG = 0.75
CONFIDENCE_MEDIUM = 0.5

# Memory
MEMORY_TTL = 3600  # 1 hour
MAX_MEMORY_QUERIES = 3
