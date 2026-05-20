import type { Meta, StoryObj } from '@storybook/angular';
import { ModelSelector } from './model-selector';

const meta: Meta<ModelSelector> = {
  title: 'UI/ModelSelector',
  component: ModelSelector,
  tags: ['autodocs'],
  argTypes: {
    modelChange: { action: 'modelChange' },
  },
};
export default meta;
type Story = StoryObj<ModelSelector>;

const models = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
] as const;

export const Default: Story = {
  args: {
    models,
    selectedModel: 'openai/gpt-4o-mini',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    models,
    selectedModel: 'openai/gpt-4o-mini',
    disabled: true,
  },
};
