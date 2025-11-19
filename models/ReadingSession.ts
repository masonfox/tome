import mongoose, { Schema, Document, Model } from "mongoose";

export type StatusType = "to-read" | "read-next" | "reading" | "read";

export interface IReadingSession extends Document {
  userId?: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  sessionNumber: number; // 1, 2, 3, etc. - which read-through this is
  status: StatusType;
  startedDate?: Date;
  completedDate?: Date;
  review?: string;
  isActive: boolean; // Only one active session per book
  createdAt: Date;
  updatedAt: Date;
}

const ReadingSessionSchema = new Schema<IReadingSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    sessionNumber: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["to-read", "read-next", "reading", "read"],
      required: true,
      default: "to-read",
    },
    startedDate: { type: Date },
    completedDate: { type: Date },
    review: { type: String },
    isActive: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReadingSessionSchema.index({ bookId: 1, sessionNumber: 1 }, { unique: true });
ReadingSessionSchema.index({ userId: 1, bookId: 1 });
ReadingSessionSchema.index({ status: 1 });
// Partial unique index: only one active session per book
// Note: MongoDB allows multiple docs with isActive=false, but only one with isActive=true per bookId
ReadingSessionSchema.index(
  { bookId: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

let ReadingSession: Model<IReadingSession>;

try {
  ReadingSession = mongoose.model<IReadingSession>("ReadingSession");
} catch {
  ReadingSession = mongoose.model<IReadingSession>(
    "ReadingSession",
    ReadingSessionSchema
  );
}

export default ReadingSession;
