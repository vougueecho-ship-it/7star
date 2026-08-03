import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPlan extends Document {
  name: string;
  price: number;
  dailyProfit: number;
  totalProfit: number;
  validityDays: number;
  level1Bonus: number;
  level2Bonus: number;
  active: boolean;
}

const PlanSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  dailyProfit: { type: Number, required: true },
  totalProfit: { type: Number, required: true },
  validityDays: { type: Number, default: 40 },
  level1Bonus: { type: Number, required: true },
  level2Bonus: { type: Number, required: true },
  active: { type: Boolean, default: true }
});

const Plan: Model<IPlan> = mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);

export default Plan;
