import { type MatchedReply, type SpamCheckResult } from "./spamInterface.utils";
export const buildReasons = (breakdown: SpamCheckResult["breakdown"], matchedReply: MatchedReply | null, offTopic: SpamCheckResult["offTopic"]): string[] => {
    const reasons: string[] = [];
    const { semanticSimilarity, sentenceMatchCoverage, lexicalScore, topicSimilarity } = breakdown;
    if (offTopic === true) {
        reasons.push(topicSimilarity !== null
            ? `The reply appears to be off-topic relative to the original post (topic relevance: ${topicSimilarity.toFixed(2)}).`
            : "The reply appears to be off-topic relative to the original post.");
    }
    if (!matchedReply) {
        if (!reasons.length) {
            reasons.push("No comparable replies were found.");
        }
        return reasons;
    }
    if (sentenceMatchCoverage >= 0.7 && lexicalScore >= 0.3) {
        reasons.push(`Most of the reply's sentences closely correspond to a reply by ${matchedReply.author}, with noticeable wording overlap (${matchedReply.pageUrl}).`);
    }
    else if (sentenceMatchCoverage >= 0.7) {
        reasons.push(`Most of the reply's sentences closely correspond to the substantive content of a reply by ${matchedReply.author} (${matchedReply.pageUrl}).`);
    }
    else if (sentenceMatchCoverage >= 0.5 && semanticSimilarity >= 0.7 && lexicalScore >= 0.3) {
        reasons.push(`The reply has strong pairwise similarity to a reply by ${matchedReply.author}, with both sentence-level overlap and noticeable shared wording (${matchedReply.pageUrl}).`);
    }
    else if (semanticSimilarity >= 0.75 && lexicalScore >= 0.3) {
        reasons.push(`The reply has strong pairwise similarity and noticeable wording overlap with a reply by ${matchedReply.author} (${matchedReply.pageUrl}).`);
    }
    else if (semanticSimilarity >= 0.75) {
        reasons.push(`The reply has strong pairwise similarity to a reply by ${matchedReply.author}, although sentence-level reuse is limited (${matchedReply.pageUrl}).`);
    }
    else if (lexicalScore >= 0.3) {
        reasons.push(`The reply shares noticeable wording with a reply by ${matchedReply.author}, but sentence-level reuse is limited (${matchedReply.pageUrl}).`);
    }
    else {
        reasons.push(`The reply has some pairwise similarity to a reply by ${matchedReply.author} (${matchedReply.pageUrl}).`);
    }
    return reasons;
};
