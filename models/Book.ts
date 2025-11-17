import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBook extends Document {
  calibreId: number;
  title: string;
  authors: string[];
  isbn?: string;
  coverPath?: string;
  totalPages?: number;
  addedToLibrary: Date;
  lastSynced: Date;
  publisher?: string;
  pubDate?: Date;
  series?: string;
  seriesIndex?: number;
  tags: string[];
  path: string;
  orphaned?: boolean;
  orphanedAt?: Date;
}

const BookSchema = new Schema<IBook>(
  {
    calibreId: { type: Number, required: true, unique: true },
    title: { type: String, required: true },
    authors: [{ type: String }],
    isbn: { type: String },
    coverPath: { type: String },
    totalPages: { type: Number },
    addedToLibrary: { type: Date, default: Date.now },
    lastSynced: { type: Date, default: Date.now },
    publisher: { type: String },
    pubDate: { type: Date },
    series: { type: String },
    seriesIndex: { type: Number },
    tags: [{ type: String }],
    path: { type: String, required: true },
    orphaned: { type: Boolean, default: false },
    orphanedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

BookSchema.index({ title: "text", authors: "text" });
BookSchema.index({ orphaned: 1, orphanedAt: 1 });
// calibreId index is already created by unique: true

let Book: Model<IBook>;

try {
  Book = mongoose.model<IBook>("Book");
} catch {
  Book = mongoose.model<IBook>("Book", BookSchema);
}

export default Book;
