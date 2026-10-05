import mongoose from "mongoose";
const boardSchema = new mongoose.Schema({
    boardId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    aliases: [
        {
            type: String,
            trim: true,
            lowercase: true,
            index: true,
        },
    ],
    url: {
        type: String,
        required: true,
        trim: true,
    },
    children: [
        {
            childBoardId: {
                type: String,
                index: true,
            },
            childBoardName: {
                type: String,
                trim: true,
                index: true,
            },
            childBoardUrl: {
                type: String,
                trim: true,
            },
        },
    ],
}, { timestamps: true });
export const BoardReg = mongoose.model("BoardReg", boardSchema);
const boardInitSchema = new mongoose.Schema({
    task: {
        type: String,
        required: true,
        unique: true,
        default: "boards",
    },
    status: {
        type: String,
        enum: ["pending", "completed"],
        default: "pending",
    },
    completedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
export const BoardInit = mongoose.model("BoardInit", boardInitSchema);
