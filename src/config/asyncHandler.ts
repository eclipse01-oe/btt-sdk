const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export const scraperHandler = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    console.error("[SCRAPER]: ", errorMessage(err));
    throw err;
  }
};

export const WorkerJobHandler = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (err) {
    console.error("[Jobs]: ", errorMessage(err));

    throw err;
  }
};
