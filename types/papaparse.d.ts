declare module 'papaparse' {
  export interface ParseConfig<T = any> {
    delimiter?: string;
    skipEmptyLines?: boolean | 'greedy';
    dynamicTyping?: boolean | { [key: string]: boolean };
    complete?: (results: { data: T[] }) => void;
    error?: (error: { message: string }) => void;
  }
  export function parse<T = any>(input: string | File, config?: ParseConfig<T>): { data: T[] };
  export function unparse(data: any): string;
  const Papa: { parse: typeof parse; unparse: typeof unparse };
  export default Papa;
}

