import mongoose, { Schema, Document, Model } from "mongoose";

export interface IStreak extends Document {
  userId?: mongoose.Types.ObjectId;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  streakStartDate: Date;
  totalDaysActive: number;
  updatedAt: Date;
}

const StreakSchema = new Schema<IStreak>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", unique: true },
    currentStreak: { type: Number, default: 0, min: 0 },
    longestStreak: { type: Number, default: 0, min: 0 },
    lastActivityDate: { type: Date, required: true, default: Date.now },
    streakStartDate: { type: Date, required: true, default: Date.now },
    totalDaysActive: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// No need for explicit index - unique: true already creates an index

let Streak: Model<IStreak>;

try {
  Streak = mongoose.model<IStreak>("Streak");
} catch {
  Streak = mongoose.model<IStreak>("Streak", StreakSchema);
}

export default Streak;
