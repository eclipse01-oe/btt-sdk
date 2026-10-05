import mongoose from "mongoose";
const activitySchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["post", "reply"],
        required: true,
        index: true,
    },
    title: {
        type: String,
        trim: true,
    },
    link: {
        type: String,
        trim: true,
    },
    board: {
        name: {
            type: String,
            trim: true,
        },
        url: {
            type: String,
            trim: true,
        },
    },
    rawEventAt: {
        type: String,
        trim: true,
    },
    eventAt: {
        type: Date,
        required: true,
        index: true,
    },
    jobId: {
        type: String,
        trim: true,
        index: true,
    },
}, {
    timestamps: true,
});
activitySchema.index({
    username: 1,
    type: 1,
}, {
    unique: true,
});
export const UserActivity = mongoose.model("UserActivity", activitySchema);
