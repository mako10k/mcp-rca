/**
 * LLM Provider Interface
 * Base types and interfaces for LLM integration
 */

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  metadata?: Record<string, unknown>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stop?: string[];
}

export interface LLMProvider {
  readonly name: string;
  readonly supportedModels: string[];

  generateMessage(
    messages: Message[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  healthCheck(): Promise<boolean>;
}

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: string;
  abstract readonly supportedModels: string[];

  abstract generateMessage(
    messages: Message[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  async healthCheck(): Promise<boolean> {
    try {
      await this.generateMessage(
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 5 }
      );
      return true;
    } catch {
      return false;
    }
  }

  protected handleError(error: unknown, operation: string): never {
    if (error instanceof Error) {
      throw new Error(`${this.name} ${operation} failed: ${error.message}`);
    }
    throw new Error(`${this.name} ${operation} failed: ${String(error)}`);
  }

  protected validateApiKey(apiKey: string | undefined, providerName: string): string {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error(
        `${providerName} API key is required. Set it via environment variable or config.`
      );
    }
    return apiKey.trim();
  }
}
