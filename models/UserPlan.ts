import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUserPlan extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  planName: string;
  investment: number;
  dailyProfit: number;
  totalProfit: number;
  validityDays: number;
  claimsCount: number;
  lastClaim: Date;
  status: string;
  createdAt: Date;
}

const UserPlanSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
  planName: { type: String, required: true },
  investment: { type: Number, required: true },
  dailyProfit: { type: Number, required: true },
  totalProfit: { type: Number, required: true },
  validityDays: { type: Number, default: 12 },
  claimsCount: { type: Number, default: 0 },
  lastClaim: { type: Date, default: Date.now },
  status: { type: String, default: 'Active' },
  createdAt: { type: Date, default: Date.now }
});

UserPlanSchema.index({ userId: 1, status: 1 });
UserPlanSchema.index({ userId: 1 });

const UserPlan: Model<IUserPlan> = mongoose.models.UserPlan || mongoose.model<IUserPlan>('UserPlan', UserPlanSchema);

export default UserPlan;
