export class AppError extends Error {
    constructor(message: string, public code: number) {
        super(message);
    }
}
export class err400 extends AppError {
    constructor(message: string) {
        super(message, 400);
    }
}
export class err401 extends AppError {
    constructor(message: string) {
        super(message, 401);
    }
}
export class err404 extends AppError {
    constructor(message: string) {
        super(message, 404);
    }
}
export class err422 extends AppError {
    constructor(message: string) {
        super(message, 422);
    }
}
export class err11000 extends AppError {
    constructor(message: string) {
        super(message, 11000);
    }
}
export const nullCheck = <T>(data: T | null | undefined, msg: string): T => {
    if (data === null || data === undefined) {
        throw new err404(msg);
    }
    return data;
};
