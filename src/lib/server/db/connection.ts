import mongoose from "mongoose";

let cached = (global as any).__mongooseConnection as
  | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
  | undefined;

if (!cached) {
  cached = (global as any).__mongooseConnection = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached!.conn) return cached!.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }

  if (!cached!.promise) {
    cached!.promise = mongoose.connect(uri).then((m) => {
      console.log("[MongoDB] Connected successfully");
      return m;
    });
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}
