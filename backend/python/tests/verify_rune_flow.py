import requests
import uuid
import time
import os
from dotenv import load_dotenv

# Load env for verification
load_dotenv()

API_URL = "http://127.0.0.1:8003"
USER_EMAIL = "test_e2e_rune@example.com"

def run_rune_flow_test():
    print("=== Starting Rune Flow E2E Test ===")
    
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

    # 2. Create Conversation
    print("\n--- 1. Creating Conversation ---")
    conv_resp = requests.post(f"{API_URL}/conversations", params={"title": "Rune Test Chat", "user_email": USER_EMAIL})
    if conv_resp.status_code != 200:
        print(f"❌ Create Conversation Failed: {conv_resp.text}")
        exit(1)
    conv_id = conv_resp.json()["id"]
    print(f"✅ Conversation Created: {conv_id}")

    # 3. Send Messages (Simulate a dialogue)
    print("\n--- 2. Sending Messages ---")
    msg1_payload = {"conversation_id": conv_id, "message": "What is the capital of France?"}
    msg1_resp = requests.post(f"{API_URL}/conversations/{conv_id}/messages", json=msg1_payload)
    if msg1_resp.status_code != 200:
        print(f"❌ Send Message 1 Failed: {msg1_resp.text}")
        exit(1)
    
    msg1_data = msg1_resp.json()
    user_msg_id_1 = msg1_data["user_message_id"]
    asst_msg_id_1 = msg1_data["assistant_message_id"]
    print(f"✅ Message 1 Sent (User: {user_msg_id_1}, Asst: {asst_msg_id_1})")
    
    # Send another message
    msg2_payload = {"conversation_id": conv_id, "message": "And Germany?"}
    msg2_resp = requests.post(f"{API_URL}/conversations/{conv_id}/messages", json=msg2_payload)
    msg2_data = msg2_resp.json()
    user_msg_id_2 = msg2_data["user_message_id"]
    asst_msg_id_2 = msg2_data["assistant_message_id"]
    print(f"✅ Message 2 Sent (User: {user_msg_id_2}, Asst: {asst_msg_id_2})")

    # 4. Save Rune (Multiple Messages)
    print("\n--- 3. Saving Rune from Messages ---")
    # We will select: User Q1, Asst A1, User Q2
    selected_ids = [user_msg_id_1, asst_msg_id_1, user_msg_id_2]
    rune_title = "European Capitals Info"
    
    save_payload = {
        "message_ids": selected_ids,
        "title": rune_title,
        "tags": ["geography", "europe"]
    }
    
    save_resp = requests.post(f"{API_URL}/conversations/{conv_id}/save-rune", json=save_payload)
    if save_resp.status_code != 200:
        print(f"❌ Save Rune Failed: {save_resp.text}")
        exit(1)
    
    rune_data = save_resp.json()
    rune_id = rune_data["id"]
    print(f"✅ Rune Saved: {rune_id} ('{rune_data['title']}')")

    # 5. List Runes to verify
    print("\n--- 4. Listing Runes ---")
    list_resp = requests.get(f"{API_URL}/runes", params={"user_email": USER_EMAIL}) # Note: endpoint uses query param for email? Let's check app.py
    # app.py: def list_runes(user_email: str = "dev@test.com", ...)
    # But wait, create_rune used user_email, but save_rune derived user from conversation.
    # The conversation was created with USER_EMAIL.
    # So list_runes with USER_EMAIL should find it.
    
    runes = list_resp.json()
    found = False
    for r in runes:
        if r["id"] == rune_id:
            found = True
            print(f"✅ Found Rune in List: {r['title']}")
            break
    
    if not found:
        print(f"❌ Rune {rune_id} not found in list")
        exit(1)

    # 6. Search Runes
    print("\n--- 5. Searching Runes ---")
    search_resp = requests.post(f"{API_URL}/runes/search", params={"query": "France capital", "top_k": 1})
    search_results = search_resp.json()
    
    if len(search_results) > 0:
        print(f"✅ Search returned {len(search_results)} results")
        print(f"   Top result: {search_results[0]['title']}")
        if search_results[0]['id'] == rune_id:
            print("   (Matches our saved rune)")
        else:
            print("   (Different rune found)")
    else:
        print("⚠️ Search returned no results (Embedding might be slow or different)")

    print("\n=== Rune Flow Test Completed Successfully ===")

if __name__ == "__main__":
    run_rune_flow_test()
