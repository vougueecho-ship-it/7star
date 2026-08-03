import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IWithdrawal extends Document {
  withdrawalRef: string;
  userId: mongoose.Types.ObjectId;
  username: string;
  phone: string;
  amount: number;
  gateway: string;
  accountTitle: string;
  accountNumber: string;
  bankName?: string | null;
  status: string;
  createdAt: Date;
}

const WithdrawalSchema: Schema = new Schema({
  withdrawalRef: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  gateway: { type: String, required: true },
  accountTitle: { type: String, required: true },
  accountNumber: { type: String, required: true },
  bankName: { type: String, default: null },
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});

const Withdrawal: Model<IWithdrawal> = mongoose.models.Withdrawal || mongoose.model<IWithdrawal>('Withdrawal', WithdrawalSchema);

export default Withdrawal;
