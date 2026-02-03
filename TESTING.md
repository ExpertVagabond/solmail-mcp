# Testing Guide for SolMail MCP Server

This guide will help you test the SolMail MCP server integration with Claude.

## Prerequisites

1. **Node.js** installed (v18 or higher)
2. **Claude Desktop** installed
3. **Solana CLI** (optional, for wallet management)
4. **Test wallet** with devnet SOL

## Setup Steps

### 1. Generate a Test Wallet

```bash
# Install Solana CLI if you haven't already
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair for testing
solana-keygen new --outfile ~/.config/solana/solmail-test-wallet.json

# View the public address
solana-keygen pubkey ~/.config/solana/solmail-test-wallet.json

# Get the private key (for .env file)
# The JSON file contains the private key as a byte array
cat ~/.config/solana/solmail-test-wallet.json
```

### 2. Get Devnet SOL

```bash
# Airdrop devnet SOL to your wallet
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Check balance
solana balance <YOUR_WALLET_ADDRESS> --url devnet
```

### 3. Configure the MCP Server

Create or edit `.env` file:

```bash
SOLMAIL_API_URL=https://solmail.online/api
SOLANA_NETWORK=devnet
SOLANA_PRIVATE_KEY=<YOUR_BASE58_PRIVATE_KEY>
```

To convert your JSON keypair to base58:
```bash
# Using Node.js
node -e "console.log(require('bs58').encode(Buffer.from(require('./path-to-wallet.json'))))"
```

### 4. Configure Claude Desktop

**macOS**: Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "solmail": {
      "command": "node",
      "args": [
        "/absolute/path/to/solmail-mcp/dist/index.js"
      ],
      "env": {
        "SOLMAIL_API_URL": "https://solmail.online/api",
        "SOLANA_NETWORK": "devnet",
        "SOLANA_PRIVATE_KEY": "your_base58_private_key_here"
      }
    }
  }
}
```

**Important**:
- Use absolute paths, not relative paths like `~/`
- Replace `/absolute/path/to/` with your actual directory path
- Never commit files containing your private key

### 5. Restart Claude Desktop

After updating the configuration, completely quit and restart Claude Desktop.

## Test Scenarios

### Test 1: Check Wallet Balance

Ask Claude:
```
What's my SolMail wallet balance?
```

Expected response:
```json
{
  "address": "YOUR_WALLET_ADDRESS",
  "balance": 2.0,
  "balanceLamports": 2000000000,
  "network": "devnet"
}
```

### Test 2: Get Mail Quote

Ask Claude:
```
How much does it cost to send a letter to the US?
```

Expected response includes:
- Price in USD (~$1.50)
- Price in SOL (based on current exchange rate)
- Estimated delivery time

### Test 3: Send Test Mail

Ask Claude:
```
Send a test letter to:
John Doe
123 Main Street
San Francisco, CA 94102

The letter should say: "Hello! This letter was sent by an AI agent using Solana cryptocurrency. Pretty cool, right?"
```

Claude will:
1. Check the quote
2. Verify wallet balance
3. Create and sign the transaction
4. Submit to SolMail API
5. Return tracking information

Expected response includes:
- `letterId`: Unique letter identifier
- `trackingNumber`: USPS tracking number
- `expectedDeliveryDate`: Estimated delivery
- `previewUrl`: Link to view the letter

### Test 4: International Mail

Ask Claude:
```
How much would it cost to send a color letter to London, UK?
```

This tests:
- International pricing ($2.50 base)
- Color printing option (+$0.50)
- Currency conversion

## Troubleshooting

### Error: "Wallet not configured"

**Solution**: Check that `SOLANA_PRIVATE_KEY` is set in your environment configuration.

### Error: "Insufficient funds"

**Solution**:
```bash
# Get more devnet SOL
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet
```

### Error: "Failed to connect to Solana"

**Solution**: Check that you're using the correct RPC endpoint:
- Devnet: `https://api.devnet.solana.com`
- Mainnet: `https://api.mainnet-beta.solana.com`

### Claude doesn't see the tools

**Solutions**:
1. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/`
   - Look for MCP server startup errors
2. Verify the path in `claude_desktop_config.json` is absolute
3. Make sure you ran `npm run build` after any code changes
4. Restart Claude Desktop completely (Cmd+Q, not just close window)

### Transaction verification fails

**Possible causes**:
1. Network congestion (rare on devnet)
2. Insufficient balance
3. API endpoint issues

**Solutions**:
- Wait a few seconds and retry
- Check your wallet balance
- Verify the SolMail API is accessible

## Viewing Logs

### MCP Server Logs

The MCP server logs to stderr, which Claude Desktop captures:

```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log

# Look for:
# - "SolMail MCP Server running on stdio"
# - "Wallet initialized: <address>"
# - "Sending payment transaction..."
# - "Payment confirmed: <signature>"
```

### Solana Transaction Explorer

View your transactions on Solana Explorer:
- Devnet: `https://explorer.solana.com/?cluster=devnet`
- Search for your wallet address or transaction signature

## Best Practices

### Security
1. **Never use your main wallet** - Create a dedicated test wallet
2. **Limit funds** - Only keep enough SOL for testing
3. **Keep keys private** - Never commit `.env` files
4. **Use devnet first** - Test thoroughly before mainnet

### Development
1. **Test incrementally** - Start with balance check, then quotes, then sending
2. **Monitor logs** - Keep an eye on Claude Desktop logs
3. **Check transactions** - Verify on Solana Explorer
4. **Handle errors** - Try edge cases (insufficient funds, invalid addresses)

### Cost Management
- Each devnet letter costs ~0.015 SOL (free via airdrops)
- Mainnet costs real money (~$1.50-2.50 per letter)
- Set spending limits for autonomous agents

## Production Checklist

Before deploying to mainnet:

- [ ] Tested all features on devnet
- [ ] Verified transaction confirmations
- [ ] Tested error handling (insufficient funds, invalid addresses)
- [ ] Set up monitoring and alerting
- [ ] Implemented spending limits
- [ ] Documented wallet backup procedures
- [ ] Tested international addresses
- [ ] Verified mail preview and tracking
- [ ] Set up proper key management
- [ ] Created operational runbook

## Advanced Testing

### Load Testing

Test multiple concurrent requests:
```
Send 5 letters to different addresses:
1. John Doe, 123 Main St, San Francisco, CA 94102
2. Jane Smith, 456 Oak Ave, Los Angeles, CA 90001
...
```

### Error Recovery

Test error conditions:
1. Empty wallet (insufficient funds)
2. Invalid addresses
3. Network interruptions
4. API timeouts

### Integration Testing

Test with other MCP servers:
- Use AgentWallet MCP for wallet management
- Combine with other Solana tools
- Test multi-step workflows

## Support

If you encounter issues:
1. Check this testing guide
2. Review the main README.md
3. Check GitHub issues
4. Open a new issue with:
   - Claude Desktop version
   - Node.js version
   - Error messages from logs
   - Steps to reproduce

---

Happy testing! 🚀📬
