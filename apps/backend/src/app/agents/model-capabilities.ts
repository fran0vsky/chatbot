export interface ModelCapabilities {
  reasoning: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'openai/gpt-oss-120b:free': { reasoning: true },
  'openai/gpt-oss-120b': { reasoning: true },
  'openai/gpt-oss-20b:free': { reasoning: true },
  'openai/gpt-oss-20b': { reasoning: true },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': { reasoning: true },
  'deepseek/deepseek-v4-flash:free': { reasoning: true },
  'deepseek/deepseek-v4-flash': { reasoning: true },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelId] ?? { reasoning: false };
}
