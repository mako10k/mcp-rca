/**
 * OpenAI API Provider
 * Integration with OpenAI GPT models
 */

import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';

interface OpenAIChoice {
  message: {
    content: string | null;
  };
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIChatResponse {
  id: string;
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIError extends Error {
  response?: {
    status: number;
    statusText: string;
    body: string;
  };
}

function isOpenAIChatResponse(obj: unknown): obj is OpenAIChatResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const candidate = obj as Record<string, unknown>;
  return 'choices' in candidate && 'model' in candidate && Array.isArray(candidate.choices);
}

export interface OpenAIConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  organization?: string;
}

export class OpenAIProvider extends BaseLLMProvider {
  readonly name = 'OpenAI';
  readonly supportedModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ];

  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private organization?: string;

  constructor(config: OpenAIConfig = {}) {
    super();
    this.apiKey = this.validateApiKey(
      config.apiKey || process.env.OPENAI_API_KEY,
      'OpenAI'
    );
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
    this.defaultModel = config.defaultModel || 'gpt-4o-mini';
    this.organization = config.organization || process.env.OPENAI_ORG_ID;
  }

  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    try {
      const responseData = await this.makeRequest('/chat/completions', {
        model: options.model || this.defaultModel,
        messages: this.formatMessages(messages),
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP,
        stop: options.stop,
      });

      if (!isOpenAIChatResponse(responseData)) {
        throw new Error(
          `Invalid response format from OpenAI. Expected object with 'choices' and 'model'.`
        );
      }

      if (!responseData.choices || responseData.choices.length === 0) {
        throw new Error('OpenAI API returned empty choices array');
      }

      const choice = responseData.choices[0];
      if (!choice.message) {
        throw new Error('Invalid choice format: missing message property');
      }

      return {
        content: choice.message.content || '',
        model: responseData.model,
        usage: responseData.usage
          ? {
              inputTokens: responseData.usage.prompt_tokens,
              outputTokens: responseData.usage.completion_tokens,
              totalTokens: responseData.usage.total_tokens,
            }
          : undefined,
        metadata: {
          id: responseData.id,
          created: responseData.created,
        },
      };
    } catch (error) {
      this.handleError(error, 'generateMessage');
    }
  }

  private formatMessages(messages: Message[]): Array<Record<string, unknown>> {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<OpenAIChatResponse> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      ) as OpenAIError;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      };
      throw error;
    }

    return response.json() as Promise<OpenAIChatResponse>;
  }
}
