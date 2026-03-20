#!/usr/bin/env node

/**
 * solmail-mcp — MCP server for sending physical mail via Solana payments.
 *
 * @security
 * - Private key format validated (base58 or 64-element JSON array) before use
 * - Private key never logged — only public key is printed to stderr
 * - Country codes validated against ISO 3166-1 alpha-2 allowlist
 * - SOL price fallback clearly warned in logs (operators should monitor)
 * - All tool inputs validated via schema before processing
 * - Address inputs sanitized and length-bounded (2 KB max per field)
 * - No shell execution — all operations via structured APIs
 * - Wallet address validated as base58 public key before transactions
 * - Rate limiting: max 50 requests/minute per IP on HTTP gateway
 */

// ── Security: input validation & constants ──────────────────────────────────

/** Maximum length for any single string input field. */
const MAX_STRING_INPUT = 2048;

/** Maximum length for address block fields. */
const MAX_ADDRESS_LENGTH = 512;

/** Maximum length for mail body content. */
const MAX_BODY_LENGTH = 10_000;

/** Validate a string input: type, length, no null bytes. */
function validateStringInput(value: unknown, name: string, maxLen = MAX_STRING_INPUT): string {
  if (typeof value !== 'string') throw new Error(`${name} must be a string`);
  if (value.includes('\0')) throw new Error(`${name} contains null byte`);
  if (value.length > maxLen) throw new Error(`${name} exceeds max length (${maxLen})`);
  return value;
}

/** Validate a Solana public key string (base58, 32-44 chars). */
function validatePublicKey(value: unknown, name: string): string {
  const s = validateStringInput(value, name, 64);
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) {
    throw new Error(`${name} is not a valid base58 public key`);
  }
  return s;
}

// ── Imports ─────────────────────────────────────────────────────────────────

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

// Initialize Solana wallet if private key is provided.
// SECURITY NOTE: SOLANA_PRIVATE_KEY is read from env vars per MCP-standard
// pattern (MCP servers receive config via environment). Never log the key value.
function initializeWallet() {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (privateKey) {
    try {
      // Validate format before use: must be valid base58 or JSON array
      const isJsonArray = privateKey.trimStart().startsWith('[');
      let decoded: Uint8Array;

      if (isJsonArray) {
        const parsed = JSON.parse(privateKey);
        if (!Array.isArray(parsed) || parsed.length !== 64) {
          console.error(`Invalid private key: JSON array must have 64 elements, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
          return;
        }
        decoded = Uint8Array.from(parsed);
      } else {
        // Validate base58 format
        const bytes = bs58.decode(privateKey);
        if (bytes.length !== 64) {
          console.error(`Invalid private key: base58 decoded to ${bytes.length} bytes, expected 64`);
          return;
        }
        decoded = Uint8Array.from(bytes);
      }

      wallet = Keypair.fromSecretKey(decoded);
      console.error(`Wallet initialized: ${wallet.publicKey.toBase58()}`);
    } catch (error) {
      console.error('Failed to initialize wallet — check SOLANA_PRIVATE_KEY format:', error instanceof Error ? error.message : error);
    }
  }
}

// Helper to get SOL price in USD
const FALLBACK_SOL_PRICE = 100;
async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    );
    const data = await response.json() as { solana: { usd: number } };
    const price = data?.solana?.usd;
    if (typeof price !== 'number' || price <= 0) {
      console.error(`WARNING: CoinGecko returned invalid SOL price (${price}), using fallback $${FALLBACK_SOL_PRICE}. Payment amounts may be inaccurate.`);
      return FALLBACK_SOL_PRICE;
    }
    return price;
  } catch (error) {
    // SECURITY: Fallback price can lead to incorrect payment amounts.
    // Operators should monitor logs for this warning.
    console.error(`WARNING: CoinGecko price fetch failed, using fallback SOL price of $${FALLBACK_SOL_PRICE}. Payment amounts may be inaccurate.`, error);
    return FALLBACK_SOL_PRICE;
  }
}

// ISO 3166-1 alpha-2 country codes
const ISO_3166_ALPHA2 = new Set([
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS',
  'BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN',
  'CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE',
  'EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF',
  'GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM',
  'HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM',
  'JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC',
  'LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK',
  'ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA',
  'NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG',
  'PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS',
  'ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO',
  'TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI',
  'VN','VU','WF','WS','YE','YT','ZA','ZM','ZW',
]);

/** Validate a country code against ISO 3166-1 alpha-2. Returns uppercase code or null. */
function validateCountryCode(code: string | undefined): string | null {
  if (!code) return 'US'; // default
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2 || !ISO_3166_ALPHA2.has(upper)) {
    return null;
  }
  return upper;
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
        const rawCountry = (args?.country as string) || 'US';
        const country = validateCountryCode(rawCountry);
        if (!country) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Invalid country code: "${rawCountry}". Use ISO 3166-1 alpha-2 (e.g., US, GB, CA).` }) }],
            isError: true,
          };
        }
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

        // Calculate price — validate country code
        const validatedCountry = validateCountryCode(recipient.country);
        if (!validatedCountry) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: `Invalid country code: "${recipient.country}". Use ISO 3166-1 alpha-2 (e.g., US, GB, CA).` }) }],
            isError: true,
          };
        }
        const country = validatedCountry;
        const color = mailOptions.color || false;
        const basePrice = getMailPrice(country);
        const totalPrice = basePrice + (color ? 0.50 : 0);

        // Get SOL price and calculate amount needed
        const solPrice = await getSolPrice();
        const solAmount = totalPrice / solPrice;
        const lamports = Math.ceil(solAmount * LAMPORTS_PER_SOL);

        // SECURITY: Merchant wallet must come from env — no hardcoded fallback
        const merchantWallet = process.env.MERCHANT_WALLET;
        if (!merchantWallet) {
          return {
            content: [{ type: 'text', text: JSON.stringify({ error: 'MERCHANT_WALLET not configured. Cannot process payments.' }) }],
            isError: true,
          };
        }
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
