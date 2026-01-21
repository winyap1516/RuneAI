import requests
import time
import sys
import subprocess

API_URL = "http://127.0.0.1:8003"
USER_EMAIL = "test_e2e_py@example.com"
TEST_URL = "https://example.com"

def run_test():
    print(f"=== Starting E2E Test against {API_URL} ===")
    
    # 1. Wait for server
    for i in range(10):
        try:
            resp = requests.get(f"{API_URL}/")
            if resp.status_code == 200:
                print("Server is up!")
                break
        except Exception:
            print(f"Waiting for server... ({i+1}/10)")
            time.sleep(1)
    else:
        print("Error: Server failed to start.")
        sys.exit(1)

    # 2. Sync
    print("Sending POST /sync...")
    try:
        resp = requests.post(f"{API_URL}/sync", json={"url": TEST_URL, "user_email": USER_EMAIL})
        print(f"Sync Response: {resp.status_code} - {resp.text}")
        if resp.status_code != 200:
            print("Sync failed!")
            sys.exit(1)
        data = resp.json()
        link_id = data["link_id"]
        print(f"Got Link ID: {link_id}")
    except Exception as e:
        print(f"Sync Request Error: {e}")
        sys.exit(1)

    # 3. Wait for Worker
    print("Waiting 5 seconds for worker...")
    time.sleep(5)

    # 4. Check Result
    print(f"Checking status GET /links/{link_id}...")
    try:
        resp = requests.get(f"{API_URL}/links/{link_id}")
        print(f"Get Link Response: {resp.status_code} - {resp.text}")
        if resp.status_code != 200:
            print("Get Link failed!")
            sys.exit(1)
        
        link_data = resp.json()
        description = link_data.get("description")
        ai_status = link_data.get("ai_status")
        
        print(f"AI Status: {ai_status}")
        print(f"Description: {description}")

        if ai_status == "completed" and description:
            print("✅ SUCCESS: E2E Test Passed!")
            sys.exit(0)
        else:
            print("❌ FAILURE: Description not found or status not completed.")
            sys.exit(1)
            
    except Exception as e:
        print(f"Get Link Request Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run_test()
