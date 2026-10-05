import { User } from "../model/userData.model";
export const userId = async (username: string) => {
    const user = await User.findOne({ username: username });
    if (!user) {
        console.log("user not found");
        return;
    }
    return user._id;
};
