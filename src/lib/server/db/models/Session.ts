import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISession {
  token: string;
  userId: Types.ObjectId;
  wcaToken: string;
  wcaRefreshToken: string;
  wcaTokenExpiresAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

export interface ISessionDocument extends ISession, Document {}

const SessionSchema = new Schema<ISessionDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    wcaToken: { type: String, required: true },
    wcaRefreshToken: { type: String, required: true },
    wcaTokenExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }, // TTL index — MongoDB auto-deletes expired docs
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const Session: Model<ISessionDocument> =
  mongoose.models.Session || mongoose.model<ISessionDocument>("Session", SessionSchema);
