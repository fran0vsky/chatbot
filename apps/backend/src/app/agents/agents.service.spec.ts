import { AgentsService } from './agents.service';

type ServiceWithPrivate = {
  extractChunkReasoning(chunk: unknown): string;
};

describe('AgentsService.extractChunkReasoning', () => {
  let service: AgentsService;

  beforeEach(() => {
    service = new AgentsService();
  });

  it('returns string reasoning_content from additional_kwargs', () => {
    const chunk = { additional_kwargs: { reasoning_content: 'hello reasoning' } };
    const result = (service as unknown as ServiceWithPrivate).extractChunkReasoning(chunk);
    expect(result).toBe('hello reasoning');
  });

  it('concatenates reasoning_details array text entries', () => {
    const chunk = {
      additional_kwargs: {
        reasoning_details: [{ text: 'part1' }, { text: 'part2' }],
      },
    };
    const result = (service as unknown as ServiceWithPrivate).extractChunkReasoning(chunk);
    expect(result).toBe('part1part2');
  });

  it('returns empty string when additional_kwargs is absent', () => {
    const chunk = { content: 'some content' };
    const result = (service as unknown as ServiceWithPrivate).extractChunkReasoning(chunk);
    expect(result).toBe('');
  });

  it('returns empty string for null chunk', () => {
    const result = (service as unknown as ServiceWithPrivate).extractChunkReasoning(null);
    expect(result).toBe('');
  });

  it('returns empty string when reasoning fields are missing from additional_kwargs', () => {
    const chunk = { additional_kwargs: { other_field: 'value' } };
    const result = (service as unknown as ServiceWithPrivate).extractChunkReasoning(chunk);
    expect(result).toBe('');
  });
});
