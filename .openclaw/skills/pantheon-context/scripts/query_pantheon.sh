#!/bin/bash
# Bridge script for OpenClaw to query Pantheon Server
TYPE=$1
QUERY=$2

curl -s -X POST http://localhost:3000/api/intelligence/context      -H "Content-Type: application/json"      -d "{\"type\": \"$TYPE\", \"query\": \"$QUERY\"}"
