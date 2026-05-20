import type { Meta, StoryObj } from '@storybook/angular';
import { NewChatButton } from './new-chat-button';

const meta: Meta<NewChatButton> = {
  title: 'UI/NewChatButton',
  component: NewChatButton,
  tags: ['autodocs'],
  argTypes: {
    clicked: { action: 'clicked' },
  },
};
export default meta;
type Story = StoryObj<NewChatButton>;

export const Default: Story = {
  args: { disabled: false },
};

export const Disabled: Story = {
  args: { disabled: true },
};
