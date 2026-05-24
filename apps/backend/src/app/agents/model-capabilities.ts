export interface ModelCapabilities {
  reasoning: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'deepseek/deepseek-r1:free': { reasoning: true },
  'deepseek/deepseek-r1': { reasoning: true },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelId] ?? { reasoning: false };
}
