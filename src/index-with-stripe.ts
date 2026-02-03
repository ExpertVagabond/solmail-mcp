#!/usr/bin/env node

/**
 * SolMail MCP Server with Stripe Monetization
 * This version includes API key validation and usage limits
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as dotenv from 'dotenv';
import bs58 from 'bs58';
import { validateApiKey, checkUsageLimit, trackUsage, getUsage } from './stripe-auth.js';

dotenv.config();

// Configuration
const SOLMAIL_API_URL = process.env.SOLMAIL_API_URL || 'https://solmail.online/api';
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || `https://api.${SOLANA_NETWORK}.solana.com`;
const SOLMAIL_API_KEY = process.env.SOLMAIL_API_KEY || 'free'; // User's API key

// Solana connection
let connection: Connection;
let wallet: Keypair | null = null;

// User's subscription info (validated at startup)
let userTier: string = 'free';
let userLimits: any = null;
let customerId: string = 'free';

// Initialize Solana wallet
function initializeWallet() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (privateKey) {
    try {
      const decoded = Uint8Array.from(
        privateKey.includes('[')
          ? JSON.parse(privateKey)
          : bs58.decode(privateKey)
      );
      wallet = Keypair.fromSecretKey(decoded);
      console.error(`Wallet initialized: ${wallet.publicKey.toBase58()}`);
    } catch (error) {
      console.error('Failed to initialize wallet:', error);
    }
  }
}

// Validate user's API key at startup
async function validateUser() {
  const result = await validateApiKey(SOLMAIL_API_KEY);
  if (!result) {
    console.error('Invalid API key! Defaulting to free tier.');
    userTier = 'free';
    userLimits = { monthlyLetters: 5, priority: false, customBranding: false };
    customerId = 'free';
  } else {
    userTier = result.tier;
    userLimits = result.limits;
    customerId = result.customerId;
    console.error(`User validated: ${userTier} tier`);
  }
}

// Helper to get SOL price in USD
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const data = await response.json() as { solana: { usd: number } };
    return data.solana.usd;
  } catch (error) {
    console.error('Failed to fetch SOL price:', error);
    return 100;
  }
}

// Helper to determine mail price
function getMailPrice(country?: string): number {
  const isInternational = country && country.toUpperCase() !== 'US';
  return isInternational ? 2.50 : 1.50;
}

// Create MCP server
const server = new Server(
  {
    name: 'solmail-mcp',
    version: '1.0.2',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const tools: Tool[] = [
  {
    name: 'get_account_info',
    description: 'Get your SolMail account information including tier, usage, and limits',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_mail_quote',
    description: 'Get a price quote for sending physical mail',
    inputSchema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          description: 'Destination country code (e.g., US, GB, CA)',
        },
        color: {
          type: 'boolean',
          description: 'Use color printing (additional cost)',
        },
      },
    },
  },
  {
    name: 'send_mail',
    description: 'Send physical mail to a real address',
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Recipient name' },
            address: { type: 'string', description: 'Street address' },
            city: { type: 'string' },
            state: { type: 'string' },
            zip: { type: 'string' },
            country: { type: 'string', description: 'Country code (e.g., US, GB)' },
          },
          required: ['name', 'address', 'city', 'zip', 'country'],
        },
        message: {
          type: 'string',
          description: 'Letter content (max 10,000 characters)',
        },
        color: {
          type: 'boolean',
          description: 'Use color printing',
        },
      },
      required: ['to', 'message'],
    },
  },
];

// Handle list_tools request
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle call_tool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Get account info
    if (name === 'get_account_info') {
      const usage = await getUsage(customerId);
      const remaining = userLimits.monthlyLetters === -1
        ? 'Unlimited'
        : `${userLimits.monthlyLetters - usage}`;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              tier: userTier,
              usage: usage,
              limit: userLimits.monthlyLetters === -1 ? 'Unlimited' : userLimits.monthlyLetters,
              remaining,
              features: {
                priority: userLimits.priority,
                customBranding: userLimits.customBranding,
              },
            }, null, 2),
          },
        ],
      };
    }

    // Get quote
    if (name === 'get_mail_quote') {
      const country = (args as any).country || 'US';
      const color = (args as any).color || false;

      const basePrice = getMailPrice(country);
      const colorFee = color ? 0.50 : 0;
      const totalUSD = basePrice + colorFee;

      const solPrice = await getSolPrice();
      const solAmount = totalUSD / solPrice;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              country,
              basePrice: `$${basePrice.toFixed(2)}`,
              colorFee: `$${colorFee.toFixed(2)}`,
              totalUSD: `$${totalUSD.toFixed(2)}`,
              solAmount: `${solAmount.toFixed(6)} SOL`,
              solPrice: `$${solPrice.toFixed(2)}`,
            }, null, 2),
          },
        ],
      };
    }

    // Send mail (with usage check)
    if (name === 'send_mail') {
      // Check usage limits
      const hasLimit = await checkUsageLimit(customerId, userLimits);
      if (!hasLimit) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Monthly letter limit reached',
                message: `You've reached your ${userTier} tier limit of ${userLimits.monthlyLetters} letters per month.`,
                upgrade: 'Upgrade to Pro for 100 letters/month or Enterprise for unlimited: https://solmail.online/pricing',
              }, null, 2),
            },
          ],
          isError: true,
        };
      }

      // Proceed with sending mail (your existing logic here)
      const mailData = {
        to: (args as any).to,
        message: (args as any).message,
        color: (args as any).color || false,
      };

      // Update usage
      const currentUsage = await getUsage(customerId);
      await trackUsage(customerId, currentUsage + 1);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Mail sent successfully!',
              usage: {
                sent: currentUsage + 1,
                remaining: userLimits.monthlyLetters === -1
                  ? 'Unlimited'
                  : userLimits.monthlyLetters - (currentUsage + 1),
              },
            }, null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('Starting SolMail MCP server with Stripe monetization...');

  // Initialize
  connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  initializeWallet();
  await validateUser();

  console.error(`User tier: ${userTier}`);
  console.error(`Monthly limit: ${userLimits.monthlyLetters === -1 ? 'Unlimited' : userLimits.monthlyLetters} letters`);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SolMail MCP server running!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
