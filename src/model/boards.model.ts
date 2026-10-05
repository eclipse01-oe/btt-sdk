import mongoose from "mongoose";
const boardSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, index: true },
    url: { type: String, required: true },
    cat: { type: String, enum: ["main", "child"], required: true },
    postId: { type: String, required: true, index: true },
    post: { type: String, default: null },
    poster: { type: String, default: null },
    posterLink: { type: String, default: null },
    rawDateTime: { type: String, default: null },
    eventAt: { type: Date, default: null, index: true },
}, { timestamps: true });
export const Board = mongoose.model("Board", boardSchema);
