import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMessage {
  conversationId: Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  tokensUsed: number;
  createdAt: Date;
}

export interface IMessageDocument extends IMessage, Document {}

const MessageSchema = new Schema<IMessageDocument>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    tokensUsed: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const Message: Model<IMessageDocument> =
  mongoose.models.Message || mongoose.model<IMessageDocument>("Message", MessageSchema);
