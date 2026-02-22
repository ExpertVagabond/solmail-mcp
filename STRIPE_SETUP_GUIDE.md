# Stripe Setup Guide for SolMail MCP Monetization

## Quick Setup (15 minutes)

### Step 1: Create Stripe Account
1. Go to https://stripe.com
2. Click "Start now" and sign up
3. Complete business verification (use your name/info)
4. Enable "Test mode" toggle (top right)

### Step 2: Create Products & Prices

#### Pro Tier - $14.99/month
1. Go to **Products** → **Add product**
2. Name: "SolMail MCP Pro"
3. Description: "100 letters per month with priority support"
4. Price: $14.99
5. Billing period: Monthly, recurring
6. **Copy the Price ID** (starts with `price_`)

#### Enterprise Tier - $99/month
1. **Products** → **Add product**
2. Name: "SolMail MCP Enterprise"
3. Description: "Unlimited letters with custom branding"
4. Price: $99
5. Billing period: Monthly, recurring
6. **Copy the Price ID**

### Step 3: Get API Keys

1. Go to **Developers** → **API keys**
2. Copy **Publishable key** (starts with `pk_test_`)
3. Click "Reveal test key" and copy **Secret key** (starts with `sk_test_`)

### Step 4: Configure Environment Variables

Create `.env` file in your solmail-mcp directory:

\`\`\`bash
# Stripe Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE

# Price IDs from Step 2
STRIPE_PRO_PRICE_ID=price_YOUR_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID=price_YOUR_ENTERPRISE_PRICE_ID

# Your app URLs
STRIPE_SUCCESS_URL=https://solmail.online/success
STRIPE_CANCEL_URL=https://solmail.online/pricing
\`\`\`

### Step 5: Test the Integration

\`\`\`bash
# Install dependencies (already done)
cd ~/solmail-mcp
npm install

# Test Stripe integration
node test-stripe.js
\`\`\`

### Step 6: Go Live

When ready for production:
1. Complete Stripe business verification
2. Toggle "Test mode" OFF (top right)
3. Get **Live API keys** from Developers → API keys
4. Update `.env` with live keys (sk_live_ and pk_live_)
5. Deploy pricing page with live keys

---

## Price Recommendations

Based on MCP server market analysis:

### Conservative (Start Here)
- **Free**: 5 letters/month
- **Pro**: $9.99/month (100 letters)
- **Enterprise**: $49/month (unlimited)

### Recommended (Best Value)
- **Free**: 5 letters/month
- **Pro**: $14.99/month (100 letters)
- **Enterprise**: $99/month (unlimited + branding)

### Premium (High-Value Users)
- **Free**: 3 letters/month
- **Pro**: $19.99/month (50 letters)
- **Business**: $49/month (200 letters)
- **Enterprise**: $149/month (unlimited)

---

## Revenue Calculator

**Conservative** (10% conversion, 1000 users):
- 900 free users = $0
- 80 pro users × $15 = $1,200/mo
- 20 enterprise × $99 = $1,980/mo
- **Total: $3,180/month ($38,160/year)**

**Optimistic** (20% conversion, 5000 users):
- 4000 free users = $0
- 800 pro × $15 = $12,000/mo
- 200 enterprise × $99 = $19,800/mo
- **Total: $31,800/month ($381,600/year)**

---

## Webhook Setup (Important!)

Stripe sends webhooks when subscriptions change:

1. Go to **Developers** → **Webhooks**
2. Add endpoint: `https://solmail.online/api/stripe/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy **Signing secret** (starts with `whsec_`)
5. Add to `.env`:
   \`\`\`
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
   \`\`\`

---

## Customer Portal

Enable customers to manage their subscriptions:

1. Go to **Settings** → **Customer portal**
2. Click "Activate test link"
3. Enable:
   - Cancel subscription
   - Update payment method
   - View invoices
4. Save settings

---

## Testing Checklist

- [ ] Created Stripe account
- [ ] Created Pro product ($14.99/mo)
- [ ] Created Enterprise product ($99/mo)
- [ ] Got test API keys
- [ ] Added keys to `.env`
- [ ] Tested checkout flow
- [ ] Set up webhooks
- [ ] Activated customer portal
- [ ] Ready to go live!

---

## Test Credit Cards

Stripe provides test cards:
- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **3D Secure**: 4000 0025 0000 3155
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC

---

## Support

- Stripe Docs: https://stripe.com/docs
- Dashboard: https://dashboard.stripe.com
- Support: support@stripe.com

**Questions?** Contact: hello@solmail.online
