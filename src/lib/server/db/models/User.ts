import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser {
  wcaUserID: number;
  wcaID: string;
  name: string;
  requestsUsedToday: number;
  lastRequestDate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const UserSchema = new Schema<IUserDocument>(
  {
    wcaUserID: { type: Number, required: true, unique: true, index: true },
    wcaID: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    requestsUsedToday: { type: Number, default: 0 },
    lastRequestDate: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);
