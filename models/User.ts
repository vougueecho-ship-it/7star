import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  googleId?: string;
  avatar?: string;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalProfit: number;
  referralCode: string;
  referredBy?: string | null;
  hasCreditedReferralBonus?: boolean;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, unique: true, sparse: true },
  phone: { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: false },
  googleId: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: null },
  balance: { type: Number, default: 0 },
  totalDeposit: { type: Number, default: 0 },
  totalWithdraw: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: String, default: null },
  hasCreditedReferralBonus: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
