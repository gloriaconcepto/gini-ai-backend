import { Observable } from 'rxjs';

export interface LlmGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
}

export interface ILlmProvider {
  /**
   * Generates text synchronously or as a complete string completion.
   */
  generateText(prompt: string, options?: LlmGenerateOptions): Promise<string>;

  /**
   * Streams completion tokens as an Observable.
   */
  streamText(prompt: string, options?: LlmGenerateOptions): Observable<string>;
}

export const LLM_PROVIDER_TOKEN = Symbol('ILlmProvider');
