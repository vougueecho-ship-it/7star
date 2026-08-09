import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDeposit extends Document {
  depositRef: string;
  userId: mongoose.Types.ObjectId;
  username: string;
  phone: string;
  amount: number;
  gateway: string;
  tid: string;
  screenshot?: string | null;
  status: string;
  createdAt: Date;
}

const DepositSchema: Schema = new Schema({
  depositRef: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  phone: { type: String, default: '' },
  amount: { type: Number, required: true },
  gateway: { type: String, required: true },
  tid: { type: String, required: true },
  screenshot: { type: String, default: null },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const Deposit: Model<IDeposit> = mongoose.models.Deposit || mongoose.model<IDeposit>('Deposit', DepositSchema);

export default Deposit;
