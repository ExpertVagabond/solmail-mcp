#!/usr/bin/env node

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

dotenv.config();

// Configuration
const SOLMAIL_API_URL = process.env.SOLMAIL_API_URL || 'https://solmail.online/api';
const SOLANA_NETWORK = process.env.SOLANA_NETWORK || 'devnet';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || `https://api.${SOLANA_NETWORK}.solana.com`;

// Solana connection
let connection: Connection;
let wallet: Keypair | null = null;

// Initialize Solana wallet if private key is provided
function initializeWallet() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (privateKey) {
    try {
      // Support both base58 and JSON array formats
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
    // Fallback price
    return 100;
  }
}

// Helper to determine mail price based on country
function getMailPrice(country?: string): number {
  const isInternational = country && country.toUpperCase() !== 'US';
  return isInternational ? 2.50 : 1.50;
}

// Create MCP server
const server = new Server(
  {
    name: 'solmail-mcp',
    version: '1.1.0',
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
    name: 'get_mail_quote',
    description:
      'Get a price quote for sending physical mail. Returns price in USD and estimated SOL amount based on current exchange rates.',
    inputSchema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          description: 'Destination country code (e.g., US, GB, CA). Defaults to US.',
        },
        color: {
          type: 'boolean',
          description: 'Whether to print in color. Adds $0.50 to price.',
          default: false,
        },
      },
    },
  },
  {
    name: 'send_mail',
    description:
      'Send physical mail using Solana cryptocurrency. Composes a letter, creates a Solana payment transaction, and submits to SolMail for printing and mailing. Requires wallet configuration.',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The letter content (plain text, will be formatted as a letter)',
        },
        recipient: {
          type: 'object',
          description: 'Recipient address information',
          properties: {
            name: {
              type: 'string',
              description: 'Full name of recipient',
            },
            addressLine1: {
              type: 'string',
              description: 'Street address line 1',
            },
            addressLine2: {
              type: 'string',
              description: 'Street address line 2 (optional)',
            },
            city: {
              type: 'string',
              description: 'City',
            },
            state: {
              type: 'string',
              description: 'State/Province code (e.g., CA, NY)',
            },
            zipCode: {
              type: 'string',
              description: 'ZIP or postal code',
            },
            country: {
              type: 'string',
              description: 'Country code (e.g., US, GB, CA). Defaults to US.',
              default: 'US',
            },
          },
          required: ['name', 'addressLine1', 'city', 'state', 'zipCode'],
        },
        mailOptions: {
          type: 'object',
          description: 'Mail formatting options',
          properties: {
            color: {
              type: 'boolean',
              description: 'Print in color (adds $0.50)',
              default: false,
            },
            doubleSided: {
              type: 'boolean',
              description: 'Print double-sided',
              default: false,
            },
            mailClass: {
              type: 'string',
              description: 'Mail class: standard, first_class, priority',
              enum: ['standard', 'first_class', 'priority'],
              default: 'first_class',
            },
          },
        },
      },
      required: ['content', 'recipient'],
    },
  },
  {
    name: 'get_wallet_balance',
    description: 'Get the current SOL balance of the configured wallet. Requires wallet configuration.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_wallet_address',
    description: 'Get the public address of the configured wallet. Useful for receiving funds.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Handle tool list requests
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_mail_quote': {
        const country = (args?.country as string) || 'US';
        const color = (args?.color as boolean) || false;

        const basePrice = getMailPrice(country);
        const totalPrice = basePrice + (color ? 0.50 : 0);
        const solPrice = await getSolPrice();
        const solAmount = totalPrice / solPrice;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  priceUsd: totalPrice,
                  priceSol: solAmount,
                  solPrice: solPrice,
                  breakdown: {
                    basePrice,
                    colorPrinting: color ? 0.50 : 0,
                  },
                  country,
                  estimatedDelivery: country === 'US' ? '3-5 business days' : '7-14 business days',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_wallet_balance': {
        if (!wallet) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Wallet not configured. Set SOLANA_PRIVATE_KEY environment variable.',
                }),
              },
            ],
            isError: true,
          };
        }

        const balance = await connection.getBalance(wallet.publicKey);
        const balanceSol = balance / LAMPORTS_PER_SOL;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  address: wallet.publicKey.toBase58(),
                  balance: balanceSol,
                  balanceLamports: balance,
                  network: SOLANA_NETWORK,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_wallet_address': {
        if (!wallet) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Wallet not configured. Set SOLANA_PRIVATE_KEY environment variable.',
                }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  address: wallet.publicKey.toBase58(),
                  network: SOLANA_NETWORK,
                  hostedApi: 'https://solmail-api.up.railway.app',
                  message: 'Send SOL to this address to fund your mail-sending operations. Or use our hosted API with Stripe billing: https://solmail.online/pricing',
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case 'send_mail': {
        if (!wallet) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Wallet not configured. Set SOLANA_PRIVATE_KEY environment variable.',
                }),
              },
            ],
            isError: true,
          };
        }

        const content = args?.content as string;
        const recipient = args?.recipient as any;
        const mailOptions = (args?.mailOptions as any) || {};

        if (!content || !recipient) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Missing required fields: content and recipient',
                }),
              },
            ],
            isError: true,
          };
        }

        // Calculate price
        const country = recipient.country || 'US';
        const color = mailOptions.color || false;
        const basePrice = getMailPrice(country);
        const totalPrice = basePrice + (color ? 0.50 : 0);

        // Get SOL price and calculate amount needed
        const solPrice = await getSolPrice();
        const solAmount = totalPrice / solPrice;
        const lamports = Math.ceil(solAmount * LAMPORTS_PER_SOL);

        // Get merchant wallet from environment or use default
        const merchantWallet = process.env.MERCHANT_WALLET || 'B5daxcMG9LgcXkZwuxBhHtuYxzG9J4ekgz1wUiMXw3xp';
        const merchantPubkey = new PublicKey(merchantWallet);

        // Create payment transaction
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.publicKey,
            toPubkey: merchantPubkey,
            lamports,
          })
        );

        // Send transaction
        console.error('Sending payment transaction...');
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [wallet],
          { commitment: 'confirmed' }
        );

        console.error(`Payment confirmed: ${signature}`);

        // Submit to SolMail API
        const mailConfig = {
          mailType: 'letter',
          color: mailOptions.color || false,
          doubleSided: mailOptions.doubleSided || false,
          mailClass: mailOptions.mailClass || 'first_class',
        };

        const apiResponse = await fetch(`${SOLMAIL_API_URL}/send-letter`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature,
            address: recipient,
            content,
            contentType: 'text',
            priceUsd: totalPrice,
            mailConfig,
          }),
        });

        if (!apiResponse.ok) {
          const errorData = await apiResponse.json() as { error?: string };
          throw new Error(errorData.error || 'Failed to submit mail');
        }

        const result = await apiResponse.json() as {
          letterId: string;
          trackingNumber?: string;
          expectedDeliveryDate?: string;
          previewUrl?: string;
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  letterId: result.letterId,
                  trackingNumber: result.trackingNumber,
                  expectedDeliveryDate: result.expectedDeliveryDate,
                  previewUrl: result.previewUrl,
                  payment: {
                    signature,
                    amount: solAmount,
                    priceUsd: totalPrice,
                  },
                  recipient: recipient.name,
                  city: recipient.city,
                  country: country,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
            details: error instanceof Error ? error.stack : undefined,
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('Starting SolMail MCP Server...');

  // Initialize Solana connection
  connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  console.error(`Connected to Solana ${SOLANA_NETWORK}`);

  // Initialize wallet
  initializeWallet();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SolMail MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
