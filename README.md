# TaskNest (MERN)

MongoDB + Express + React (Vite) + Node. One project, hosted on Vercel.

```
api/index.js        Vercel backend entry (loads server/app.js)
server/config.js    EARNING RULES: step rate, daily cap, referral reward, INR rate, minimum payout
server/app.js       All API routes (signup, login, steps, referrals, withdrawals, admin)
server/models.js    MongoDB collections
src/pages/          React pages: Landing, Auth, Dashboard, Walk, Payout, Admin
src/*.css           Your original designs (landing.css, auth.css, app.css)
src/pages/Landing.jsx   Homepage (numbers come from config.js)
```

## 1. Database (free)
1. Create a free cluster at mongodb.com/atlas (M0).
2. Database Access: add a user with a password.
3. Network Access: add `0.0.0.0/0` (Vercel uses changing addresses).
4. Connect > Drivers: copy the connection string.

## 2. Run on your computer
```
npm install
cp .env.example .env      # then fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL
npm run dev
```
Open http://localhost:5173. (Step counting needs HTTPS and a phone, so test it after deploying.)

## 3. Deploy on Vercel (free)
1. Push this folder to GitHub.
2. vercel.com > Add New Project > import the repo (framework: Vite, nothing else to set).
3. Add the 3 environment variables from `.env.example`.
4. Deploy. Open the HTTPS link on your phone and tap Walk > Start.

## Paying users
Sign up with the email you put in `ADMIN_EMAIL`. An **Admin** tab appears. Send the money yourself (UPI, PayPal, crypto, gift code) and press **Mark paid**. **Reject** returns the money to the user.

## Changing things later
- Step rate, daily cap, referral reward, INR rate, minimum payout: `server/config.js`.
- Text on the landing page: `src/pages/Landing.jsx` (homepage text) and `src/landing.css`.
- Colours and layout: the `.css` files. Code changes do not touch the design.
- New features (quiz, games): add a route in `server/app.js` and a page in `src/pages/`, then one `<Route>` in `src/main.jsx`. Reuse `Tx` and `User.balanceMicro` to pay rewards.
- A mobile app or any other front end can use the same `/api` routes.

## Payout and step-counting notes
- `src/pages/Payout.jsx` + `src/payout.css`: method tiles with logos, validation, confirm sheet, processing screen, receipt, transaction list with reference IDs.
- `src/pages/Logos.jsx`: simple SVG badges. Replace with the official brand files before launch (PayPal, UPI, Tether, Amazon, Flipkart brand kits).
- `src/pages/Walk.jsx`: the step counter and the live signal graph. The counting rules are in `onMotion` (threshold, 300 ms gap, steady-rhythm check).
- `server/app.js` `/api/steps/sync`: server-side limit (steps per second, daily cap).

## Commands
- `npm run dev`: starts everything (API + website) in one terminal.
- `npm run server`: starts only the API (http://localhost:5000).
- `npm run client`: starts only the website (http://localhost:5173).

## Money units (important)
Balances are stored in **micro-rupees** (₹1 = 1,000,000). The earning rate, referral reward and minimum payout are all in `server/config.js`.
If you tested with an older version, the old test balances were in micro-dollars and will look wrong. In MongoDB Atlas open **Browse Collections**, then delete the `users`, `steps`, `txes` and `withdrawals` collections before real use.