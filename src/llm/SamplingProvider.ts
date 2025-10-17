/**
 * MCP Sampling Protocol Provider
 * Uses MCP sampling/createMessage protocol for LLM-backed generation
 */

import { BaseLLMProvider, LLMResponse, Message, LLMRequestOptions } from "./LLMProvider.js";
import { requestSamplingCompletion } from "./samplingClient.js";

export class SamplingProvider extends BaseLLMProvider {
  readonly name = 'Sampling';
  readonly supportedModels = ['mcp-sampling'];

  async generateMessage(
    messages: Message[],
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    return requestSamplingCompletion(messages, options);
  }
}
