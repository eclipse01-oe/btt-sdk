import mongoose from "mongoose";
const meritSchema = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["sent", "received"],
        required: true,
        index: true,
    },
    meritAmount: {
        type: Number,
        default: 0,
    },
    user: {
        name: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
    },
    post: {
        name: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
    },
    rawFullText: {
        type: String,
        trim: true,
    },
    eventAt: {
        type: Date,
        required: true,
        index: true,
    },
    rawEventAt: {
        type: String,
        trim: true,
    },
    jobId: {
        type: String,
        trim: true,
        index: true,
    },
}, {
    timestamps: true,
});
meritSchema.index({
    username: 1,
    type: 1,
}, {
    unique: true,
});
export const MeritData = mongoose.model("MeritData", meritSchema);
