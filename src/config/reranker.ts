import { AutoModelForSequenceClassification, AutoTokenizer } from "@huggingface/transformers";

const MODEL_ID = "mixedbread-ai/mxbai-rerank-xsmall-v1";

type RankedResult = {
  corpusId: number;
  score: number;
};

export class Ranker {
  private tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>> | null = null;

  private model: Awaited<
    ReturnType<typeof AutoModelForSequenceClassification.from_pretrained>
  > | null = null;

  async init(): Promise<void> {
    console.log("🧠 loading tokenizer...");

    this.tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);

    console.log("✅ Tokenizer loaded");

    console.log("🧠 loading model...");

    this.model = await AutoModelForSequenceClassification.from_pretrained(MODEL_ID);

    console.log("✅ Model loaded");
  }

  async rankTexts(query: string, documents: string[]): Promise<RankedResult[]> {
    if (!query.trim() || documents.length === 0) {
      return [];
    }

    if (!this.tokenizer || !this.model) {
      throw new Error("Ranker has not been initialized. Call init() first.");
    }

    const inputs = this.tokenizer(new Array(documents.length).fill(query), {
      text_pair: documents,
      padding: true,
      truncation: true,
    });

    const output = await this.model(inputs);

    const logits = output.logits.sigmoid().tolist() as number[][];

    return logits
      .map(([score], corpusId) => ({
        corpusId,
        score,
      }))
      .sort((a, b) => b.score - a.score);
  }
}
