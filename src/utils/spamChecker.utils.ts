import { split } from "sentence-splitter";
export const tokenizeLexical = (text: string): string[] => {
    return text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2);
};
export const buildIdf = (documents: string[]): Map<string, number> => {
    const documentFrequency = new Map<string, number>();
    const totalDocuments = documents.length;
    for (const document of documents) {
        const uniqueTokens = new Set(tokenizeLexical(document));
        for (const token of uniqueTokens) {
            documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
        }
    }
    const idf = new Map<string, number>();
    for (const [token, frequency] of documentFrequency) {
        idf.set(token, Math.log((totalDocuments + 1) / (frequency + 1)));
    }
    return idf;
};
export const weightedExactOverlap = (textTokens: string[], replyTokens: string[], idf: Map<string, number>): number => {
    if (!textTokens.length || !replyTokens.length)
        return 0;
    const textSet = new Set(textTokens);
    const replySet = new Set(replyTokens);
    const vocabulary = new Set([...textSet, ...replySet]);
    let intersection = 0;
    let union = 0;
    for (const token of vocabulary) {
        const weight = idf.get(token) ?? 0;
        const inText = textSet.has(token);
        const inReply = replySet.has(token);
        if (inText && inReply)
            intersection += weight;
        if (inText || inReply)
            union += weight;
    }
    return union === 0 ? 0 : intersection / union;
};
export const getSentenceTexts = (text: string): string[] => {
    return split(text)
        .filter((node) => node.type === "Sentence")
        .map((node) => {
        const sentenceNode = node as {
            raw?: string;
            value?: string;
        };
        return sentenceNode.raw ?? sentenceNode.value ?? "";
    })
        .filter(Boolean);
};
export function extractQuoteReplyPairs(text: string) {
    const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const quoteTagRegex = /\[(\/?)quote\b[^\]]*\]/gi;
    const blocks: Array<{
        start: number;
        end: number;
        quote: string;
    }> = [];
    const stack: Array<{
        contentStart: number;
        tagStart: number;
    }> = [];
    let match: RegExpExecArray | null;
    while ((match = quoteTagRegex.exec(normalizedText)) !== null) {
        const isClosing = match[1] === "/";
        if (!isClosing) {
            stack.push({
                contentStart: match.index + match[0].length,
                tagStart: match.index,
            });
            continue;
        }
        if (stack.length === 0) {
            continue;
        }
        const opening = stack.pop();
        if (!opening) {
            continue;
        }
        if (stack.length === 0) {
            const quote = normalizedText.slice(opening.contentStart, match.index).trim();
            if (quote) {
                blocks.push({
                    start: opening.tagStart,
                    end: match.index + match[0].length,
                    quote,
                });
            }
        }
    }
    if (blocks.length === 0) {
        return {
            intro: normalizedText.trim(),
            pairs: [],
        };
    }
    const intro = normalizedText.slice(0, blocks[0].start).trim();
    const pairs: Array<{
        quote: string;
        reply: string;
    }> = [];
    let groupStart = 0;
    while (groupStart < blocks.length) {
        let groupEnd = groupStart;
        while (groupEnd + 1 < blocks.length &&
            normalizedText.slice(blocks[groupEnd].end, blocks[groupEnd + 1].start).trim() === "") {
            groupEnd++;
        }
        const replyStart = blocks[groupEnd].end;
        const replyEnd = groupEnd + 1 < blocks.length ? blocks[groupEnd + 1].start : normalizedText.length;
        const reply = normalizedText.slice(replyStart, replyEnd).trim();
        if (reply) {
            for (let index = groupStart; index <= groupEnd; index++) {
                pairs.push({
                    quote: blocks[index].quote,
                    reply,
                });
            }
        }
        groupStart = groupEnd + 1;
    }
    return {
        intro,
        pairs,
    };
}
const getNgramCounts = (values: string[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const value of values) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return counts;
};
export const calculateF1 = (targetValues: string[], replyValues: string[]): number => {
    if (targetValues.length === 0 || replyValues.length === 0) {
        return 0;
    }
    const targetCounts = getNgramCounts(targetValues);
    const replyCounts = getNgramCounts(replyValues);
    let overlapCount = 0;
    for (const [value, targetCount] of targetCounts) {
        overlapCount += Math.min(targetCount, replyCounts.get(value) ?? 0);
    }
    const precision = overlapCount / replyValues.length;
    const recall = overlapCount / targetValues.length;
    if (precision + recall === 0) {
        return 0;
    }
    return (2 * precision * recall) / (precision + recall);
};
export const getNgrams = (tokens: string[], size: number): string[] => {
    if (tokens.length < size) {
        return [];
    }
    const ngrams: string[] = [];
    for (let index = 0; index <= tokens.length - size; index++) {
        ngrams.push(tokens.slice(index, index + size).join(" "));
    }
    return ngrams;
};
