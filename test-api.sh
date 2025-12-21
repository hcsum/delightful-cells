#!/bin/bash

# Test the /api/process endpoint
# Make sure your Next.js dev server is running (npm run dev)

BASE_URL="${1:-http://localhost:3000}"

echo "Testing POST /api/process..."
echo ""

curl -X POST "${BASE_URL}/api/process" \
  -H "Content-Type: application/json" \
  -H "x-request-id: test-$(date +%s)" \
  -H "x-action: preview" \
  -H "x-app: excel-extract-column-app" \
  -d '{
    "rows": [
      "123 Main St, New York, NY 10001",
      "456 Oak Ave, Los Angeles, CA 90001",
      "789 Pine Rd, Chicago, IL 60601"
    ],
    "toBeExtracted": "city name",
    "extractFrom": "address"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo ""
echo "Testing GET /api/process (health check)..."
curl -X GET "${BASE_URL}/api/process" \
  -w "\n\nHTTP Status: %{http_code}\n"

