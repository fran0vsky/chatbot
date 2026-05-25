import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { ReasoningBlock } from './reasoning-block';

const SHORT_REASONING =
  'The user asked a factual question. I should answer directly without extra qualifiers.';

const LONG_REASONING = `Let me work through this step by step.

First, I need to identify what the user is actually asking. They want a high-level explanation, not a deep technical dive.

Second, I should structure the answer in three parts:
1. A one-sentence intuition
2. A concrete example
3. A pointer to where to read more

Third, I'll keep the tone friendly but not condescending.

Finalizing the response now.`;

const STREAMING_REASONING =
  'Looking at the user query, the key terms are "quantum computing" and "simple terms". I should start with an analogy';

const meta: Meta<ReasoningBlock> = {
  title: 'UI/ReasoningBlock',
  component: ReasoningBlock,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ReasoningBlock>;

export const Collapsed: Story = {
  args: {
    reasoning: SHORT_REASONING,
    streaming: false,
    durationMs: 4000,
    autoCollapsed: true,
  },
};

export const Expanded: Story = {
  args: {
    reasoning: LONG_REASONING,
    streaming: false,
    durationMs: 12000,
    autoCollapsed: false,
  },
};

export const Streaming: Story = {
  args: {
    reasoning: STREAMING_REASONING,
    streaming: true,
    durationMs: undefined,
    autoCollapsed: false,
  },
};

export const SubSecond: Story = {
  args: {
    reasoning: SHORT_REASONING,
    streaming: false,
    durationMs: 450,
    autoCollapsed: true,
  },
};

export const NightMode: Story = {
  args: {
    reasoning: SHORT_REASONING,
    streaming: false,
    durationMs: 4000,
    autoCollapsed: true,
  },
  decorators: [
    moduleMetadata({}),
    (storyFn) => {
      const story = storyFn();
      return {
        ...story,
        template: `<div class="night-mode bg-studio-night-card p-4">${story.template ?? '<app-reasoning-block [reasoning]="reasoning" [streaming]="streaming" [durationMs]="durationMs" [autoCollapsed]="autoCollapsed"></app-reasoning-block>'}</div>`,
      };
    },
  ],
};
