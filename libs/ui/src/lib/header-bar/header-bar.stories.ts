import type { Meta, StoryObj } from '@storybook/angular';
import { HeaderBar } from './header-bar';

const meta: Meta<HeaderBar> = {
  title: 'UI/HeaderBar',
  component: HeaderBar,
  tags: ['autodocs'],
  argTypes: {
    themeToggled: { action: 'themeToggled' },
    newChat: { action: 'newChat' },
    modelChange: { action: 'modelChange' },
  },
};
export default meta;
type Story = StoryObj<HeaderBar>;

const models = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
] as const;

export const NightMode: Story = {
  args: {
    isDayMode: false,
    selectedModel: 'openai/gpt-4o-mini',
    models,
    disabled: false,
  },
};

export const DayMode: Story = {
  args: {
    isDayMode: true,
    selectedModel: 'openai/gpt-4o-mini',
    models,
    disabled: false,
  },
};

export const LoadingState: Story = {
  args: {
    isDayMode: false,
    selectedModel: 'openai/gpt-4o-mini',
    models,
    disabled: true,
  },
};
