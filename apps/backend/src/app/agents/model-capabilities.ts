export interface ModelCapabilities {
  reasoning: boolean;
}

// Reasoning currently disabled across the board: the modelKwargs.reasoning
// path makes @langchain/openrouter crash with "Cannot read properties of
// undefined (reading 'additional_kwargs')" on free models. Plain-completion
// mode works fine — re-enable per-model once the library handles the new
// response shape.
export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'openai/gpt-oss-120b:free': { reasoning: false },
  'openai/gpt-oss-120b': { reasoning: false },
  'openai/gpt-oss-20b:free': { reasoning: false },
  'openai/gpt-oss-20b': { reasoning: false },
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free': { reasoning: false },
  'deepseek/deepseek-v4-flash:free': { reasoning: false },
  'deepseek/deepseek-v4-flash': { reasoning: false },
};

export function getModelCapabilities(modelId: string): ModelCapabilities {
  return MODEL_CAPABILITIES[modelId] ?? { reasoning: false };
}
