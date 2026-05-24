import { getModelCapabilities } from './model-capabilities';

describe('getModelCapabilities', () => {
  it('returns reasoning=true for deepseek-r1 free', () => {
    expect(getModelCapabilities('deepseek/deepseek-r1:free').reasoning).toBe(true);
  });

  it('returns reasoning=true for paid deepseek-r1', () => {
    expect(getModelCapabilities('deepseek/deepseek-r1').reasoning).toBe(true);
  });

  it('returns reasoning=false for default model', () => {
    expect(getModelCapabilities('openai/gpt-4o-mini').reasoning).toBe(false);
  });

  it('returns reasoning=false for unknown model', () => {
    expect(getModelCapabilities('completely/unknown-model').reasoning).toBe(false);
  });
});
