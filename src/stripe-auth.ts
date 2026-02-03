// Stripe authentication and subscription management for SolMail MCP
import Stripe from 'stripe';

// Initialize Stripe (use env variable in production)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

// Tier limits
export interface TierLimits {
  monthlyLetters: number; // -1 = unlimited
  priority: boolean;
  customBranding: boolean;
}

export const TIERS: Record<string, TierLimits> = {
  free: {
    monthlyLetters: 5,
    priority: false,
    customBranding: false,
  },
  pro: {
    monthlyLetters: 100,
    priority: true,
    customBranding: false,
  },
  enterprise: {
    monthlyLetters: -1, // unlimited
    priority: true,
    customBranding: true,
  },
};

// Pricing (monthly)
export const PRICING = {
  pro: 1499, // $14.99/month
  enterprise: 9999, // $99.99/month
};

/**
 * Validate API key and check subscription status
 * @param apiKey - User's API key (format: sk_live_... or sk_test_...)
 * @returns Tier name and limits, or null if invalid
 */
export async function validateApiKey(
  apiKey: string
): Promise<{ tier: string; limits: TierLimits; customerId: string } | null> {
  try {
    // If no API key, return free tier
    if (!apiKey || apiKey === 'free') {
      return {
        tier: 'free',
        limits: TIERS.free,
        customerId: 'free',
      };
    }

    // Validate format
    if (!apiKey.startsWith('skey_')) {
      return null;
    }

    // Extract customer ID from API key (our custom format: skey_{customerId}_{hash})
    const parts = apiKey.split('_');
    if (parts.length < 3) {
      return null;
    }
    const customerId = parts[1];

    // Check Stripe subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return null; // No active subscription
    }

    const sub = subscriptions.data[0];
    const priceId = sub.items.data[0]?.price.id;

    // Determine tier based on price ID
    let tier = 'pro';
    if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
      tier = 'enterprise';
    }

    return {
      tier,
      limits: TIERS[tier],
      customerId,
    };
  } catch (error) {
    console.error('API key validation failed:', error);
    return null;
  }
}

/**
 * Track usage for a customer
 * @param customerId - Stripe customer ID
 * @param lettersSent - Number of letters sent this month
 */
export async function trackUsage(
  customerId: string,
  lettersSent: number
): Promise<void> {
  try {
    // Store usage in Stripe metadata or use metering
    await stripe.customers.update(customerId, {
      metadata: {
        letters_sent_this_month: lettersSent.toString(),
        last_updated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Usage tracking failed:', error);
  }
}

/**
 * Get current usage for a customer
 * @param customerId - Stripe customer ID
 * @returns Number of letters sent this month
 */
export async function getUsage(customerId: string): Promise<number> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return 0;
    }
    const usage = customer.metadata?.letters_sent_this_month || '0';
    return parseInt(usage, 10);
  } catch (error) {
    console.error('Failed to get usage:', error);
    return 0;
  }
}

/**
 * Check if user has exceeded their monthly limit
 * @param customerId - Stripe customer ID
 * @param limits - Tier limits
 * @returns True if within limits
 */
export async function checkUsageLimit(
  customerId: string,
  limits: TierLimits
): Promise<boolean> {
  if (limits.monthlyLetters === -1) {
    return true; // Unlimited
  }

  const currentUsage = await getUsage(customerId);
  return currentUsage < limits.monthlyLetters;
}

/**
 * Create a Stripe checkout session for subscription
 * @param priceId - Stripe price ID
 * @param customerEmail - Customer email
 * @param successUrl - URL to redirect on success
 * @param cancelUrl - URL to redirect on cancel
 * @returns Checkout session URL
 */
export async function createCheckoutSession(
  priceId: string,
  customerEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    customer_email: customerEmail,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      product: 'solmail-mcp',
    },
  });

  return session.url || '';
}

/**
 * Create customer portal session for managing subscription
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after managing subscription
 * @returns Portal session URL
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}
