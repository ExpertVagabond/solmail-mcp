#!/usr/bin/env node
/**
 * SolMail MCP HTTP Server for Smithery
 *
 * This wraps the MCP server functionality in an HTTP API for public distribution.
 * Users must provide their own wallet credentials via API authentication.
 */

import express from 'express';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SOLMAIL_API_URL = process.env.SOLMAIL_API_URL || 'https://solmail.online/api';
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'solmail-mcp-http' });
});

// MCP capability endpoint
app.get('/mcp', (req, res) => {
  res.json({
    name: 'solmail',
    version: '1.0.0',
    description: 'Send physical mail with Solana cryptocurrency',
    tools: [
      {
        name: 'send_mail',
        description: 'Send physical mail using Solana cryptocurrency',
        inputSchema: {
          type: 'object',
          required: ['content', 'recipient', 'mailOptions'],
          properties: {
            content: { type: 'string' },
            recipient: {
              type: 'object',
              required: ['name', 'addressLine1', 'city', 'zipCode', 'country'],
              properties: {
                name: { type: 'string' },
                addressLine1: { type: 'string' },
                addressLine2: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zipCode: { type: 'string' },
                country: { type: 'string' }
              }
            },
            mailOptions: {
              type: 'object',
              properties: {
                color: { type: 'boolean', default: false },
                doubleSided: { type: 'boolean', default: false },
                mailClass: { type: 'string', default: 'first_class' }
              }
            }
          }
        }
      },
      {
        name: 'get_mail_quote',
        description: 'Get a price quote for sending mail',
        inputSchema: {
          type: 'object',
          required: ['country'],
          properties: {
            country: { type: 'string' },
            color: { type: 'boolean', default: false }
          }
        }
      },
      {
        name: 'get_wallet_balance',
        description: 'Get wallet SOL balance',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'get_wallet_address',
        description: 'Get wallet address',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      }
    ]
  });
});

// Tool execution endpoint
app.post('/mcp/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const { input, walletPrivateKey, network = 'devnet' } = req.body;

  // Validate wallet key is provided
  if (!walletPrivateKey && toolName !== 'get_mail_quote') {
    return res.status(401).json({
      error: 'walletPrivateKey required in request body for this tool'
    });
  }

  try {
    let keypair: Keypair | undefined;
    let connection: Connection | undefined;

    if (walletPrivateKey) {
      // Parse private key
      const privateKeyBytes = typeof walletPrivateKey === 'string'
        ? bs58.decode(walletPrivateKey)
        : new Uint8Array(walletPrivateKey);

      keypair = Keypair.fromSecretKey(privateKeyBytes);

      // Create connection
      const rpcUrl = network === 'mainnet-beta'
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com';
      connection = new Connection(rpcUrl, 'confirmed');
    }

    // Execute tool
    switch (toolName) {
      case 'get_mail_quote': {
        const { country = 'US', color = false } = input;

        // Get SOL price
        const solPriceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPriceData = await solPriceRes.json() as { solana: { usd: number } };
        const solPrice = solPriceData.solana.usd;

        // Calculate price
        const basePrice = country === 'US' ? 1.50 : 2.50;
        const colorCost = color ? 0.50 : 0;
        const totalUsd = basePrice + colorCost;
        const totalSol = totalUsd / solPrice;

        return res.json({
          priceUsd: totalUsd,
          priceSol: parseFloat(totalSol.toFixed(6)),
          solPrice,
          breakdown: { basePrice, colorPrinting: colorCost },
          country,
          estimatedDelivery: country === 'US' ? '3-5 business days' : '7-14 business days'
        });
      }

      case 'get_wallet_balance': {
        if (!connection || !keypair) {
          return res.status(400).json({ error: 'Wallet credentials required' });
        }

        const balance = await connection.getBalance(keypair.publicKey);
        return res.json({
          address: keypair.publicKey.toBase58(),
          balance: balance / 1e9,
          balanceLamports: balance,
          network
        });
      }

      case 'get_wallet_address': {
        if (!keypair) {
          return res.status(400).json({ error: 'Wallet credentials required' });
        }

        return res.json({
          address: keypair.publicKey.toBase58(),
          network,
          message: 'Send SOL to this address to fund your mail-sending operations'
        });
      }

      case 'send_mail': {
        if (!connection || !keypair) {
          return res.status(400).json({ error: 'Wallet credentials required' });
        }

        const { content, recipient, mailOptions = {} } = input;

        // Get quote
        const quoteRes = await fetch(`${SOLMAIL_API_URL}/create-payment?country=${recipient.country}`);
        const quote = await quoteRes.json() as { priceSol: number; priceUsd: number };

        // Create payment transaction
        const lamports = Math.ceil(quote.priceSol * 1e9);
        const merchantPubkey = new PublicKey(MERCHANT_WALLET);

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: merchantPubkey,
            lamports
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;

        // Sign and send
        transaction.sign(keypair);
        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        // Submit letter
        const letterRes = await fetch(`${SOLMAIL_API_URL}/send-letter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            contentType: 'text',
            toAddress: recipient,
            mailOptions,
            signature
          })
        });

        const letterResult = await letterRes.json() as {
          error?: string;
          letterId?: string;
          trackingNumber?: string;
          expectedDeliveryDate?: string;
          previewUrl?: string;
        };

        if (!letterRes.ok) {
          return res.status(400).json({ error: letterResult.error || 'Failed to send letter' });
        }

        return res.json({
          success: true,
          letterId: letterResult.letterId,
          trackingNumber: letterResult.trackingNumber,
          expectedDeliveryDate: letterResult.expectedDeliveryDate,
          previewUrl: letterResult.previewUrl,
          payment: {
            signature,
            amount: quote.priceSol,
            priceUsd: quote.priceUsd
          },
          recipient: recipient.name,
          city: recipient.city,
          country: recipient.country
        });
      }

      default:
        return res.status(404).json({ error: 'Tool not found' });
    }
  } catch (error) {
    console.error('Tool execution error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`SolMail MCP HTTP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP info: http://localhost:${PORT}/mcp`);
});
