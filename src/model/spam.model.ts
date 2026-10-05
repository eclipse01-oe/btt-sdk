import mongoose from "mongoose";
const boardSpamSchema = new mongoose.Schema({
    board: {
        type: String,
        required: true,
        index: true,
    },
    postId: {
        type: String,
        required: true,
        index: true,
    },
    activity: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    targetText: {
        type: String,
        required: true,
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    spamScore: {
        type: Number,
        required: true,
    },
    risk: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH"],
        required: true,
    },
    offTopic: {
        type: Boolean,
        default: null,
    },
}, {
    timestamps: true,
});
boardSpamSchema.index({
    board: 1,
    postId: 1,
}, {
    unique: true,
});
const userSpamSchema = new mongoose.Schema({
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
    activityLink: {
        type: String,
        required: true,
        index: true,
    },
    activity: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    targetText: {
        type: String,
        required: true,
    },
    result: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    spamScore: {
        type: Number,
        required: true,
    },
    risk: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH"],
        required: true,
    },
    offTopic: {
        type: Boolean,
        default: null,
    },
}, {
    timestamps: true,
});
userSpamSchema.index({
    username: 1,
    type: 1,
    activityLink: 1,
}, {
    unique: true,
});
export const BoardSpamCheck = mongoose.model("BoardSpamCheck", boardSpamSchema);
export const UserSpamCheck = mongoose.model("UserSpamCheck", userSpamSchema);
