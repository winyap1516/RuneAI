import os
import time
import uuid
import asyncio
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Text, DateTime, ForeignKey, Boolean, Integer
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from pgvector.sqlalchemy import Vector
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.sql import func
from dotenv import load_dotenv
from openai import OpenAI
import requests
from bs4 import BeautifulSoup
from functools import lru_cache
import socket
import ipaddress
from urllib.parse import urlparse

# Load env
load_dotenv()

api_key = os.getenv("OPENAI_API_KEY")
# 中文注释：禁止在日志中打印 API Key 任何片段，避免潜在泄露

# Config
EMBEDDING_MODEL = os.getenv("TEXT_EMBEDDING_MODEL", "text-embedding-3-small")
EMBEDDING_DIM = int(os.getenv("EMBED_DIM", "1536"))
# 中文注释：聊天模型配置，默认使用 GPT-5 nano（按用户要求）
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-5-nano")

# OpenAI Client
openai_client = OpenAI(api_key=api_key)

# Embedding Cache
@lru_cache(maxsize=4096)
def get_embedding(text: str):
    """Cached embedding generation"""
    if not text: return [0.0] * EMBEDDING_DIM
    resp = openai_client.embeddings.create(
        input=text,
        model=EMBEDDING_MODEL
    )
    return resp.data[0].embedding

# Database Setup
# Default to localhost if not set
# 中文注释：按照项目规则默认使用 5433 端口（Docker Postgres）
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://dev:dev@localhost:5433/yingan")

engine = create_engine(DATABASE_URL, future=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Link(Base):
    __tablename__ = "links"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    url = Column(String, nullable=False)
    title = Column(String)
    description = Column(Text, nullable=True)
    category = Column(String, default="All Links")
    tags = Column(ARRAY(String), default=[])
    ai_status = Column(String, default="queued")
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Category(Base):
    __tablename__ = "categories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class GenerationLog(Base):
    __tablename__ = "generation_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    link_id = Column(UUID(as_uuid=True), ForeignKey("links.id"))
    status = Column(String)
    message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Message(Base):
    __tablename__ = "messages"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id"))
    role = Column(String)
    content = Column(Text)
    attachments = Column(JSONB, default=[])
    embedding = Column(Vector(1536))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Rune(Base):
    __tablename__ = "runes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    content = Column(Text)
    attachments = Column(JSONB, default=[])
    metadata_ = Column("metadata", JSONB, default={}) # Using metadata_ to avoid conflict
    embedding = Column(Vector(1536))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Memory(Base):
    __tablename__ = "memories"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    title = Column(String)
    summary = Column(Text)
    embedding = Column(Vector(1536))
    sources = Column(JSONB, default=[])
    priority = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_used = Column(DateTime(timezone=True), server_default=func.now())

# Schemas
class SyncRequest(BaseModel):
    url: str
    user_email: str # Simplified for dev

class SyncResponse(BaseModel):
    status: str
    job_id: str
    link_id: str

class ChatRequest(BaseModel):
    conversation_id: str
    message: str
    top_k: int = 3
    attachments: List[dict] = [] # [{"type": "image", "url": "..."}]
    context_runes: List[str] = [] # IDs of explicitly referenced runes

class ChatResponse(BaseModel):
    reply: str
    sources: List[str] = []
    memories: List[str] = []
    user_message_id: str
    assistant_message_id: str

class SaveRuneRequest(BaseModel):
    message_ids: List[str]
    title: str
    tags: List[str] = []

class ChangeItem(BaseModel):
    resource_type: str
    op: str # create, update, delete
    resource_id: str
    payload: dict = {}
    client_change_id: str
    field_timestamps: dict = {}

class SyncPushRequest(BaseModel):
    changes: List[ChangeItem]
    user_email: str = "dev@test.com" # Default for dev

# Worker Logic (Mock AI)
# 中文注释：URL 校验与 SSRF 防护辅助函数
def _is_private_host(hostname: str) -> bool:
    """
    中文注释：检测主机名是否解析到私网/本机地址，阻止访问内网资源
    """
    try:
        infos = socket.getaddrinfo(hostname, None)
        for info in infos:
            ip = info[4][0]
            ip_obj = ipaddress.ip_address(ip)
            if (ip_obj.is_private 
                or ip_obj.is_loopback 
                or ip_obj.is_reserved 
                or ip_obj.is_link_local):
                return True
        return False
    except Exception:
        # 无法解析主机名也视为不安全
        return True

def _validate_user_url(url: str) -> str:
    """
    中文注释：校验用户输入的 URL，仅允许 http/https，阻止私网主机
    """
    if not url:
        raise ValueError("Empty URL")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https are allowed")
    hostname = parsed.hostname or ""
    if not hostname or _is_private_host(hostname):
        raise ValueError("Unsafe or private host is not allowed")
    return url

def fetch_url_content(url: str) -> dict:
    """Fetches and cleans text content from a URL."""
    try:
        # 中文注释：先进行 URL 安全校验，阻止 SSRF
        safe_url = _validate_user_url(url)
        # User-Agent to avoid some 403s
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(safe_url, headers=headers, timeout=10, allow_redirects=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract title
        title = soup.title.string.strip() if soup.title else ""
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.extract()
            
        text = soup.get_text(separator=' ')
        
        # Clean whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        return {"title": title, "content": text[:5000]} # Limit context size
    except Exception as e:
        print(f"[Worker] Scraping error for {url}: {e}")
        return {"title": "", "content": f"Could not fetch content from URL. Error: {str(e)}"}

def process_ai_task(link_id: uuid.UUID):
    # Use a new session for the background task
    db = SessionLocal()
    try:
        # 1. Log Start
        log_start = GenerationLog(link_id=link_id, status="started", message="AI Worker started processing")
        db.add(log_start)
        db.commit()

        # 2. Call OpenAI
        print(f"[Worker] Processing link {link_id} with OpenAI...")
        
        # Fetch link details to get URL (simulated here since we already have it in DB)
        link = db.query(Link).filter(Link.id == link_id).first()
        if not link:
            print(f"[Worker] Link {link_id} not found")
            return

        # Real OpenAI Call
        try:
            # If OPENAI_API_KEY is placeholder, fallback to Mock
            if os.getenv("OPENAI_API_KEY") == "sk-placeholder":
                print("[Worker] Using Mock AI (No API Key)")
                time.sleep(2)
                ai_description = f"AI Generated Summary for {link.url} at {time.ctime()} (MOCK)"
                ai_category = "Mock Category"
                ai_tags = ["mock", "test"]
            else:
                # 2.1 Fetch Content
                print(f"[Worker] Fetching content for {link.url}...")
                page_data = fetch_url_content(link.url)
                page_content = page_data["content"]
                page_title = page_data["title"]
                
                # 2.2 Call OpenAI
                print(f"[Worker] Calling OpenAI for {link.url}...")
                
                import json
                
                response = openai_client.chat.completions.create(
                    model=CHAT_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant. Analyze the following web page content. Provide a summary (2-3 sentences), a best-fit category (e.g., Technology, Design, News, Science, etc.), and a list of 3-5 relevant tags. Return strictly JSON in this format: {\"summary\": \"...\", \"category\": \"...\", \"tags\": [\"tag1\", \"tag2\"]}."},
                        {"role": "user", "content": f"URL: {link.url}\nTitle: {page_title}\n\nContent:\n{page_content}"}
                    ],
                    max_tokens=300,
                    response_format={"type": "json_object"}
                )
                
                result_text = response.choices[0].message.content
                result_json = json.loads(result_text)
                
                ai_description = result_json.get("summary", "No summary generated.")
                ai_category = result_json.get("category", "All Links")
                ai_tags = result_json.get("tags", [])
                
                # Update title if original was empty or just URL
                if not link.title or link.title == link.url:
                    if page_title:
                        link.title = page_title

        except Exception as ai_err:
             print(f"[Worker] OpenAI API Error: {ai_err}")
             raise ai_err

        # 3. Update Link
        link.description = ai_description
        link.category = ai_category
        link.tags = ai_tags
        link.ai_status = "completed"
        
        # 4. Log Success
        log_success = GenerationLog(link_id=link_id, status="success", message="AI processing completed successfully")
        db.add(log_success)
        db.commit()
        print(f"[Worker] Finished link {link_id}")
    except Exception as e:
        print(f"[Worker] Error: {e}")
        # Log failure
        # We need to reconnect to log if session is broken, but simple try/except is okay for now
    finally:
        db.close()

# FastAPI App
app = FastAPI()

# Mount uploads
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# CORS
# 中文注释：允许的前端来源（用于 CORS），支持逗号分隔环境变量
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup():
    # Create tables if not exist
    Base.metadata.create_all(bind=engine)
    print("Startup: Database tables verified.")
    
    # Verify Embedding Dimension
    try:
        if api_key and api_key != "sk-placeholder":
            print(f"Startup: Verifying embedding dimension for {EMBEDDING_MODEL}...")
            test_emb = get_embedding("ping")
            if len(test_emb) != EMBEDDING_DIM:
                print(f"❌ CRITICAL: Embedding dimension mismatch! Model output: {len(test_emb)}, Config: {EMBEDDING_DIM}")
                # We don't exit here to avoid crashing dev env if offline, but log error
            else:
                print(f"✅ Startup: Embedding dimension verified ({len(test_emb)})")
    except Exception as e:
        print(f"⚠️ Startup: Embedding check failed (Network issue?): {e}")

@app.get("/healthz")
def healthz():
    return {"status": "ok"}

@app.get("/ready")
def ready(db: Session = Depends(get_db)):
    try:
        # Check DB
        db.execute(func.now())
        return {"ready": True, "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {e}")

@app.get("/")
def read_root():
    return {"Hello": "RuneAI Backend", "Status": "Running"}

@app.post("/sync", response_model=SyncResponse)
def sync_url(req: SyncRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Find User (Mock Auth)
    user = db.query(User).filter(User.email == req.user_email).first()
    if not user:
        # Create user if not exists (Dev Mode)
        user = User(email=req.user_email)
        db.add(user)
        db.commit()
        db.refresh(user)

    # 2. Create Link
    new_link = Link(
        user_id=user.id,
        url=req.url,
        ai_status="queued"
    )
    db.add(new_link)
    db.commit()
    db.refresh(new_link)

    # 3. Log Request
    log = GenerationLog(link_id=new_link.id, status="queued", message="Request received via /sync")
    db.add(log)
    db.commit()

    # 4. Trigger Worker
    background_tasks.add_task(process_ai_task, new_link.id)

    return {
        "status": "queued",
        "job_id": str(uuid.uuid4()), # Mock Job ID
        "link_id": str(new_link.id)
    }

@app.get("/links/{link_id}")
def get_link(link_id: uuid.UUID, db: Session = Depends(get_db)):
    link = db.query(Link).filter(Link.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    return {
        "id": link.id,
        "url": link.url,
        "description": link.description,
        "ai_status": link.ai_status,
        "created_at": link.created_at
    }

@app.get("/links")
def get_links(user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    # 中文注释：按用户过滤链接列表，避免跨用户数据泄露
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        return []
    links = db.query(Link).filter(Link.user_id == user.id).order_by(Link.created_at.desc()).all()
    return [
        {
            "id": l.id,
            "url": l.url,
            "description": l.description,
            "ai_status": l.ai_status,
            "created_at": l.created_at
        }
        for l in links
    ]

# === P0 Migration: Sync Push Endpoint ===
@app.post("/sync/push")
def sync_push(req: SyncPushRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Handles batch offline changes from frontend (idempotent-ish).
    """
    # 1. Auth (Mock)
    user = db.query(User).filter(User.email == req.user_email).first()
    if not user:
        user = User(email=req.user_email)
        db.add(user)
        db.commit()
        db.refresh(user)
    
    applied_ids = []
    
    for change in req.changes:
        try:
            # P0 currently only cares about Links and Categories
            if change.resource_type == "link" or change.resource_type == "website":
                link_id = change.resource_id
                payload = change.payload
                
                if change.op == "create" or change.op == "update":
                    # Check if exists
                    link = db.query(Link).filter(Link.id == link_id).first()
                    
                    if not link:
                        if change.op == "update": 
                             # If update comes before create (rare but possible in sync), treat as create
                             pass
                        link = Link(id=link_id, user_id=user.id, url=payload.get("url", ""))
                        db.add(link)
                    
                    # Apply fields
                    if "url" in payload: link.url = payload["url"]
                    if "title" in payload: link.title = payload["title"]
                    if "description" in payload: link.description = payload["description"]
                    if "category" in payload: link.category = payload["category"]
                    if "tags" in payload: link.tags = payload["tags"]
                    if "ai_status" in payload: link.ai_status = payload["ai_status"]
                    if "is_deleted" in payload: link.is_deleted = payload["is_deleted"]
                    
                    db.commit()
                    
                    # Trigger AI if newly created or specifically requested?
                    # Original logic: if creating a website, trigger AI.
                    # My logic: if ai_status is 'processing' or 'queued', trigger it.
                    if (change.op == "create" or payload.get("ai_status") == "processing") and link.url:
                         background_tasks.add_task(process_ai_task, link.id)

                elif change.op == "delete":
                    link = db.query(Link).filter(Link.id == link_id).first()
                    if link:
                        link.is_deleted = True
                        db.commit()
            
            elif change.resource_type == "category":
                # Handle category create
                if change.op == "create":
                    cat = db.query(Category).filter(Category.name == change.payload.get("name")).first()
                    if not cat:
                        cat = Category(
                            id=change.resource_id, 
                            user_id=user.id, 
                            name=change.payload.get("name", "Untitled")
                        )
                        db.add(cat)
                        db.commit()

            applied_ids.append(change.client_change_id)

        except Exception as e:
            print(f"[Sync] Error processing change {change.client_change_id}: {e}")
            # Continue processing others? Yes.
            
    return {"applied": [{"client_change_id": cid} for cid in applied_ids], "conflicts": []}

@app.post("/sync/pull")
def sync_pull(db: Session = Depends(get_db)):
    # Minimal implementation: return nothing to stop errors, 
    # since we rely on local IndexedDB + Polling for now.
    return {"changes": [], "timestamp": int(time.time() * 1000)}

@app.post("/uploads")
async def upload_file(file: UploadFile = File(...)):
    try:
        # 中文注释：限制上传大小与类型，避免滥用与安全风险
        ALLOWED_MIME = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/webp": ".webp",
            "application/pdf": ".pdf",
            "audio/mpeg": ".mp3",
            "audio/wav": ".wav"
        }
        MAX_BYTES = int(os.getenv("UPLOAD_MAX_BYTES", str(5 * 1024 * 1024)))  # 默认 5MB

        content = await file.read()
        size = len(content or b"")
        if size <= 0 or size > MAX_BYTES:
            raise HTTPException(status_code=400, detail="File size invalid or too large")

        mime = (file.content_type or "").lower()
        if mime not in ALLOWED_MIME:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        file_ext = ALLOWED_MIME[mime]
        filename = f"{uuid.uuid4()}{file_ext}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as f:
            f.write(content)
            
        return {
            "url": f"/uploads/{filename}",
            "filename": file.filename,
            "mime": mime,
            "size": size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations", response_model=dict)
def create_conversation(title: str = "New Chat", user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    # Mock Auth
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        user = User(email=user_email)
        db.add(user)
        db.commit()
    
    conv = Conversation(user_id=user.id, title=title)
    db.add(conv)
    db.commit()
    return {"id": str(conv.id), "title": conv.title, "created_at": conv.created_at}

@app.get("/conversations")
def list_conversations(user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user: return []
    
    convs = db.query(Conversation).filter(Conversation.user_id == user.id)\
              .order_by(Conversation.updated_at.desc()).all()
    return [{"id": str(c.id), "title": c.title, "status": c.status} for c in convs]

@app.get("/conversations/{conv_id}/messages")
def get_messages(conv_id: uuid.UUID, db: Session = Depends(get_db)):
    msgs = db.query(Message).filter(Message.conversation_id == conv_id)\
             .order_by(Message.created_at.asc()).all()
    return [{"role": m.role, "content": m.content, "id": str(m.id)} for m in msgs]

@app.post("/conversations/{conv_id}/messages", response_model=ChatResponse)
def send_message(conv_id: uuid.UUID, req: ChatRequest, db: Session = Depends(get_db)):
    # 1. Check Conv
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv: raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Auto-title generation (Simple heuristic for MVP)
    # If title is "New Chat" and this is the first user message
    msg_count = db.query(Message).filter(Message.conversation_id == conv_id).count()
    if conv.title == "New Chat" and msg_count == 0:
        # Use first 30 chars of message as title
        new_title = req.message[:30] + "..." if len(req.message) > 30 else req.message
        conv.title = new_title
        db.commit()

    # 2. Embedding
    query_emb = get_embedding(req.message)
    
    # 3. RAG (Implicit + Explicit)
    # Implicit: Semantic Search
    top_k = max(1, int(req.top_k or 3))
    # 中文注释：仅检索当前用户的 Runes
    runes = db.query(Rune)\
        .filter(Rune.owner_id == conv.user_id)\
        .order_by(Rune.embedding.l2_distance(query_emb))\
        .limit(top_k).all()
    
    # Implicit: Memory Search (Long-term)
    memories = db.query(Memory)\
        .filter(Memory.user_id == conv.user_id)\
        .order_by(Memory.embedding.l2_distance(query_emb))\
        .limit(top_k).all()
    
    # Explicit: Context Runes
    explicit_runes = []
    if req.context_runes:
        explicit_runes = db.query(Rune).filter(Rune.id.in_([uuid.UUID(rid) for rid in req.context_runes])).all()
    
    # 4. History
    history = db.query(Message).filter(Message.conversation_id == conv_id)\
                .order_by(Message.created_at.desc()).limit(5).all()
    history.reverse()
    
    # 5. Prompt
    system_prompt = "You are a helpful assistant."
    
    # Add Explicit Context first (higher priority)
    if explicit_runes:
        context_text = "\n".join([f"Referenced Rune '{r.title}':\n{r.content}" for r in explicit_runes])
        system_prompt += f"\n\nUser provided references:\n{context_text}"
        
    if runes:
        context_text = "\n".join([f"Rune: {r.content[:200]}..." for r in runes])
        system_prompt += f"\n\nRelated Knowledge:\n{context_text}"
        
    if memories:
        mem_text = "\n".join([f"- {m.title}: {m.summary}" for m in memories])
        system_prompt += f"\n\nLong-term Memories:\n{mem_text}"
        
    messages = [{"role": "system", "content": system_prompt}]
    for m in history: messages.append({"role": m.role, "content": m.content})
    
    # User message with attachments description if any
    user_content = req.message
    if req.attachments:
        user_content += "\n\n[Attachments]: " + ", ".join([f"{a.get('filename','file')} ({a.get('url')})" for a in req.attachments])
        
    messages.append({"role": "user", "content": user_content})
    
    # 6. LLM
    try:
        chat_resp = openai_client.chat.completions.create(
            model=CHAT_MODEL, messages=messages, max_tokens=500
        )
        reply = chat_resp.choices[0].message.content
    except Exception as e:
        # 中文注释：避免将内部错误细节回显给用户
        reply = "The assistant encountered an error. Please try again later."
        
    # 7. Save
    user_msg = Message(
        conversation_id=conv_id, 
        role="user", 
        content=req.message, 
        embedding=query_emb,
        attachments=req.attachments
    )
    asst_msg = Message(
        conversation_id=conv_id, 
        role="assistant", 
        content=reply, 
        embedding=get_embedding(reply)
    )
    
    db.add(user_msg)
    db.add(asst_msg)
    
    # Update Conv Timestamp
    conv.updated_at = func.now()
    
    db.commit()
    
    return {
        "reply": reply, 
        "sources": [str(r.id) for r in runes] + [str(r.id) for r in explicit_runes],
        "memories": [str(m.id) for m in memories],
        "user_message_id": str(user_msg.id),
        "assistant_message_id": str(asst_msg.id)
    }

@app.post("/conversations/{conv_id}/save-rune")
def save_rune_from_messages(conv_id: uuid.UUID, req: SaveRuneRequest, db: Session = Depends(get_db)):
    # 1. Fetch Messages
    # Filter by IDs and Conversation to ensure security/consistency
    msgs = db.query(Message).filter(
        Message.id.in_([uuid.UUID(mid) for mid in req.message_ids]),
        Message.conversation_id == conv_id
    ).order_by(Message.created_at.asc()).all()
    
    if not msgs:
        raise HTTPException(status_code=404, detail="Messages not found in this conversation")
    
    # 2. Merge Content
    # Simple format: ROLE: Content
    content = "\n\n".join([f"{m.role.upper()}: {m.content}" for m in msgs])
    
    # 3. Create Rune
    conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
    if not conv: raise HTTPException(status_code=404, detail="Conversation not found")
    
    emb = get_embedding(content)
    rune = Rune(
        owner_id=conv.user_id,
        title=req.title,
        content=content,
        metadata_={"source_conversation_id": str(conv_id), "tags": req.tags},
        embedding=emb
    )
    db.add(rune)
    db.commit()
    
    return {"id": str(rune.id), "title": rune.title}

@app.post("/runes")
def create_rune(title: str, content: str, user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user: return {"error": "User not found"}
    
    emb = get_embedding(content)
    rune = Rune(owner_id=user.id, title=title, content=content, embedding=emb)
    db.add(rune)
    db.commit()
    return {"id": str(rune.id), "title": rune.title}

# === P1: Chat API with RAG (Legacy Wrapper) ===
# We keep /chat for compatibility but route it to a default conversation logic if needed,
# or deprecate it. For MVP, we can keep it as is or redirect.
# Let's update /chat to use the new Message model structure if we want to keep using it for quick tests.
# But better to move frontend to use /conversations/...


@app.get("/runes")
def list_runes(limit: int = 20, sort: str = "created_at_desc", user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user: return []
    
    query = db.query(Rune).filter(Rune.owner_id == user.id)
    
    if sort == "created_at_desc":
        query = query.order_by(Rune.created_at.desc())
        
    runes = query.limit(limit).all()
    
    results = []
    for r in runes:
        # Inference for type
        rune_type = "text"
        atts = r.attachments or []
        if atts:
            if any(a.get("type", "").startswith("image") for a in atts):
                rune_type = "image"
            elif any(a.get("type", "").startswith("audio") for a in atts):
                rune_type = "audio"
            else:
                rune_type = "mixed"
        
        # Tags
        tags = r.metadata_.get("tags", []) if r.metadata_ else []
        
        results.append({
            "id": str(r.id),
            "title": r.title,
            "description": r.content[:200] if r.content else "", # Provide more context for frontend truncation
            "content": r.content, # Full content if needed for empty desc
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "type": rune_type,
            "tags": tags,
            "attachment_count": len(atts)
        })
        
    return results

@app.post("/runes/search")
def search_runes(query: str, top_k: int = 5, user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == user_email).first()
        if not user:
            return []
        query_emb = get_embedding(query)
        runes = db.query(Rune).filter(Rune.owner_id == user.id).order_by(Rune.embedding.l2_distance(query_emb)).limit(top_k).all()
        return [{"id": r.id, "title": r.title, "content": r.content} for r in runes]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/memories/consolidate")
def consolidate_memories(user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    """
    MVP: Summarize the last active conversation into a memory node.
    """
    user = db.query(User).filter(User.email == user_email).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    
    # 1. Get last active conversation with enough messages
    last_conv = db.query(Conversation).filter(Conversation.user_id == user.id)\
                  .order_by(Conversation.updated_at.desc()).first()
    
    if not last_conv:
        return {"status": "no_conversation", "message": "No conversations found"}
        
    # Check if we already have a memory for this conversation?
    # For MVP, we'll just check if *any* memory cites this conversation ID in sources
    # This is a bit loose but works for MVP
    # Ideally we track `last_consolidated_message_id`
    
    # Let's just fetch messages
    msgs = db.query(Message).filter(Message.conversation_id == last_conv.id)\
             .order_by(Message.created_at.asc()).all()
             
    if len(msgs) < 3:
        return {"status": "skipped", "message": "Conversation too short"}
        
    # 2. Summarize with LLM
    text_blob = "\n".join([f"{m.role}: {m.content}" for m in msgs])
    
    try:
        import json
        completion = openai_client.chat.completions.create(
            model=CHAT_MODEL,
            messages=[
                {"role": "system", "content": "You are a memory consolidation assistant. Return strictly JSON with keys: title, summary."},
                {"role": "user", "content": f"Summarize the following conversation (3-5 sentences) and give a concise title.\n\n{ text_blob }"}
            ],
            response_format={"type": "json_object"},
            max_tokens=300
        )
        result_text = completion.choices[0].message.content
        obj = json.loads(result_text or "{}")
        title = (obj.get("title") or "Memory").strip()
        summary = (obj.get("summary") or "").strip() or "No summary."
            
        # 3. Create Memory
        emb = get_embedding(summary)
        mem = Memory(
            user_id=user.id,
            title=title,
            summary=summary,
            embedding=emb,
            sources=[str(last_conv.id)],
            priority=1
        )
        db.add(mem)
        db.commit()
        
        return {"status": "consolidated", "memory_id": str(mem.id), "title": title}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/memories")
def list_memories(user_email: str = "dev@test.com", db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_email).first()
    if not user: return []
    
    mems = db.query(Memory).filter(Memory.user_id == user.id)\
             .order_by(Memory.created_at.desc()).all()
    return [{"id": str(m.id), "title": m.title, "summary": m.summary, "created_at": m.created_at} for m in mems]
