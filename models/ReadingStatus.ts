import mongoose, { Schema, Document, Model } from "mongoose";

export type StatusType = "to-read" | "read-next" | "reading" | "read";

export interface IReadingStatus extends Document {
  userId?: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  status: StatusType;
  startedDate?: Date;
  completedDate?: Date;
  rating?: number;
  review?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReadingStatusSchema = new Schema<IReadingStatus>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    status: {
      type: String,
      enum: ["to-read", "read-next", "reading", "read"],
      required: true,
      default: "to-read",
    },
    startedDate: { type: Date },
    completedDate: { type: Date },
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
  },
  {
    timestamps: true,
  }
);

ReadingStatusSchema.index({ bookId: 1 });
ReadingStatusSchema.index({ status: 1 });
ReadingStatusSchema.index({ userId: 1, bookId: 1 }, { unique: true });

let ReadingStatus: Model<IReadingStatus>;

try {
  ReadingStatus = mongoose.model<IReadingStatus>("ReadingStatus");
} catch {
  ReadingStatus = mongoose.model<IReadingStatus>(
    "ReadingStatus",
    ReadingStatusSchema
  );
}

export default ReadingStatus;
