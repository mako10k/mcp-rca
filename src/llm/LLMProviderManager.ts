/**
 * LLM Provider Manager
 * Manages multiple LLM providers and provider selection
 */

import { LLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';
import { OpenAIProvider } from './OpenAIProvider.js';
import { ClaudeProvider } from './ClaudeProvider.js';
import { SamplingProvider } from './SamplingProvider.js';

export interface LLMManagerConfig {
  defaultProvider?: string;
  providers?: {
    openai?: Record<string, unknown>;
    claude?: Record<string, unknown>;
  };
  enableSamplingFallback?: boolean;
}

export class LLMProviderManager {
  private providers = new Map<string, LLMProvider>();
  private defaultProvider: string;

  constructor(config: LLMManagerConfig = {}) {
    this.defaultProvider = config.defaultProvider ?? 'sampling';
    this.initializeProviders(config);
  }

  private initializeProviders(config: LLMManagerConfig): void {
    const registerProvider = (name: string, factory: () => LLMProvider, required: boolean) => {
      try {
        const provider = factory();
        this.providers.set(name, provider);
      } catch (error) {
        if (required) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    };

    const openaiConfigured = this.hasProvidedCredentials(process.env.OPENAI_API_KEY) || Boolean(config.providers?.openai);
    if (openaiConfigured) {
      registerProvider('openai', () => new OpenAIProvider(config.providers?.openai), this.defaultProvider === 'openai');
    } else if (this.defaultProvider === 'openai') {
      throw new Error('OPENAI_API_KEY must be set when using the OpenAI provider.');
    }

    const claudeConfigured = this.hasProvidedCredentials(process.env.ANTHROPIC_API_KEY) || Boolean(config.providers?.claude);
    if (claudeConfigured) {
      registerProvider('claude', () => new ClaudeProvider(config.providers?.claude), this.defaultProvider === 'claude' || this.defaultProvider === 'anthropic');
    } else if (this.defaultProvider === 'claude' || this.defaultProvider === 'anthropic') {
      throw new Error('ANTHROPIC_API_KEY must be set when using the Anthropic provider.');
    }

    const samplingRequired = this.defaultProvider === 'sampling';
    if (config.enableSamplingFallback !== false || samplingRequired) {
      registerProvider('sampling', () => new SamplingProvider(), samplingRequired);
    }

    if (this.providers.size === 0) {
      throw new Error('No LLM providers are available. Configure an API key or enable the MCP sampling provider.');
    }

    if (!this.providers.has(this.defaultProvider)) {
      throw new Error(`Default provider '${this.defaultProvider}' could not be initialized.`);
    }
  }

  private hasProvidedCredentials(value: unknown): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private getProvider(providerName?: string): LLMProvider | undefined {
    const name = providerName || this.defaultProvider;
    return this.providers.get(name);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions & { provider?: string } = {}
  ): Promise<LLMResponse> {
    const { provider: providerName, ...llmOptions } = options;

    const provider = this.getProvider(providerName);
    if (!provider) {
      const available = this.getAvailableProviders();
      throw new Error(
        `Provider '${providerName || this.defaultProvider}' not available. ` +
          `Available providers: ${available.join(', ')}`
      );
    }

    return provider.generateMessage(messages, llmOptions);
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers.entries()) {
      try {
        results[name] = await provider.healthCheck();
      } catch {
        results[name] = false;
      }
    }

    return results;
  }
}
