import type { Meta, StoryObj } from '@storybook/angular';
import { ChatInput } from './chat-input';

const meta: Meta<ChatInput> = {
  title: 'UI/ChatInput',
  component: ChatInput,
  tags: ['autodocs'],
  argTypes: {
    send: { action: 'send' },
  },
};
export default meta;
type Story = StoryObj<ChatInput>;

export const Default: Story = {
  args: {
    placeholder: 'Message',
    disabled: false,
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Explain quantum computing in simple terms...',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Message',
    disabled: true,
  },
};
