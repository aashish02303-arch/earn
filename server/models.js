import mongoose from 'mongoose';
const { Schema, model, models } = mongoose;
const Id = Schema.Types.ObjectId;

export const User = models.User || model('User', new Schema({
  name: String,
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  referralCode: { type: String, unique: true },
  referredBy: { type: Id, ref: 'User' },
  referralPaid: { type: Boolean, default: false },
  balanceMicro: { type: Number, default: 0, min: 0 },
  totalSteps: { type: Number, default: 0 },
  lastSyncAt: Date,
  isAdmin: { type: Boolean, default: false },
  banned: { type: Boolean, default: false },
  bannedReason: String
}, { timestamps: true }));

const stepsSchema = new Schema({ userId: { type: Id, required: true }, day: String, steps: { type: Number, default: 0 } });
stepsSchema.index({ userId: 1, day: 1 }, { unique: true });
export const Steps = models.Steps || model('Steps', stepsSchema);

export const Tx = models.Tx || model('Tx', new Schema({
  userId: { type: Id, index: true }, kind: String, amountMicro: Number, note: String
}, { timestamps: true }));

export const Withdrawal = models.Withdrawal || model('Withdrawal', new Schema({
  userId: { type: Id, ref: 'User', index: true },
  method: { type: String, enum: ['upi', 'paypal', 'crypto', 'amazon', 'flipkart'] },
  ref: { type: String, index: true },        // public transaction ID, e.g. TN-9F3A21BC
  network: String,                           // crypto only: Solana
  asset: String,                             // crypto only: USDT / USDC / SOL
  details: String,
  amountMicro: Number,
  status: { type: String, enum: ['pending', 'paid', 'rejected'], default: 'pending' },
  adminNote: String
}, { timestamps: true }));