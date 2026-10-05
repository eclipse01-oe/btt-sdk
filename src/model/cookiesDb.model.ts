import mongoose from "mongoose";
const cookiesSchema = new mongoose.Schema({
    key: {
        type: String,
        default: "btt",
        unique: true,
    },
    cookies: [
        {
            name: String,
            value: String,
            domain: String,
            path: String,
            expires: Number,
            httpOnly: Boolean,
            secure: Boolean,
        },
    ],
}, { timestamps: true });
export const CookiesDB = mongoose.model("CookiesDB", cookiesSchema);
