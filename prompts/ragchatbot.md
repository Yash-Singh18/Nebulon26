You are the companies seniormost ai engineer and you need to implement this:

add a floating icon in side at home page which is basically our ai expert for helping small and medium size businesses it will be using rag 
techstack : langchain/graph, qdrant, redis, groq (for llama 3.3 70b, llama 7b and whisper - i will provide you three api keys)
use bge-small, BM25: Elasticsearch / simple keyword index ,

🔹 Memory Layer (lightweight)
Store:
last 3 queries
business type

note : also add language option on top as whisper often gets confuses which language to use - force it to use the one selected


pipeline: 
User Input (text/voice)
        ↓
Query Preprocessing
        ↓
Query Classifier (light LLM or rules)
        ↓
Multi-Query Generator (2 queries max, not 4)
        ↓
Parallel Retrieval Layer
   ├── Vector DB (RAG)
   ├── Keyword Search (BM25 / hybrid)
   ├── Tools (if needed)
   ├── Web (optional fallback)
        ↓
Smart Merge + Scoring (NO reranker)
        ↓
Context Builder (top 5–8 chunks)
        ↓
Main LLM (response + reasoning)
        ↓
Post-processing (formatting / decision mode)
        ↓
User Output

important:
User Query
   ↓
Query Classifier
   ↓
RETRIEVAL FIRST (MANDATORY)
   ↓
Check Retrieval Confidence
   ↓
IF good → LLM (WITH CONTEXT ONLY)
ELSE → fallback LLM (no RAG)

--> to force rag rather than llm being confidence and answering all by it self

## CONFIDENCE GATE (CRITICAL)

After retrieval, calculate:

Example:
confidence = max_similarity_score
Thresholds:

0.75 → strong (use RAG)

0.5–0.75 → medium (use RAG + fallback hint)
< 0.5 → weak (fallback to LLM)

prompt:
You are a business consultant AI.

You MUST answer ONLY using the provided context.
Do NOT use prior knowledge.
If the answer is not present in the context, say:
Answer using your memory and dont mention you dont have enough knowledge

Context:
{retrieved_chunks}

Question:
{user_query}


you can tell me what else you want and create entirely new service for this without impacting our current ai-service or system
i will provide you all needed api keys in env files after you create it and it will be different from current ai-service


make this system robust soo that it can win us the hackathon.
note: we will be deploying this later for our hackathon demo soo make sure its easy to deploy, last time it was really hard due to using alot of local models - make sure to not repeat this mistake

