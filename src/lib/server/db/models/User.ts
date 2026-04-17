import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser {
  wcaUserID: number;
  wcaID: string;
  name: string;
  tokensUsed: number;
  tokenCap: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document { }

const UserSchema = new Schema<IUserDocument>(
  {
    wcaUserID: { type: Number, required: true, unique: true, index: true },
    wcaID: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    tokensUsed: { type: Number, default: 0 },
    tokenCap: { type: Number, default: Number(process.env.TOKEN_CAP) },
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
