import mongoose from "mongoose";
const userSubscriptionSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    subscriber: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    type: {
        type: String,
        enum: ["post", "reply", "merit-sent", "merit-received"],
        required: true,
        index: true,
    },
    jobId: {
        type: String,
        required: true,
        index: true,
    },
}, {
    timestamps: true,
});
userSubscriptionSchema.index({
    username: 1,
    subscriber: 1,
    type: 1,
}, {
    unique: true,
});
export const UserSubscription = mongoose.model("UserSubscription", userSubscriptionSchema);
