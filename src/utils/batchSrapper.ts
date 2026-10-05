export const processInBatches = async <T>(items: T[], batchSize: number, worker: (item: T) => Promise<void>) => {
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await Promise.all(batch.map((item) => worker(item)));
    }
};
export const getBoardAliases = (name: string): string[] => {
    const aliases = new Set<string>();
    const full = name.trim().toLowerCase();
    aliases.add(full);
    const match = full.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
        const outside = match[1].trim();
        const inside = match[2].trim();
        if (outside)
            aliases.add(outside);
        if (inside)
            aliases.add(inside);
    }
    return [...aliases];
};
