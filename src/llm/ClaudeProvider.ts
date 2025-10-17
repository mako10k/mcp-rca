/**
 * Anthropic Claude API Provider
 * Integration with Claude models
 */

import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from './LLMProvider.js';

interface ClaudeMessageParam {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeContentBlock {
  type: string;
  text?: string;
}

interface ClaudeMessage {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeConfig {
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  version?: string;
}

export class ClaudeProvider extends BaseLLMProvider {
  readonly name = 'Claude';
  readonly supportedModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];

  private apiKey: string;
  private baseURL: string;
  private defaultModel: string;
  private version: string;

  constructor(config: ClaudeConfig = {}) {
    super();
    this.apiKey = this.validateApiKey(
      config.apiKey || process.env.ANTHROPIC_API_KEY,
      'Claude'
    );
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
    this.defaultModel = config.defaultModel || 'claude-3-5-sonnet-20241022';
    this.version = config.version || '2023-06-01';
  }

  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    try {
      const { system, messages: formattedMessages } = this.formatMessages(messages);

      const response = await this.makeRequest('/v1/messages', {
        model: options.model || this.defaultModel,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
        top_p: options.topP,
        stop_sequences: options.stop,
        system,
        messages: formattedMessages,
      });

      const messageResponse = response as ClaudeMessage;
      const content = messageResponse.content[0] as ClaudeContentBlock;

      return {
        content: content.type === 'text' && content.text ? content.text : '',
        model: messageResponse.model,
        usage: {
          inputTokens: messageResponse.usage.input_tokens,
          outputTokens: messageResponse.usage.output_tokens,
          totalTokens:
            messageResponse.usage.input_tokens + messageResponse.usage.output_tokens,
        },
        metadata: {
          id: messageResponse.id,
          type: messageResponse.type,
          role: messageResponse.role,
        },
      };
    } catch (error) {
      this.handleError(error, 'generateMessage');
    }
  }

  private formatMessages(messages: Message[]): {
    system?: string;
    messages: ClaudeMessageParam[];
  } {
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    return {
      system: systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n') : undefined,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    };
  }

  private async makeRequest(
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<ClaudeMessage> {
    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
      'anthropic-version': this.version,
      'Content-Type': 'application/json',
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const error = new Error(
        `Claude API error: ${response.status} ${response.statusText}`
      ) as Error & {
        response?: {
          status: number;
          statusText: string;
          body: string;
        };
      };
      error.response = {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      };
      throw error;
    }

    return response.json();
  }
}
