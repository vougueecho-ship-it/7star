import mongoose, { Schema, Document } from 'mongoose';

export interface IOAuthTicket extends Document {
  sid?: string;
  ticket?: string;
  status: 'pending' | 'ready';
  token?: string;
  user?: any;
  isNewUser?: boolean;
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
}

const OAuthTicketSchema = new Schema<IOAuthTicket>({
  sid: { type: String, index: true },
  ticket: { type: String, index: true },
  status: { type: String, enum: ['pending', 'ready'], default: 'pending' },
  token: { type: String },
  user: { type: Schema.Types.Mixed },
  isNewUser: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: '10m' } },
  completedAt: { type: Date }
});

export default mongoose.models.OAuthTicket || mongoose.model<IOAuthTicket>('OAuthTicket', OAuthTicketSchema);
