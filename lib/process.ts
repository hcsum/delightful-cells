// Generic client for calling the Cloudflare Worker to process extractions.
// The Worker is expected to implement POST {CF_URL}
// with payload: { rows: string[], promptType: 'predefined'|'custom', promptTemplate: string }
// and response: { results: { input: string, output: string|null }[] }

export type PromptType = 'predefined' | 'custom';

export type ProcessRequest = {
  rows: string[];
  promptType: PromptType;
  promptTemplate: string;
};

export type ProcessResultItem = { input: string; output: string | null };

export type ProcessResponse = {
  results: ProcessResultItem[];
};

export async function processRows(
  rows: string[],
  promptType: PromptType,
  promptTemplate: string,
  batchSize = 10,
  signal?: AbortSignal
): Promise<ProcessResultItem[]> {
  const base = process.env.NEXT_PUBLIC_CF_WORKER_URL || '/api/process';
  const out: ProcessResultItem[] = [];
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const payload: ProcessRequest = {
      rows: chunk,
      promptType,
      promptTemplate,
    };
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error(`Worker error ${res.status}`);
    const json = (await res.json()) as ProcessResponse;
    if (!json || !Array.isArray(json.results)) {
      throw new Error('Invalid worker response');
    }
    // Preserve input order within each chunk
    out.push(...json.results.map((r) => ({ input: String(r.input ?? ''), output: r.output ?? null })));
  }
  return out;
}
