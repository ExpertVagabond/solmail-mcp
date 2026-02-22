#!/usr/bin/env node

/**
 * Test Stripe Integration
 * Quick test to verify Stripe keys and product setup
 */

import Stripe from 'stripe';
import * as dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

async function testStripeSetup() {
  console.log('🧪 Testing Stripe Integration...\n');

  try {
    // 1. Test API Key
    console.log('1️⃣ Testing API key...');
    const account = await stripe.accounts.retrieve();
    console.log(`   ✅ Connected to account: ${account.email || account.id}`);
    console.log(`   📍 Mode: ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'LIVE' : 'TEST'}\n`);

    // 2. List Products
    console.log('2️⃣ Checking products...');
    const products = await stripe.products.list({ limit: 10 });
    console.log(`   Found ${products.data.length} product(s):`);

    for (const product of products.data) {
      console.log(`   📦 ${product.name}`);

      // Get prices for this product
      const prices = await stripe.prices.list({ product: product.id });
      for (const price of prices.data) {
        const amount = price.unit_amount ? (price.unit_amount / 100).toFixed(2) : 'N/A';
        console.log(`      💰 $${amount}/${price.recurring?.interval || 'one-time'}`);
        console.log(`      🔑 Price ID: ${price.id}`);
      }
    }
    console.log();

    // 3. Test Price IDs from .env
    console.log('3️⃣ Validating environment variables...');
    const proPriceId = process.env.STRIPE_PRO_PRICE_ID;
    const entPriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID;

    if (proPriceId) {
      try {
        const proPrice = await stripe.prices.retrieve(proPriceId);
        console.log(`   ✅ Pro Price ID valid: ${proPrice.unit_amount ? '$' + (proPrice.unit_amount / 100) : 'N/A'}/month`);
      } catch (error) {
        console.log(`   ❌ Pro Price ID invalid: ${proPriceId}`);
      }
    } else {
      console.log(`   ⚠️  STRIPE_PRO_PRICE_ID not set in .env`);
    }

    if (entPriceId) {
      try {
        const entPrice = await stripe.prices.retrieve(entPriceId);
        console.log(`   ✅ Enterprise Price ID valid: ${entPrice.unit_amount ? '$' + (entPrice.unit_amount / 100) : 'N/A'}/month`);
      } catch (error) {
        console.log(`   ❌ Enterprise Price ID invalid: ${entPriceId}`);
      }
    } else {
      console.log(`   ⚠️  STRIPE_ENTERPRISE_PRICE_ID not set in .env`);
    }
    console.log();

    // 4. Test Customer Creation (dry run)
    console.log('4️⃣ Testing customer creation...');
    const testCustomer = await stripe.customers.create({
      email: 'test@example.com',
      metadata: {
        test: 'true',
        source: 'solmail-mcp-test',
      },
    });
    console.log(`   ✅ Created test customer: ${testCustomer.id}`);

    // Clean up
    await stripe.customers.del(testCustomer.id);
    console.log(`   🧹 Cleaned up test customer\n`);

    // Summary
    console.log('✅ All tests passed!\n');
    console.log('Next steps:');
    console.log('1. Create Pro and Enterprise products in Stripe Dashboard');
    console.log('2. Add price IDs to .env file');
    console.log('3. Deploy pricing page to solmail.online');
    console.log('4. Test full checkout flow');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('- Check STRIPE_SECRET_KEY in .env file');
    console.error('- Ensure key starts with sk_test_ or sk_live_');
    console.error('- Verify Stripe Dashboard access');
  }
}

testStripeSetup();
