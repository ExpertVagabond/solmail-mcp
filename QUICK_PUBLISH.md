# Quick Publish Guide - Do This Now! 🚀

Three commands to publish SolMail MCP everywhere.

---

## 1️⃣ NPM (5 minutes)

```bash
# Login to NPM (one-time setup)
npm login
# Follow prompts: username, password, email

# Publish!
cd ~/solmail-mcp
npm publish

# ✅ Done! Users can now: npm install -g solmail-mcp
```

**Verify**: Visit https://www.npmjs.com/package/solmail-mcp

---

## 2️⃣ Anthropic MCP Registry (10 minutes)

```bash
# Fork and clone registry
open https://github.com/anthropics/mcp-registry
# Click "Fork" button

# Clone YOUR fork
git clone https://github.com/YOUR_USERNAME/mcp-registry
cd mcp-registry

# Copy prepared submission
cp ~/solmail-mcp/mcp-registry-submission.json servers/solmail.json

# Commit and push
git add servers/solmail.json
git commit -m "Add SolMail MCP server"
git push origin main

# Create PR
open https://github.com/anthropics/mcp-registry/compare
# Click "Create Pull Request"
# Title: "Add SolMail MCP Server"
# Description: "AI agents can send physical mail with Solana cryptocurrency"
# Click "Create Pull Request"
```

**Verify**: Watch for PR approval at https://github.com/anthropics/mcp-registry/pulls

---

## 3️⃣ Smithery (15 minutes)

### Deploy HTTP Server

**Option A - Railway (Easiest)**:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd ~/solmail-mcp
railway init

# Deploy
railway up

# Get URL
railway domain
# Copy the URL: https://solmail-mcp-production.up.railway.app
```

**Option B - Render**:
1. Go to https://render.com/deploy
2. Connect GitHub: `https://github.com/ExpertVagabond/solmail-mcp`
3. Settings:
   - Build: `npm install && npm run build`
   - Start: `node dist/http-server.js`
   - Add env vars:
     - `PORT=3001`
     - `SOLMAIL_API_URL=https://solmail.online/api`
     - `MERCHANT_WALLET=B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp`
4. Click "Deploy"
5. Copy URL: `https://solmail-mcp.onrender.com`

### Publish to Smithery

1. Go to https://smithery.ai/new
2. Fill in:
   - **Namespace**: `solmail`
   - **Server ID**: `solmail-mcp`
   - **MCP Server URL**: `https://YOUR-DEPLOYMENT-URL.com/mcp`
3. Click **Continue**
4. Test connection
5. Click **Publish**

**Verify**: Visit https://smithery.ai/server/solmail/solmail-mcp

---

## ✅ Checklist

After publishing, verify:

- [ ] NPM package live: `npm info solmail-mcp`
- [ ] MCP Registry PR created
- [ ] HTTP server deployed and responding: `curl https://YOUR-URL.com/health`
- [ ] Smithery listing published

---

## 📊 Distribution Complete!

Once all three are done, SolMail MCP will be available:

1. **NPM**: Direct install for Claude Desktop users
2. **MCP Registry**: Listed in official Anthropic registry
3. **Smithery**: Available to 10,000+ Smithery users

---

## 🎯 Post-Publishing

Update your project submission:

```bash
# Add distribution links to hackathon project
curl -X PUT https://agents.colosseum.com/api/my-project \
  -H "Authorization: Bearer 3853034c0a8ddbac6deb9e77270cf389fc0c445e75e13b5ae7ba57aa4c9c5ecb" \
  -H "Content-Type: application/json" \
  -d '{
    "additionalLinks": [
      {"title": "NPM Package", "url": "https://www.npmjs.com/package/solmail-mcp"},
      {"title": "Smithery Listing", "url": "https://smithery.ai/server/solmail/solmail-mcp"}
    ]
  }'
```

---

## Need Help?

- **NPM Issues**: See PUBLISHING.md section "NPM Publishing"
- **Deployment Issues**: See HTTP_DEPLOYMENT.md
- **Registry Issues**: Check https://github.com/anthropics/mcp-registry/blob/main/CONTRIBUTING.md

---

**Let's make SolMail MCP available to the world! 🌍**
