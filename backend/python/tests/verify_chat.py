import requests
import uuid
import time
import os
from dotenv import load_dotenv

# Load env for verification
load_dotenv()

API_URL = "http://127.0.0.1:8003"
USER_EMAIL = "test_e2e_chat@example.com"

def run_chat_test():
    print("=== Starting Chat E2E Test against " + API_URL + " ===")
    
    # 1. Health Check
    try:
        resp = requests.get(f"{API_URL}/")
        if resp.status_code != 200:
            print("❌ Server not ready")
            exit(1)
        print("✅ Server is up")
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        exit(1)

    # 2. Test Chat Endpoint
    print("\n--- Testing POST /chat ---")
    conv_id = f"test_conv_{int(time.time())}"
    message = "What is the meaning of life?"
    
    payload = {
        "conversation_id": conv_id,
        "message": message,
        "top_k": 3
    }
    
    try:
        start_time = time.time()
        resp = requests.post(f"{API_URL}/chat", json=payload)
        elapsed = time.time() - start_time
        
        print(f"Status Code: {resp.status_code}")
        print(f"Time Elapsed: {elapsed:.2f}s")
        
        if resp.status_code == 200:
            data = resp.json()
            reply = data.get("reply")
            sources = data.get("sources")
            
            print(f"Reply Length: {len(reply)}")
            print(f"Sources: {sources}")
            
            if reply and len(reply) > 0:
                print("✅ Chat Response Valid")
            else:
                print("❌ Chat Response Empty")
                exit(1)
        else:
            print(f"❌ Chat Request Failed: {resp.text}")
            exit(1)
            
    except Exception as e:
        print(f"❌ Chat Test Exception: {e}")
        exit(1)

    # 3. Test Runes Search (Optional)
    print("\n--- Testing POST /runes/search ---")
    search_payload = {"query": "meaning", "top_k": 2}
    try:
        resp = requests.post(f"{API_URL}/runes/search", params=search_payload)
        # Note: endpoint uses query params or body? app.py uses query param in signature but it's a POST? 
        # Let's check app.py: def search_runes(query: str, ...). FastAPI defaults scalar to query param.
        
        if resp.status_code == 200:
            results = resp.json()
            print(f"Search Results: {len(results)}")
            print("✅ Search Test Passed")
        else:
            print(f"⚠️ Search Request Failed (Non-critical): {resp.status_code}")
            
    except Exception as e:
        print(f"⚠️ Search Test Exception: {e}")

    print("\n=== E2E Test Completed Successfully ===")

if __name__ == "__main__":
    run_chat_test()
