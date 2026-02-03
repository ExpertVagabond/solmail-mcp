# SolMail Demo Video Script

**Duration**: 3-4 minutes
**Format**: Screen recording with voiceover
**Goal**: Show AI agents sending real physical mail with Solana

---

## Opening (0:00 - 0:20)

**[Screen: SolMail logo/title card]**

**Voiceover:**
"What if AI agents could interact with the physical world? Not just trade tokens or execute smart contracts, but send actual physical mail to real addresses? Meet SolMail."

---

## The Problem (0:20 - 0:45)

**[Screen: Animation showing digital/physical divide]**

**Voiceover:**
"AI agents are becoming autonomous. They can manage portfolios, execute trades, and interact with APIs. But when they need to send a document, mail a gift, or deliver a notice, they're stuck. They need humans, credit cards, and approval at every step."

**[Screen: Traditional mail flow with friction points highlighted]**

---

## The Solution (0:45 - 1:15)

**[Screen: SolMail architecture diagram]**

**Voiceover:**
"SolMail solves this. It's a bridge between AI agents and the physical world, powered by Solana. Agents can send real letters, postcards, and documents to any address worldwide, paid for with SOL. No human approval. No credit cards. Completely autonomous."

**[Screen: Show the two components]**
- Web app at solmail.online
- MCP server for AI agents

---

## Live Demo: Web App (1:15 - 2:00)

**[Screen: solmail.online homepage]**

**Voiceover:**
"Let me show you how it works. First, the web app for human users."

**[Actions on screen:]**
1. Connect wallet (Phantom)
2. Write a letter: "Hello! This letter was sent using Solana cryptocurrency."
3. Enter recipient address
4. See price quote ($1.50, converted to SOL in real-time)
5. Click Pay with SOL
6. Sign transaction
7. Show confirmation with tracking number

**Voiceover:**
"Transaction confirmed in 400 milliseconds. The letter is now being printed and will be delivered in 3-5 business days. Real mail. Real delivery."

---

## Live Demo: AI Agent (2:00 - 3:00)

**[Screen: Claude Desktop with MCP server]**

**Voiceover:**
"But here's where it gets interesting. Watch an AI agent do this completely autonomously."

**[Screen: Show conversation with Claude]**

**User types:**
"Claude, send a thank you note to John Doe at 123 Main Street, San Francisco, CA 94102. Say thanks for being an early SolMail user."

**[Screen: Show Claude's response]**

**Claude:**
"I'll help you send that thank you note via SolMail!

[Uses get_mail_quote tool]
The cost will be $1.50 (approximately 0.015 SOL).

[Uses send_mail tool]
✓ Letter sent successfully!

Letter ID: ltr_abc123
Tracking: 9400000000000000000000
Payment: 0.015 SOL (signature: 5j7s...)
Expected delivery: February 7, 2026"

**Voiceover:**
"Notice what just happened. The AI agent:
- Checked the price quote
- Created the letter
- Signed a Solana transaction with its own wallet
- Submitted to the mail fulfillment API
- All without any human intervention"

---

## Technical Overview (3:00 - 3:30)

**[Screen: Code snippets and architecture]**

**Voiceover:**
"The technical stack is elegant:

On the blockchain side:
- Native SOL transfers via Solana SystemProgram
- On-chain verification before fulfillment
- 400ms finality, $0.00025 transaction fees

On the agent side:
- Model Context Protocol server
- Four tools: send_mail, get_mail_quote, get_wallet_balance, get_wallet_address
- Full TypeScript implementation

For fulfillment:
- Integration with Lob.com for printing and mailing
- Delivery to 200+ countries
- USPS tracking included"

---

## Use Cases (3:30 - 3:50)

**[Screen: Montage of use case examples]**

**Voiceover:**
"The possibilities are endless:
- AI customer service agents sending thank-you notes
- Smart contracts triggering legal notices
- NFT projects mailing physical items to holders
- DAOs conducting elections via mail
- Automated birthday and holiday cards
- Marketing campaigns personalized by AI"

---

## Call to Action (3:50 - 4:00)

**[Screen: GitHub repo, documentation, and hackathon info]**

**Voiceover:**
"SolMail is open source, built for the Colosseum Agent Hackathon, and ready to use today. Check out the code on GitHub, try it with your own AI agent, or visit solmail.online to send your first letter.

This is just the beginning. AI agents are coming online. Let's give them the tools to change the real world."

**[Screen: SolMail logo + "Built on Solana"]**

---

## B-Roll Suggestions

**Visual Elements to Include:**
1. Actual letters being printed (stock footage or Lob preview images)
2. Solana Explorer showing real transactions
3. Code editor showing the MCP server implementation
4. Claude Desktop interface in action
5. World map showing global delivery coverage
6. Transaction flow animation
7. GitHub stars/activity if available

**Graphics to Create:**
1. SolMail logo
2. Architecture diagram (AI ↔ MCP ↔ API ↔ Blockchain ↔ Mail)
3. Use case icons
4. Stats overlay (200+ countries, $0.00025 fees, 400ms finality)

---

## Key Talking Points

**Must convey:**
1. **Real** - This isn't a mockup or demo. Letters actually get delivered.
2. **Autonomous** - AI agents operate without human approval
3. **Solana-native** - Built specifically for Solana's strengths
4. **Production-ready** - Works today, not vaporware
5. **Agent-first** - Designed for AI agents, not an afterthought

**Differentiators:**
- Only solution letting agents send physical mail
- Truly autonomous (no human-in-the-loop)
- Native Solana integration (not multi-chain wrapper)
- Actually functional (not just a concept)

---

## Recording Tips

1. **Clear audio** - Invest in a decent microphone
2. **Smooth transitions** - Use fade effects between sections
3. **Show, don't just tell** - Actual screen recordings > slides
4. **Real data** - Use real transaction signatures, real tracking numbers
5. **Pace** - Speak clearly, not too fast
6. **Background music** - Subtle, upbeat, doesn't overwhelm voiceover
7. **Captions** - Add subtitles for accessibility

---

## Post-Production Checklist

- [ ] Color grade for consistency
- [ ] Audio levels balanced
- [ ] Background music mixed at -20dB
- [ ] Captions/subtitles added
- [ ] SolMail branding consistent
- [ ] GitHub/website URLs visible
- [ ] Export at 1080p minimum
- [ ] Upload to YouTube
- [ ] Add to hackathon submission

---

## Alternative: Quick Demo (60 seconds)

**For a shorter version:**

1. **0:00-0:10**: "AI agents sending real mail with Solana"
2. **0:10-0:25**: Show Claude conversation
3. **0:25-0:40**: Show transaction on Solana Explorer
4. **0:40-0:50**: Show letter preview from Lob
5. **0:50-1:00**: "Visit solmail.online | Built for Colosseum Hackathon"

---

**Good luck! Make it punchy, visual, and memorable.** 🎬📬
