import mongoose from "mongoose";
const userData = new mongoose.Schema({
    username: {
        type: String,
        trim: true,
        index: true,
    },
    userData: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, {
    strict: false,
    timestamps: true,
});
export const User = mongoose.model("User", userData);
