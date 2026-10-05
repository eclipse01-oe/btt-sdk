export interface ThreadReply {
    author: string;
    text: string;
    pageUrl: string;
    isOP: boolean;
    isOriginalPost: boolean;
}
export interface SpamCheckInput {
    targetText: string;
    replies: ThreadReply[];
    username?: string;
}
export interface MatchedReply {
    author: string;
    pageUrl: string;
    text: string;
    similarity: number;
}
export interface SpamCheckResult {
    spamScore: number;
    risk: "LOW" | "MEDIUM" | "HIGH";
    offTopic: boolean | null;
    breakdown: {
        semanticSimilarity: number;
        sentenceMatchCoverage: number;
        lexicalScore: number;
        topicSimilarity: number | null;
    };
    reasons: string[];
    matchedReply: MatchedReply | null;
}
export interface QuoteReplyPair {
    quote: string;
    reply: string;
}
export interface SpamActivity {
    type: "post" | "reply";
    title: string | null;
    link: string | null;
    board: {
        name: string | null;
        url: string | null;
    };
    rawEventAt: string | null;
    eventAt: Date | null;
}
export interface ParsedThreadReply {
    author: string;
    text: string;
    pageUrl: string;
    isOriginalPost: boolean;
    messageId: string | null;
    title: string;
}
export interface UserActivitySpamResult {
    activity: SpamActivity;
    targetText: string;
    result: SpamCheckResult;
}
export interface BoardActivity {
    name: string;
    cat: "main" | "child";
    posterLink?: string;
    poster: string;
    postLink?: string;
    post?: string;
    topicId?: string;
    rawDateTime: string;
    eventAt: Date;
    postId: string;
}
export interface BoardActivitySpamResult {
    activity: BoardActivity;
    targetText: string;
    result: SpamCheckResult;
}
