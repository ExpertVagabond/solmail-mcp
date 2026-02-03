# Publishing SolMail MCP - Complete Guide

This guide covers all distribution channels for SolMail MCP.

## 📦 NPM Publishing

### Prerequisites
```bash
# Create NPM account at https://www.npmjs.com
# Login to NPM
npm login
```

### Publish
```bash
cd ~/solmail-mcp

# Ensure build is fresh
npm run build

# Publish to NPM
npm publish
```

### Installation (for users)
```bash
# Global install
npm install -g solmail-mcp

# Then users configure in Claude Desktop:
{
  "mcpServers": {
    "solmail": {
      "command": "solmail-mcp",
      "env": {
        "SOLANA_PRIVATE_KEY": "your_key_here",
        "SOLANA_NETWORK": "devnet"
      }
    }
  }
}
```

### Updating Version
```bash
# Update version
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.0 → 1.1.0
npm version major  # 1.0.0 → 2.0.0

# Publish new version
npm publish
```

---

## 🏛️ Anthropic MCP Registry

### Submission Process

1. **Fork the MCP Registry**
   ```bash
   # Visit and fork
   open https://github.com/anthropics/mcp-registry

   # Clone your fork
   git clone https://github.com/YOUR_USERNAME/mcp-registry
   cd mcp-registry
   ```

2. **Add SolMail Entry**

   Create file: `servers/solmail.json`
   ```json
   {
     "name": "solmail",
     "displayName": "SolMail",
     "description": "Send physical mail with Solana cryptocurrency",
     "repository": "https://github.com/ExpertVagabond/solmail-mcp",
     "installation": {
       "npm": "solmail-mcp"
     },
     "configuration": {
       "command": "solmail-mcp",
       "env": {
         "SOLANA_PRIVATE_KEY": {
           "description": "Your agent's Solana wallet private key",
           "required": true
         },
         "SOLANA_NETWORK": {
           "description": "Network: devnet or mainnet-beta",
           "default": "devnet"
         }
       }
     }
   }
   ```

3. **Submit Pull Request**
   ```bash
   git add servers/solmail.json
   git commit -m "Add SolMail MCP server"
   git push origin main

   # Create PR on GitHub
   open https://github.com/anthropics/mcp-registry/compare
   ```

4. **PR Description Template**
   ```markdown
   # Add SolMail MCP Server

   **Name**: SolMail
   **Category**: Communication / Physical World
   **Repository**: https://github.com/ExpertVagabond/solmail-mcp

   ## Description
   SolMail enables AI agents to send real physical letters and postcards worldwide,
   paid for with Solana cryptocurrency. First AI-to-physical-mail bridge.

   ## Features
   - Send real mail to 200+ countries
   - Pay with SOL (devnet or mainnet)
   - Non-custodial wallet control
   - Production-ready infrastructure (Lob.com)

   ## Installation
   ```bash
   npm install -g solmail-mcp
   ```

   ## Testing
   Tested with Claude Desktop on macOS. Demo: https://solmail.online

   ## License
   MIT
   ```

---

## 🌐 Smithery Publishing

### Option 1: Direct HTTP Server (Recommended)

1. **Deploy HTTP Server**
   ```bash
   # See HTTP_DEPLOYMENT.md for full guide
   cd ~/solmail-mcp
   railway up  # or render/fly.io
   ```

2. **Publish to Smithery**
   - Go to: https://smithery.ai/new
   - **Namespace**: `solmail`
   - **Server ID**: `solmail-mcp`
   - **MCP Server URL**: `https://your-deployment.railway.app/mcp`
   - Click **Continue** → **Publish**

### Option 2: NPM Reference

If Smithery supports NPM-based MCP servers:
- **Installation Method**: npm
- **Package Name**: `solmail-mcp`
- **Command**: `solmail-mcp`

---

## 📢 Community Promotion

### GitHub
```bash
# Add topic tags to repo
gh repo edit --add-topic mcp,solana,mail,ai-agent,model-context-protocol

# Create release
gh release create v1.0.0 --title "SolMail MCP v1.0.0" --notes "Initial release"
```

### Social Media

**Twitter/X**:
```
🚀 Just published SolMail MCP!

AI agents can now send REAL physical mail using Solana cryptocurrency.

✅ 200+ countries
✅ ~$1.50 per letter
✅ 400ms Solana finality
✅ Production-ready

Try it: npm install -g solmail-mcp

#Solana #AI #MCP
```

**Reddit** (r/solana, r/ClaudeAI):
```markdown
## SolMail MCP: Send Physical Mail from AI Agents

I built an MCP server that lets AI agents like Claude send real physical letters,
paid for with Solana.

**Use Cases**:
- AI customer service sending thank-you notes
- Automated birthday cards
- Physical receipts for on-chain transactions

**Try it**: `npm install -g solmail-mcp`

[GitHub](https://github.com/ExpertVagabond/solmail-mcp) | [Demo](https://solmail.online)
```

### Colosseum Hackathon

✅ Already submitted!
- Agent: #74 (solmail-agent)
- Project: #35 (SolMail)
- Status: Submitted

---

## 📊 Distribution Status

| Channel | Status | URL |
|---------|--------|-----|
| **NPM** | ⏳ Ready to publish | `npm publish` |
| **MCP Registry** | ⏳ PR needed | [Fork & submit](https://github.com/anthropics/mcp-registry) |
| **Smithery** | ⏳ Deploy HTTP server | [Deploy guide](./HTTP_DEPLOYMENT.md) |
| **GitHub** | ✅ Published | https://github.com/ExpertVagabond/solmail-mcp |
| **Colosseum** | ✅ Submitted | Agent #74, Project #35 |

---

## 🎯 Next Steps

1. **Immediate**: `npm login && npm publish`
2. **This Week**: Submit to MCP Registry
3. **Optional**: Deploy HTTP server for Smithery
4. **Ongoing**: Community engagement & promotion

---

**Questions?**
- Email: hello@solmail.online
- GitHub Issues: https://github.com/ExpertVagabond/solmail-mcp/issues
- Twitter: @expertvagabond
