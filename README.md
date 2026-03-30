# :mailbox_with_mail: solmail-mcp

[![npm version](https://img.shields.io/npm/v/solmail-mcp.svg)](https://www.npmjs.com/package/solmail-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/ExpertVagabond/solmail-mcp)](https://github.com/ExpertVagabond/solmail-mcp/stargazers)
[![Solana](https://img.shields.io/badge/Solana-14F195?logo=solana&logoColor=white)](https://solana.com)

**Send real physical mail using Solana cryptocurrency from your AI agent.** A [Model Context Protocol](https://modelcontextprotocol.io) server that enables Claude and other AI agents to send physical letters and postcards to real addresses worldwide, paid with SOL. Built for the Colosseum Agent Hackathon (#47).

## Install

```bash
npx solmail-mcp@latest
```

Add to your MCP config:

```json
{
  "mcpServers": {
    "solmail": {
      "command": "npx",
      "args": ["-y", "solmail-mcp"],
      "env": {
        "SOLANA_NETWORK": "devnet",
        "SOLANA_PRIVATE_KEY": "your_base58_private_key"
      }
    }
  }
}
```

## Hosted deployment

A hosted deployment is available on [Fronteir AI](https://fronteir.ai/mcp/expertvagabond-solmail-mcp).

## Features

- **Physical Mail** -- Letters printed and mailed to 200+ countries via Lob.com
- **Solana Payments** -- Pay with SOL on devnet (testing) or mainnet (production)
- **Non-Custodial** -- Direct wallet control, no intermediaries
- **AI-Native** -- Built specifically for MCP agent integration
- **Demo Mode** -- Test with devnet SOL and Lob test API at zero cost

## Tools (4)

| Tool | Description |
|------|-------------|
| `get_mail_quote` | Get price quote for sending mail (country, color options) |
| `send_mail` | Send a physical letter with Solana payment |
| `get_wallet_balance` | Check agent wallet SOL balance |
| `get_wallet_address` | Get wallet address for funding |

## Usage Example

```
You: Send a thank you note to John Doe at 123 Main St, San Francisco, CA 94102

Claude: [calls get_mail_quote] Cost: $1.50 (~0.015 SOL) for domestic US mail
        [calls send_mail] Letter sent!
          Letter ID: ltr_abc123
          Tracking: 9400000000000000000000
          Payment: 0.015 SOL (tx: 5j7s...)
          Delivery: 3-5 business days
```

## How It Works

```
Agent composes letter --> MCP validates address --> Solana tx signed
    --> Payment sent to merchant --> SolMail verifies on-chain
    --> Lob.com prints letter --> USPS delivers --> Tracking returned
```

## Pricing

| Type | Price | SOL (at $100/SOL) |
|------|-------|-------------------|
| US Domestic | $1.50 | ~0.015 SOL |
| International | $2.50 | ~0.025 SOL |
| Color printing | +$0.50 | +0.005 SOL |
| Solana tx fee | ~$0.00025 | ~0.0000025 SOL |

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SOLANA_PRIVATE_KEY` | Yes | Agent wallet private key (base58) |
| `SOLANA_NETWORK` | No | `devnet` (default) or `mainnet-beta` |
| `SOLMAIL_API_URL` | No | API endpoint (default: `https://solmail.online/api`) |
| `MERCHANT_WALLET` | No | Custom payment destination |

**Important**: Create a dedicated wallet with limited funds for AI agents. Never use your primary wallet.

## Development

```bash
npm install && npm run build
npm run dev    # Watch mode
npm start      # Production
```

## Related Projects

- [solana-mcp-server-app](https://github.com/ExpertVagabond/solana-mcp-server-app) -- Solana wallet + DeFi MCP
- [coldstar-colosseum](https://github.com/ExpertVagabond/coldstar-colosseum) -- Air-gapped Solana vault
- [ordinals-mcp](https://github.com/ExpertVagabond/ordinals-mcp) -- Bitcoin Ordinals MCP server
- [cpanel-mcp](https://github.com/ExpertVagabond/cpanel-mcp) -- cPanel hosting MCP server

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Open a Pull Request

## Links

- [Website](https://solmail.online) | [npm](https://www.npmjs.com/package/solmail-mcp) | [MCP Docs](https://modelcontextprotocol.io)

## License

MIT -- [Purple Squirrel Media](https://github.com/ExpertVagabond)
