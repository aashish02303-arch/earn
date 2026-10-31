// All earning rules live here. Change a number, restart, and the whole app (including the homepage) follows.
// Money is stored in micro-rupees: ₹1 = 1,000,000. Balances are kept in rupees.
const inrPer1000Steps = 93;      // 1,000 steps = $1 = ₹93   (CHANGE ME)

export default {
  usdInr: 93,                                 // fixed rate: $1 = ₹93 (used to show dollars and to pay PayPal / crypto)
  inrPer1000Steps,
  microPerStep: inrPer1000Steps * 1000,       // micro-rupees earned per step
  dailyStepCap: 10000,                        // max steps that earn per day (CHANGE ME: see the note in the chat)
  referralMicro: 46.5e6,                      // ₹46.50 (= $0.50) per successful referral
  referralSteps: 1000,                        // friend must reach this many steps
  minWithdrawMicro: 100e6,                    // ₹100 minimum withdrawal
  maxStepsPerSec: 3,                          // anti-cheat: real walking/running is below this
  maxCreditSeconds: 300,                      // anti-cheat: one sync can credit at most this many seconds of walking
  methods: ['upi', 'paypal', 'crypto'],       // payout methods that work today
  comingSoon: ['amazon', 'flipkart'],         // shown on the site, but not available yet
  cryptoAssets: ['USDT', 'USDC', 'SOL'],      // all sent on the Solana network
  cryptoNetwork: 'Solana'
};