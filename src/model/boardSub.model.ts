import mongoose from "mongoose";
const boardSubscriptionSchema = new mongoose.Schema({
    board: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    username: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    jobId: { type: String, required: true, index: true },
}, {
    timestamps: true,
});
boardSubscriptionSchema.index({
    board: 1,
    username: 1,
}, {
    unique: true,
});
export const BoardSubscription = mongoose.model("BoardSubscription", boardSubscriptionSchema);
