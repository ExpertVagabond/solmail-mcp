# SolMail MCP HTTP Server Deployment

This guide covers deploying the HTTP wrapper for Smithery and other HTTP-based MCP clients.

## Overview

The HTTP server provides a REST API that wraps MCP functionality. Unlike the stdio-based MCP server (for Claude Desktop), this version accepts wallet credentials per-request for security.

## Architecture

```
User/Agent → HTTP Request (with wallet key) → HTTP Server → Solana/SolMail API
```

**Security Model**: Users provide their private key with each request (not stored on server).

## Local Testing

```bash
# Install HTTP dependencies
npm install express @types/express

# Build
npm run build

# Start server
PORT=3001 node dist/http-server.js
```

## API Endpoints

### Health Check
```bash
GET /health
Response: { "status": "ok", "service": "solmail-mcp-http" }
```

### MCP Capabilities
```bash
GET /mcp
Response: { "name": "solmail", "tools": [...] }
```

### Execute Tool
```bash
POST /mcp/tools/:toolName
Body: {
  "input": { /* tool-specific input */ },
  "walletPrivateKey": "base58_private_key_here",
  "network": "devnet" // or "mainnet-beta"
}
```

## Example: Send Mail via HTTP

```bash
curl -X POST http://localhost:3001/mcp/tools/send_mail \
  -H "Content-Type: application/json" \
  -d '{
    "walletPrivateKey": "YOUR_PRIVATE_KEY_BASE58",
    "network": "devnet",
    "input": {
      "content": "Hello from HTTP MCP!",
      "recipient": {
        "name": "John Doe",
        "addressLine1": "123 Main St",
        "city": "San Francisco",
        "state": "CA",
        "zipCode": "94102",
        "country": "US"
      },
      "mailOptions": {
        "color": false
      }
    }
  }'
```

## Deployment Options

### 1. Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Add environment variables
railway variables set PORT=3001
railway variables set SOLMAIL_API_URL=https://solmail.online/api
railway variables set MERCHANT_WALLET=B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp

# Deploy
railway up
```

Your server will be available at: `https://your-project.railway.app`

### 2. Render

1. Create new Web Service at https://render.com
2. Connect GitHub repo: `https://github.com/ExpertVagabond/solmail-mcp`
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node dist/http-server.js`
   - **Environment Variables**:
     - `PORT`: 3001
     - `SOLMAIL_API_URL`: https://solmail.online/api
     - `MERCHANT_WALLET`: B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp

### 3. Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Set environment
fly secrets set SOLMAIL_API_URL=https://solmail.online/api
fly secrets set MERCHANT_WALLET=B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp

# Deploy
fly deploy
```

## Publishing to Smithery

Once deployed, use your HTTP endpoint:

1. Go to https://smithery.ai/new
2. Fill in:
   - **Namespace**: `solmail`
   - **Server ID**: `solmail`
   - **MCP Server URL**: `https://your-deployment-url.com/mcp`
3. Click **Continue**
4. Test the connection
5. Publish!

## Security Considerations

**Important**: This HTTP server accepts private keys in requests. For production:

1. Use HTTPS only (Railway/Render/Fly provide this)
2. Implement rate limiting
3. Add request signing/authentication
4. Consider proxy authentication instead of raw keys
5. Log security events
6. Add CORS restrictions

## Monitoring

### Check server health
```bash
curl https://your-deployment.com/health
```

### Get MCP capabilities
```bash
curl https://your-deployment.com/mcp
```

### Test quote (no auth needed)
```bash
curl -X POST https://your-deployment.com/mcp/tools/get_mail_quote \
  -H "Content-Type: application/json" \
  -d '{"input": {"country": "US", "color": false}}'
```

## Cost Estimate

- **Railway**: ~$5/month (500 hours free tier)
- **Render**: Free tier available
- **Fly.io**: ~$5/month (free tier: 3 VMs)

## Support

For issues or questions:
- GitHub: https://github.com/ExpertVagabond/solmail-mcp/issues
- Email: hello@solmail.online
