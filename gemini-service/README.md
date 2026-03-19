# 🤖 Gemini Encasement Service

A **local AI server** that wraps Google's `gemini` CLI, providing REST API access while keeping all control on your server.

## 🎯 What This Is

Think of it as "running your own OpenAI server" but:
- Uses your Google AI account via `gemini` CLI
- Processes everything locally on your VPS
- Provides clean REST API
- Works with any app (Telegram, n8n, custom scripts)
- Queues requests automatically
- Tracks usage and performance

## 🏗️ Architecture

```
Your Apps (Telegram/n8n/etc)
        ↓
   HTTP Request to localhost:3500
        ↓
   Gemini Service (Express server)
        ↓
   Request Queue (rate limiting)
        ↓
   gemini CLI (your Google AI account)
        ↓
   Google AI API (actual inference)
        ↓
   Response packaged & returned
        ↓
   Your App receives clean JSON
```

## 🚀 Setup

### 1. Install Dependencies

```bash
cd /home/ubuntu/gemini-service
npm install
```

### 2. Configure API Key

Edit `ecosystem.config.js` and change the API key:

```javascript
GEMINI_SERVICE_API_KEY: 'your-strong-random-key-here',
```

Or set environment variable:

```bash
export GEMINI_SERVICE_API_KEY="your-key-here"
```

### 3. Start Service

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 status gemini-service

# View logs
pm2 logs gemini-service
```

### 4. Test It

```bash
npm test
```

Or manually:

```bash
curl -X POST http://localhost:3500/api/infer \
  -H "Authorization: Bearer your-key-here" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"What is the capital of France?"}'
```

## 📡 API Endpoints

### 1. Simple Inference (Pantheon Format)

**Endpoint**: `POST /api/infer`

**Request**:
```json
{
  "prompt": "Explain quantum computing in simple terms",
  "temperature": 0.7,
  "max_tokens": 500
}
```

**Response**:
```json
{
  "success": true,
  "response": "Quantum computing is...",
  "duration_ms": 1234,
  "tokens_estimated": 150
}
```

### 2. Chat Completions (OpenAI Compatible)

**Endpoint**: `POST /v1/chat/completions`

**Request**:
```json
{
  "model": "gemini-2.0-flash-exp",
  "messages": [
    {"role": "user", "content": "Hello!"}
  ],
  "temperature": 0.7,
  "max_tokens": 2048
}
```

**Response**:
```json
{
  "id": "chatcmpl-abc123...",
  "object": "chat.completion",
  "created": 1710000000,
  "model": "gemini-2.0-flash-exp",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 8,
    "total_tokens": 13
  }
}
```

### 3. Simple Completions

**Endpoint**: `POST /v1/completions`

**Request**:
```json
{
  "prompt": "Once upon a time",
  "temperature": 0.9,
  "max_tokens": 100
}
```

### 4. Health Check

**Endpoint**: `GET /health`

**Response**:
```json
{
  "status": "ok",
  "service": "gemini-encasement",
  "queue": 0,
  "processing": false,
  "stats": {
    "totalRequests": 42,
    "successfulRequests": 40,
    "failedRequests": 2,
    "averageResponseTime": 1523
  }
}
```

### 5. Statistics

**Endpoint**: `GET /api/stats`

**Headers**: `Authorization: Bearer your-key`

**Response**:
```json
{
  "totalRequests": 100,
  "successfulRequests": 95,
  "failedRequests": 5,
  "totalTokensEstimated": 15000,
  "averageResponseTime": 1234,
  "queueSize": 0,
  "isProcessing": false,
  "uptime": 3600
}
```

## 🔧 Features

### Request Queue
- Automatic queuing of concurrent requests
- Rate limiting (1 request/second by default)
- Prevents overwhelming the Gemini CLI
- FIFO processing

### Error Handling
- Automatic retries on failure
- Timeout protection (60 seconds)
- Graceful error responses
- Detailed logging

### Usage Tracking
- Total requests counter
- Success/failure tracking
- Token estimation
- Average response time
- Uptime monitoring

### Security
- API key authentication
- Bearer token format
- No data storage (stateless)
- All processing local

## 🔌 Integration Examples

### From Telegram (via pantheon-new)

Update `pantheon-new/server/utils/groq-api.ts` to use Gemini service:

```typescript
export async function callGeminiService(prompt: string): Promise<string> {
  const response = await fetch('http://localhost:3500/api/infer', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer your-key-here',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  const data = await response.json();
  return data.response;
}
```

### From n8n Workflow

**HTTP Request node**:
- **Method**: POST
- **URL**: `http://localhost:3500/api/infer`
- **Headers**:
  - `Authorization`: `Bearer your-key-here`
  - `Content-Type`: `application/json`
- **Body**:
  ```json
  {
    "prompt": "={{ $json.message }}"
  }
  ```

### From Python Script

```python
import requests

def ask_gemini(prompt):
    response = requests.post(
        'http://localhost:3500/api/infer',
        headers={
            'Authorization': 'Bearer your-key-here',
            'Content-Type': 'application/json',
        },
        json={'prompt': prompt}
    )
    return response.json()['response']

answer = ask_gemini("What is the meaning of life?")
print(answer)
```

### From cURL

```bash
curl -X POST http://localhost:3500/api/infer \
  -H "Authorization: Bearer your-key-here" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a haiku about coding",
    "temperature": 0.9
  }'
```

## 📊 Monitoring

### Check Service Status

```bash
pm2 status gemini-service
```

### View Logs

```bash
# Live logs
pm2 logs gemini-service

# Last 100 lines
pm2 logs gemini-service --lines 100

# Error logs only
pm2 logs gemini-service --err
```

### Check Health

```bash
curl http://localhost:3500/health
```

### Get Statistics

```bash
curl -H "Authorization: Bearer your-key" \
  http://localhost:3500/api/stats
```

## 🐛 Troubleshooting

### Service Won't Start

**Check if gemini CLI is installed**:
```bash
which gemini
gemini --help
```

**Check port availability**:
```bash
lsof -i :3500
```

**Check PM2 logs**:
```bash
pm2 logs gemini-service --err
```

### Slow Responses

**Issue**: Responses take too long

**Solutions**:
- Check if gemini CLI is hanging: `ps aux | grep gemini`
- Reduce `max_tokens` in requests
- Check Google AI API quotas
- Monitor queue size: `curl http://localhost:3500/health`

### Authentication Errors

**Issue**: 401 Unauthorized

**Solutions**:
- Verify API key matches in config and client
- Check Authorization header format: `Bearer your-key`
- Restart service after changing key: `pm2 restart gemini-service`

### Queue Buildup

**Issue**: Requests piling up in queue

**Solutions**:
- Check if gemini CLI is working: `gemini -y -p "test"`
- Clear queue: `curl -X POST -H "Authorization: Bearer key" http://localhost:3500/api/admin/clear-queue`
- Restart service: `pm2 restart gemini-service`

## 🔐 Security Notes

### Production Deployment

1. **Change the API key** in `ecosystem.config.js`
2. **Don't expose publicly** - keep on localhost
3. **Use reverse proxy** if external access needed (with HTTPS)
4. **Rotate keys** periodically
5. **Monitor usage** for abuse

### API Key Generation

```bash
# Generate strong random key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 📈 Performance

### Typical Response Times
- Simple prompts: 1-2 seconds
- Complex prompts: 3-5 seconds
- Long responses: 5-10 seconds

### Throughput
- ~60 requests/minute (rate limited)
- ~1 request/second processing
- Queue handles burst traffic

### Resource Usage
- Memory: ~50-100 MB
- CPU: Low (mostly waiting on gemini CLI)
- Network: Depends on Google AI API latency

## 🎉 Benefits

✅ **Control**: Everything on your server
✅ **Simple**: Clean REST API
✅ **Compatible**: OpenAI-like format
✅ **Reliable**: Automatic queuing & error handling
✅ **Monitored**: Built-in stats & logging
✅ **Fast**: Local processing, no external dependencies
✅ **Flexible**: Use from any app or language

## 📚 Files

- `server.js` - Main Express server
- `package.json` - Node.js dependencies
- `ecosystem.config.js` - PM2 configuration
- `test-client.js` - Test suite
- `README.md` - This file

## 🚀 Next Steps

1. ✅ Install dependencies
2. ✅ Configure API key
3. ✅ Start service with PM2
4. ✅ Test with `npm test`
5. ✅ Integrate with your apps
6. ✅ Monitor with `/health` and `/api/stats`

🎉 You now have your own local AI server!
