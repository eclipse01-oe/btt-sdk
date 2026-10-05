import { Ranker } from "../config/reranker";
import { tokenizeLexical, getSentenceTexts, extractQuoteReplyPairs, calculateF1, getNgrams, } from "../utils/spamChecker.utils";
import { buildReasons } from "../utils/spamBuildReason.utils";
import { type SpamCheckInput, type SpamCheckResult, type MatchedReply, } from "../utils/spamInterface.utils";
const SENTENCE_MATCH_THRESHOLD = 0.7;
const OFF_TOPIC_THRESHOLD = 0.5;
const HIGH_RERANKER_THRESHOLD = 0.75;
const MEDIUM_RERANKER_THRESHOLD = 0.5;
export class SpamChecker {
    private rankText = new Ranker();
    async init(): Promise<void> {
        await this.rankText.init();
    }
    private async calculateSentenceMatchCoverage(targetSentenceTexts: string[], replySentenceTexts: string[]): Promise<number> {
        if (targetSentenceTexts.length === 0 || replySentenceTexts.length === 0) {
            return 0;
        }
        const matches: Array<{
            targetIndex: number;
            replyIndex: number;
            score: number;
        }> = [];
        for (let targetIndex = 0; targetIndex < targetSentenceTexts.length; targetIndex++) {
            const results = await this.rankText.rankTexts(targetSentenceTexts[targetIndex], replySentenceTexts);
            for (const result of results) {
                matches.push({
                    targetIndex,
                    replyIndex: result.corpusId,
                    score: result.score,
                });
            }
        }
        matches.sort((a, b) => b.score - a.score);
        const matchedTargetSentences = new Set<number>();
        const matchedReplySentences = new Set<number>();
        for (const match of matches) {
            if (match.score < SENTENCE_MATCH_THRESHOLD ||
                matchedTargetSentences.has(match.targetIndex) ||
                matchedReplySentences.has(match.replyIndex)) {
                continue;
            }
            matchedTargetSentences.add(match.targetIndex);
            matchedReplySentences.add(match.replyIndex);
        }
        return matchedTargetSentences.size / targetSentenceTexts.length;
    }
    private calculateLexicalScore(targetTokens: string[], replyTokens: string[]): number {
        if (targetTokens.length === 0 || replyTokens.length === 0) {
            return 0;
        }
        const unigramScore = calculateF1(targetTokens, replyTokens);
        const bigramScore = calculateF1(getNgrams(targetTokens, 2), getNgrams(replyTokens, 2));
        const trigramScore = calculateF1(getNgrams(targetTokens, 3), getNgrams(replyTokens, 3));
        return unigramScore * 0.2 + bigramScore * 0.5 + trigramScore * 0.3;
    }
    private async calculateTopicSimilarity(targetText: string, originalPostText: string): Promise<number | null> {
        const topicSentenceTexts = getSentenceTexts(originalPostText);
        if (topicSentenceTexts.length === 0) {
            return null;
        }
        const results = await this.rankText.rankTexts(targetText, topicSentenceTexts);
        if (results.length === 0) {
            return null;
        }
        const topResults = results.slice(0, Math.min(3, results.length));
        return topResults.reduce((sum, result) => sum + result.score, 0) / topResults.length;
    }
    async checkSpam(input: SpamCheckInput): Promise<SpamCheckResult> {
        const username = input.username?.toLowerCase();
        const comparisonPool = input.replies.filter((reply) => !reply.isOriginalPost && (!username || reply.author.toLowerCase() !== username));
        const originalPost = input.replies.find((reply) => reply.isOriginalPost);
        const { intro, pairs } = extractQuoteReplyPairs(input.targetText);
        const ownText = [intro, ...pairs.map((pair) => pair.reply)].filter(Boolean).join(" ").trim() ||
            input.targetText;
        const targetSentenceTexts = getSentenceTexts(ownText);
        const lexicalTargetTokens = tokenizeLexical(ownText);
        const comparisonTexts = comparisonPool.map((reply) => reply.text);
        const rankedReplies = comparisonPool.length
            ? await this.rankText.rankTexts(ownText, comparisonTexts)
            : [];
        const scores: Array<{
            reply: (typeof comparisonPool)[number];
            reranker: number;
            sentenceMatchCoverage: number;
            lexical: number;
        }> = [];
        for (const result of rankedReplies) {
            const reply = comparisonPool[result.corpusId];
            const replySentenceTexts = getSentenceTexts(reply.text);
            const sentenceMatchCoverage = await this.calculateSentenceMatchCoverage(targetSentenceTexts, replySentenceTexts);
            const lexical = this.calculateLexicalScore(lexicalTargetTokens, tokenizeLexical(reply.text));
            scores.push({
                reply,
                reranker: result.score,
                sentenceMatchCoverage,
                lexical,
            });
        }
        const bestMatch = scores.length
            ? scores.reduce((best, current) => (current.reranker > best.reranker ? current : best))
            : null;
        console.log("\n📊 Reply reranker scores:");
        scores.forEach((score, index) => {
            console.log(`${index + 1}. ${score.reply.author} | ` +
                `reranker=${score.reranker.toFixed(2)} ` +
                `| coverage=${score.sentenceMatchCoverage.toFixed(2)} ` +
                `| lexical=${score.lexical.toFixed(2)}`);
        });
        let topicSimilarity: number | null = null;
        if (originalPost) {
            topicSimilarity = await this.calculateTopicSimilarity(ownText, originalPost.text);
        }
        const offTopic = topicSimilarity !== null ? topicSimilarity < OFF_TOPIC_THRESHOLD : null;
        if (topicSimilarity !== null) {
            console.log(`\n📌 Topic relevance: ${topicSimilarity.toFixed(2)} ` + `| offTopic=${offTopic}`);
        }
        else {
            console.log("\n📌 Topic relevance: unavailable");
        }
        const semanticSimilarity = bestMatch?.reranker ?? 0;
        const sentenceMatchCoverage = bestMatch?.sentenceMatchCoverage ?? 0;
        const lexicalScore = bestMatch?.lexical ?? 0;
        const spamScore = semanticSimilarity * 0.35 + sentenceMatchCoverage * 0.55 + lexicalScore * 0.1;
        const risk: SpamCheckResult["risk"] = spamScore >= HIGH_RERANKER_THRESHOLD
            ? "HIGH"
            : spamScore >= MEDIUM_RERANKER_THRESHOLD
                ? "MEDIUM"
                : "LOW";
        const matchedReply: MatchedReply | null = bestMatch
            ? {
                author: bestMatch.reply.author,
                pageUrl: bestMatch.reply.pageUrl,
                text: bestMatch.reply.text,
                similarity: Number(bestMatch.reranker.toFixed(2)),
            }
            : null;
        const breakdown = {
            semanticSimilarity: Number(semanticSimilarity.toFixed(2)),
            sentenceMatchCoverage: Number(sentenceMatchCoverage.toFixed(2)),
            lexicalScore: Number(lexicalScore.toFixed(2)),
            topicSimilarity: topicSimilarity !== null ? Number(topicSimilarity.toFixed(2)) : null,
        };
        const reasons = buildReasons(breakdown, matchedReply, offTopic);
        return {
            spamScore: Number(spamScore.toFixed(2)),
            risk,
            offTopic,
            breakdown,
            reasons,
            matchedReply,
        };
    }
}
