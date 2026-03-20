#!/bin/bash

# Configuration
# Replace [WEDDING_ID] with your actual wedding ID from the URL
WEDDING_ID="$1"
# The URL of your local dev server
BASE_URL="http://localhost:3000"

if [ -z "$WEDDING_ID" ]; then
    echo "Usage: ./auto_sync_rsvps.sh <WEDDING_ID>"
    exit 1
fi

echo "Starting Background RSVP Auto-Sync for Wedding ID: $WEDDING_ID"
echo "Syncing every 5 minutes... Press [CTRL+C] to stop."

while true; do
    echo "[$(date +'%H:%M:%S')] Syncing RSVPs from Tabbly..."
    
    # Trigger the sync endpoint
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/wedding/$WEDDING_ID/sync-call-rsvps")
    
    if [[ $RESPONSE == *"success\":true"* ]]; then
        MESSAGE=$(echo "$RESPONSE" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
        echo "✅ Success: $MESSAGE"
    else
        echo "❌ Sync failed or server is down. Retrying in 5 minutes."
        echo "Response: $RESPONSE"
    fi
    
    sleep 300 # Wait for 5 minutes (300 seconds)
done
