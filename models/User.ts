import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  username: string;
  phone: string;
  passwordHash: string;
  balance: number;
  totalDeposit: number;
  totalWithdraw: number;
  totalProfit: number;
  referralCode: string;
  referredBy?: string | null;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  phone: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  balance: { type: Number, default: 0 },
  totalDeposit: { type: Number, default: 0 },
  totalWithdraw: { type: Number, default: 0 },
  totalProfit: { type: Number, default: 0 },
  referralCode: { type: String, required: true, unique: true },
  referredBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
