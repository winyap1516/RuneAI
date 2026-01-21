from app import engine, Base
from sqlalchemy import text

def upgrade_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    print("Creating indices...")
    with engine.connect() as conn:
        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_runes_embedding ON runes USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);"))
            conn.commit()
            print("Indices created successfully.")
        except Exception as e:
            print(f"Index creation failed (might be due to missing data or extension): {e}")

    print("Done.")

if __name__ == "__main__":
    upgrade_db()
