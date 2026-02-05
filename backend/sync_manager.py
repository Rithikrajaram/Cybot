import threading
import time
import socket
from secure_db import get_db_connection, get_cloud_db

class SyncManager:
    def __init__(self, interval=30):
        self.interval = interval
        self.running = False
        self.thread = None

    def check_connectivity(self):
        """
        Simple check to see if we have internet access.
        """
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=1)
            return True
        except OSError:
            return False

    def sync_collection(self, collection_name, local_db, cloud_db):
        """
        Syncs a single collection from Local to Cloud.
        Uses replace_one with upsert=True to ensure documents are updated/created.
        """
        try:
            local_coll = local_db[collection_name]
            cloud_coll = cloud_db[collection_name]

            # In a small system, we iterate all. 
            # In production, use 'last_synced' or change streams.
            cursor = local_coll.find({})
            count = 0
            for doc in cursor:
                cloud_coll.replace_one({"_id": doc["_id"]}, doc, upsert=True)
                count += 1
            
            return count
        except Exception as e:
            print(f"[Sync] Error syncing {collection_name}: {e}")
            return 0

    def sync_data(self):
        """
        Main sync logic triggered periodically.
        """
        if not self.check_connectivity():
            # print("[Sync] No internet connection. Skipping sync.")
            return

        cloud_db = get_cloud_db()
        if cloud_db is None:
            return

        # Double check cloud connectivity via ping
        try:
            cloud_db.command('ping')
        except Exception:
            return

        local_db = get_db_connection()
        collections = ["users", "credentials", "audit_logs", "nfc_mappings"]
        
        total_synced = 0
        for coll in collections:
            total_synced += self.sync_collection(coll, local_db, cloud_db)
        
        if total_synced > 0:
             print(f"[Sync] Successfully pushed {total_synced} updates to Cloud Database.")

    def run(self):
        print(f"--- Background Sync Manager Active (Interval: {self.interval}s) ---")
        while self.running:
            try:
                self.sync_data()
            except Exception as e:
                print(f"Sync Manager Cycle Error: {e}")
            
            time.sleep(self.interval)

    def start(self):
        if self.running:
            return
        self.running = True
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()

# Global Instance
sync_manager = SyncManager(interval=30) # Sync every 30 seconds
