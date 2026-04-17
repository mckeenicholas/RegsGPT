import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IConversation {
  userId: Types.ObjectId;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationDocument extends IConversation, Document {}

const ConversationSchema = new Schema<IConversationDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: { type: String, default: "New Chat" },
  },
  {
    timestamps: true,
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

export const Conversation: Model<IConversationDocument> =
  mongoose.models.Conversation ||
  mongoose.model<IConversationDocument>("Conversation", ConversationSchema);
