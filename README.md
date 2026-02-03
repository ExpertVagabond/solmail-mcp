# SolMail MCP Server

**Send real physical mail using Solana cryptocurrency from your AI agent.**

SolMail MCP is a Model Context Protocol (MCP) server that enables AI agents like Claude to send physical letters and postcards to real addresses worldwide, paid for with Solana (SOL) cryptocurrency. Perfect for agents that need to interact with the physical world.

## Features

- 📬 **Send Real Mail**: Physical letters printed and mailed to any address
- 💰 **Crypto Payments**: Pay with SOL on Solana (devnet or mainnet)
- 🌍 **Worldwide Delivery**: Send to 200+ countries
- 🤖 **AI-Native**: Built specifically for AI agent integration
- ⚡ **Fast & Cheap**: Solana's sub-second finality and ~$0.00025 transaction fees
- 🔒 **Non-Custodial**: Direct wallet control, no intermediaries

## Use Cases

- **Autonomous Customer Service**: AI agents sending thank-you notes or receipts
- **AI-Driven Marketing**: Personalized postcards generated and sent by AI
- **Smart Contracts**: Trigger physical mail based on on-chain events
- **AI Personal Assistant**: "Claude, send a birthday card to my mom"
- **Automated Reminders**: Physical notifications for important events

## Installation

```bash
# Clone or create the project
git clone <repository-url>
cd solmail-mcp

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
# SolMail API Configuration
SOLMAIL_API_URL=https://solmail.online/api

# Solana Wallet (your agent's wallet private key)
# IMPORTANT: Use a dedicated wallet with limited funds for AI agents
SOLANA_PRIVATE_KEY=your_base58_private_key_here

# Solana Network
SOLANA_NETWORK=devnet
# Options: devnet (for testing), mainnet-beta (for production)

# Optional: Merchant wallet (where payments go)
# If not set, uses SolMail's default merchant wallet
MERCHANT_WALLET=<merchant_solana_address>
```

### Getting a Solana Wallet

To use this MCP server, your AI agent needs its own Solana wallet:

```bash
# Install Solana CLI (if not already installed)
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Generate a new keypair
solana-keygen new --outfile ~/.config/solana/agent-wallet.json

# Get the private key in base58 format
solana-keygen pubkey ~/.config/solana/agent-wallet.json  # This is your public address

# To get the private key as base58 (for .env file):
# The keypair JSON file contains the private key bytes
```

**Important**: For AI agents, create a dedicated wallet and only fund it with the amount needed for mail sending. Never use your primary wallet.

### Funding Your Wallet

**For Devnet (Testing)**:
```bash
# Airdrop free devnet SOL
solana airdrop 2 <your-wallet-address> --url devnet
```

**For Mainnet (Production)**:
Transfer SOL to your agent's wallet address. Each letter costs approximately:
- Domestic (US): $1.50 = ~0.015 SOL (at $100/SOL)
- International: $2.50 = ~0.025 SOL (at $100/SOL)
- Plus Solana transaction fee: ~$0.00025

## Usage with Claude Desktop

Add to your Claude Desktop MCP settings file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "solmail": {
      "command": "node",
      "args": ["/absolute/path/to/solmail-mcp/dist/index.js"],
      "env": {
        "SOLMAIL_API_URL": "https://solmail.online/api",
        "SOLANA_NETWORK": "devnet",
        "SOLANA_PRIVATE_KEY": "your_base58_private_key"
      }
    }
  }
}
```

Restart Claude Desktop after adding the configuration.

## Available Tools

### `get_mail_quote`
Get a price quote for sending mail.

**Input:**
```json
{
  "country": "US",
  "color": false
}
```

**Output:**
```json
{
  "priceUsd": 1.50,
  "priceSol": 0.015,
  "solPrice": 100.0,
  "breakdown": {
    "basePrice": 1.50,
    "colorPrinting": 0.00
  },
  "country": "US",
  "estimatedDelivery": "3-5 business days"
}
```

### `send_mail`
Send physical mail with Solana payment.

**Input:**
```json
{
  "content": "Dear Friend,\n\nThis letter was sent by an AI agent using Solana cryptocurrency!\n\nBest regards,\nClaude",
  "recipient": {
    "name": "John Doe",
    "addressLine1": "123 Main Street",
    "city": "San Francisco",
    "state": "CA",
    "zipCode": "94102",
    "country": "US"
  },
  "mailOptions": {
    "color": false,
    "doubleSided": false,
    "mailClass": "first_class"
  }
}
```

**Output:**
```json
{
  "success": true,
  "letterId": "ltr_abc123",
  "trackingNumber": "9400000000000000000000",
  "expectedDeliveryDate": "2026-02-07T00:00:00Z",
  "previewUrl": "https://...",
  "payment": {
    "signature": "5j7s...",
    "amount": 0.015,
    "priceUsd": 1.50
  },
  "recipient": "John Doe",
  "city": "San Francisco",
  "country": "US"
}
```

### `get_wallet_balance`
Check your agent's wallet balance.

**Output:**
```json
{
  "address": "B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp",
  "balance": 2.5,
  "balanceLamports": 2500000000,
  "network": "devnet"
}
```

### `get_wallet_address`
Get your agent's wallet address for funding.

**Output:**
```json
{
  "address": "B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp",
  "network": "devnet",
  "message": "Send SOL to this address to fund your mail-sending operations"
}
```

## Example Conversations

**With Claude:**

```
You: Send a thank you note to John Doe at 123 Main St, San Francisco, CA 94102

Claude: I'll help you send that thank you note via physical mail using Solana!

Let me first check the cost and then send the letter.

[Uses get_mail_quote tool]
The cost will be $1.50 (approximately 0.015 SOL) for domestic US mail.

[Uses send_mail tool]
✓ Letter sent successfully!

Your thank you note has been sent to John Doe and should arrive in 3-5 business days.

Transaction details:
- Letter ID: ltr_abc123
- Tracking: 9400000000000000000000
- Payment: 0.015 SOL (signature: 5j7s...)
- Expected delivery: February 7, 2026

You can view the letter preview at: https://...
```

## How It Works

1. **Agent composes** letter content
2. **MCP server** validates recipient address
3. **Solana transaction** is created and signed by agent's wallet
4. **Payment is sent** to SolMail merchant wallet
5. **Transaction signature** is submitted to SolMail API
6. **SolMail verifies** the on-chain payment
7. **Letter is printed** by fulfillment partner (Lob.com)
8. **Letter is mailed** via USPS/postal service
9. **Tracking info** returned to agent

## Architecture

```
┌─────────────┐      MCP Protocol      ┌──────────────┐
│   Claude    │◄──────────────────────►│  SolMail MCP │
│  (AI Agent) │                        │    Server    │
└─────────────┘                        └──────┬───────┘
                                              │
                                              │ HTTPS API
                                              │
                    ┌─────────────────────────┼──────────────┐
                    │                         │              │
                    ▼                         ▼              ▼
              ┌──────────┐            ┌─────────────┐  ┌─────────┐
              │  Solana  │            │   SolMail   │  │   Lob   │
              │Blockchain│            │   Backend   │  │ Printing│
              │(Payment) │            │  (Verify)   │  │ & Mail  │
              └──────────┘            └─────────────┘  └─────────┘
```

## Pricing

- **US Domestic Letter**: $1.50
- **International Letter**: $2.50
- **Color Printing**: +$0.50
- **Solana Transaction Fee**: ~$0.00025

Prices are in USD and automatically converted to SOL at current market rates using CoinGecko API.

## Development

```bash
# Watch mode for development
npm run dev

# Build for production
npm run build

# Run the server
npm start
```

## Security Considerations

1. **Dedicated Wallet**: Create a separate wallet for your AI agent with limited funds
2. **Private Key Security**: Store `SOLANA_PRIVATE_KEY` securely, never commit to git
3. **Devnet Testing**: Test thoroughly on devnet before using mainnet
4. **Rate Limiting**: Implement spending limits for autonomous agents
5. **Content Review**: Consider reviewing mail content before sending (for production)

## Limitations

- Currently supports plain text letters only (PDF support coming soon)
- Requires wallet with SOL balance
- Subject to postal delivery times (not instant)
- Mail content reviewed by fulfillment partner (Lob.com) for policy compliance

## Roadmap

- [ ] PDF attachment support
- [ ] Multiple letter templates
- [ ] Postcard support
- [ ] Package/merchandise shipping
- [ ] Return address management
- [ ] Bulk sending optimization
- [ ] USDC payment support
- [ ] Multi-chain support (EVM chains)

## Support & Links

- **Website**: https://solmail.online
- **API Docs**: https://solmail.online/docs
- **Solana Docs**: https://docs.solana.com
- **MCP Docs**: https://modelcontextprotocol.io

## License

MIT

## Credits

Built with:
- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Solana](https://solana.com) blockchain
- [Lob.com](https://lob.com) print & mail API

---

**Made for the Colosseum Agent Hackathon 🏛️**

*Bridging AI agents and the physical world, one letter at a time.*
