import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProgressLog extends Document {
  userId?: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  currentPage: number;
  currentPercentage: number;
  progressDate: Date;
  notes?: string;
  pagesRead: number;
  createdAt: Date;
}

const ProgressLogSchema = new Schema<IProgressLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    currentPage: { type: Number, required: true, min: 0 },
    currentPercentage: { type: Number, required: true, min: 0, max: 100 },
    progressDate: { type: Date, required: true, default: Date.now },
    notes: { type: String },
    pagesRead: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

ProgressLogSchema.index({ bookId: 1, progressDate: -1 });
ProgressLogSchema.index({ userId: 1, progressDate: -1 });
ProgressLogSchema.index({ progressDate: -1 });

let ProgressLog: Model<IProgressLog>;

try {
  ProgressLog = mongoose.model<IProgressLog>("ProgressLog");
} catch {
  ProgressLog = mongoose.model<IProgressLog>("ProgressLog", ProgressLogSchema);
}

export default ProgressLog;
