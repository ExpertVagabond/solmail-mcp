#!/usr/bin/env node
/**
 * SolMail MCP HTTP Server — Hosted SaaS Proxy
 *
 * Stripe-authenticated API gateway for sending physical mail via Solana.
 * Users authenticate with API keys, get rate-limited by tier.
 *
 * Tiers: Free (5/mo), Pro $14.99 (100/mo), Enterprise $99.99 (unlimited)
 */

import express, { Request, Response, NextFunction } from 'express';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import {
  validateApiKey,
  checkUsageLimit,
  trackUsage,
  getUsage,
  createCheckoutSession,
  createPortalSession,
  TIERS,
  PRICING,
} from './stripe-auth.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const SOLMAIL_API_URL = process.env.SOLMAIL_API_URL || 'https://solmail.online/api';
const MERCHANT_WALLET = process.env.MERCHANT_WALLET || 'B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp';
const BASE_URL = process.env.SOLMAIL_BASE_URL || `http://localhost:${PORT}`;

// Extend Request with auth info
interface AuthenticatedRequest extends Request {
  tier?: string;
  tierLimits?: { monthlyLetters: number; priority: boolean; customBranding: boolean };
  customerId?: string;
}

// --- Middleware: API Key Authentication ---

async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string || 'free';

  const result = await validateApiKey(apiKey);
  if (!result) {
    res.status(401).json({ error: 'Invalid API key', upgrade: 'https://solmail.online/pricing' });
    return;
  }

  req.tier = result.tier;
  req.tierLimits = result.limits;
  req.customerId = result.customerId;
  next();
}

// --- CORS ---

app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

// --- Public Routes (no auth) ---

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'solmail-mcp-http',
    version: '1.1.0',
    tiers: Object.keys(TIERS),
  });
});

app.get('/pricing', (req: Request, res: Response) => {
  res.json({
    tiers: {
      free: { price: '$0/month', letters: 5, features: ['Basic mail', 'US + International'] },
      pro: { price: '$14.99/month', letters: 100, features: ['Priority delivery', 'Color printing', 'Double-sided'] },
      enterprise: { price: '$99.99/month', letters: 'Unlimited', features: ['Everything in Pro', 'Custom branding', 'Dedicated support'] },
    },
    signup: `${BASE_URL}/checkout`,
  });
});

app.get('/mcp', (req: Request, res: Response) => {
  res.json({
    name: 'solmail',
    version: '1.1.0',
    description: 'Send physical mail with Solana cryptocurrency — Hosted SaaS API',
    authentication: 'X-API-Key header (get key at https://solmail.online/pricing)',
    tools: [
      {
        name: 'send_mail',
        description: 'Send physical mail using Solana cryptocurrency',
        inputSchema: {
          type: 'object',
          required: ['content', 'recipient'],
          properties: {
            content: { type: 'string', description: 'Letter text (max 10,000 chars)' },
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
                country: { type: 'string' },
              },
            },
            mailOptions: {
              type: 'object',
              properties: {
                color: { type: 'boolean', default: false },
                doubleSided: { type: 'boolean', default: false },
                mailClass: { type: 'string', default: 'first_class' },
              },
            },
          },
        },
      },
      {
        name: 'get_mail_quote',
        description: 'Get a price quote for sending mail (no auth required)',
        inputSchema: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            color: { type: 'boolean', default: false },
          },
        },
      },
      {
        name: 'get_wallet_balance',
        description: 'Check SOL wallet balance',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'get_wallet_address',
        description: 'Get wallet address for funding',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  });
});

// --- Checkout & Billing ---

app.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { email, tier = 'pro' } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email required' });
      return;
    }

    const priceId = tier === 'enterprise'
      ? process.env.STRIPE_ENTERPRISE_PRICE_ID
      : process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
      res.status(500).json({ error: 'Stripe price IDs not configured' });
      return;
    }

    const url = await createCheckoutSession(
      priceId,
      email,
      `${BASE_URL}/checkout/success`,
      `${BASE_URL}/pricing`
    );

    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Checkout failed' });
  }
});

app.post('/portal', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.customerId || req.customerId === 'free') {
      res.status(400).json({ error: 'No active subscription. Sign up at /checkout' });
      return;
    }
    const url = await createPortalSession(req.customerId, `${BASE_URL}/account`);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Portal failed' });
  }
});

app.get('/checkout/success', (req: Request, res: Response) => {
  res.json({
    message: 'Subscription activated! Check your email for your API key.',
    docs: `${BASE_URL}/mcp`,
  });
});

// --- Authenticated Routes ---

app.get('/account', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usage = (req.customerId && req.customerId !== 'free') ? await getUsage(req.customerId) : 0;
    const limit = req.tierLimits?.monthlyLetters ?? 5;

    res.json({
      tier: req.tier,
      usage,
      limit: limit === -1 ? 'Unlimited' : limit,
      remaining: limit === -1 ? 'Unlimited' : Math.max(0, limit - usage),
      features: {
        priority: req.tierLimits?.priority ?? false,
        customBranding: req.tierLimits?.customBranding ?? false,
      },
      manage: `${BASE_URL}/portal`,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch account info' });
  }
});

// --- Tool Execution ---

app.post('/mcp/tools/:toolName', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { toolName } = req.params;
  const { input, walletPrivateKey, network = 'devnet' } = req.body;

  // get_mail_quote doesn't need a wallet
  if (toolName === 'get_mail_quote') {
    try {
      const { country = 'US', color = false } = input || {};
      const solPriceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const solPriceData = await solPriceRes.json() as { solana: { usd: number } };
      const solPrice = solPriceData.solana.usd;

      const basePrice = country === 'US' ? 1.50 : 2.50;
      const colorCost = color ? 0.50 : 0;
      const totalUsd = basePrice + colorCost;
      const totalSol = totalUsd / solPrice;

      res.json({
        priceUsd: totalUsd,
        priceSol: parseFloat(totalSol.toFixed(6)),
        solPrice,
        breakdown: { basePrice, colorPrinting: colorCost },
        country,
        estimatedDelivery: country === 'US' ? '3-5 business days' : '7-14 business days',
        tier: req.tier,
      });
      return;
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch quote' });
      return;
    }
  }

  // All other tools require a wallet
  if (!walletPrivateKey) {
    res.status(401).json({ error: 'walletPrivateKey required in request body' });
    return;
  }

  try {
    const privateKeyBytes = typeof walletPrivateKey === 'string'
      ? bs58.decode(walletPrivateKey)
      : new Uint8Array(walletPrivateKey);
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    const rpcUrl = process.env.SOLANA_RPC_URL || (
      network === 'mainnet-beta'
        ? 'https://api.mainnet-beta.solana.com'
        : 'https://api.devnet.solana.com'
    );
    const connection = new Connection(rpcUrl, 'confirmed');

    switch (toolName) {
      case 'get_wallet_balance': {
        const balance = await connection.getBalance(keypair.publicKey);
        res.json({
          address: keypair.publicKey.toBase58(),
          balance: balance / 1e9,
          balanceLamports: balance,
          network,
        });
        return;
      }

      case 'get_wallet_address': {
        res.json({
          address: keypair.publicKey.toBase58(),
          network,
          hostedApi: BASE_URL,
          message: 'Send SOL to this address to fund mail-sending. Manage subscription at /portal',
        });
        return;
      }

      case 'send_mail': {
        // --- Tier usage check ---
        if (req.tierLimits && req.customerId) {
          const withinLimit = await checkUsageLimit(req.customerId, req.tierLimits);
          if (!withinLimit) {
            res.status(429).json({
              error: 'Monthly letter limit reached',
              tier: req.tier,
              limit: req.tierLimits.monthlyLetters,
              upgrade: 'https://solmail.online/pricing',
            });
            return;
          }
        }

        const { content, recipient, mailOptions = {} } = input;
        if (!content || !recipient) {
          res.status(400).json({ error: 'content and recipient are required' });
          return;
        }

        // --- Calculate price ---
        const country = recipient.country || 'US';
        const basePrice = country.toUpperCase() === 'US' ? 1.50 : 2.50;
        const colorCost = mailOptions.color ? 0.50 : 0;
        const totalUsd = basePrice + colorCost;

        const solPriceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPriceData = await solPriceRes.json() as { solana: { usd: number } };
        const solPrice = solPriceData.solana.usd;
        const solAmount = totalUsd / solPrice;
        const lamports = Math.ceil(solAmount * 1e9);

        // --- Balance pre-check ---
        const balance = await connection.getBalance(keypair.publicKey);
        if (balance < lamports + 10000) {
          res.status(400).json({
            error: 'Insufficient SOL balance',
            required: (lamports + 10000) / 1e9,
            current: balance / 1e9,
            shortfall: (lamports + 10000 - balance) / 1e9,
          });
          return;
        }

        // --- Solana payment ---
        const merchantPubkey = new PublicKey(MERCHANT_WALLET);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: merchantPubkey,
            lamports,
          })
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = keypair.publicKey;
        transaction.sign(keypair);

        const signature = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(signature, 'confirmed');

        // --- On-chain verification ---
        const txInfo = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (!txInfo || txInfo.meta?.err) {
          res.status(500).json({
            error: 'Payment transaction failed on-chain',
            signature,
            details: txInfo?.meta?.err,
          });
          return;
        }

        // --- Submit to SolMail API ---
        const letterRes = await fetch(`${SOLMAIL_API_URL}/send-letter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            contentType: 'text',
            toAddress: recipient,
            mailOptions,
            signature,
          }),
        });

        const letterResult = await letterRes.json() as {
          error?: string;
          letterId?: string;
          trackingNumber?: string;
          expectedDeliveryDate?: string;
          previewUrl?: string;
        };

        if (!letterRes.ok) {
          res.status(400).json({
            error: letterResult.error || 'Failed to send letter',
            payment: { signature, amount: solAmount, priceUsd: totalUsd },
            note: 'Payment was collected. Contact support for refund if letter failed.',
          });
          return;
        }

        // --- Track usage ---
        if (req.customerId) {
          const currentUsage = await getUsage(req.customerId);
          await trackUsage(req.customerId, currentUsage + 1);
        }

        res.json({
          success: true,
          letterId: letterResult.letterId,
          trackingNumber: letterResult.trackingNumber,
          expectedDeliveryDate: letterResult.expectedDeliveryDate,
          previewUrl: letterResult.previewUrl,
          payment: {
            signature,
            amount: parseFloat(solAmount.toFixed(6)),
            priceUsd: totalUsd,
            solPrice,
          },
          recipient: recipient.name,
          city: recipient.city,
          country,
          tier: req.tier,
        });
        return;
      }

      default:
        res.status(404).json({ error: `Unknown tool: ${toolName}` });
        return;
    }
  } catch (error) {
    console.error('Tool execution error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`SolMail MCP HTTP Server v1.1.0 running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`Pricing: http://localhost:${PORT}/pricing`);
  console.log(`MCP info: http://localhost:${PORT}/mcp`);
  console.log(`Tiers: Free (5/mo) | Pro $14.99 (100/mo) | Enterprise $99.99 (unlimited)`);
});
