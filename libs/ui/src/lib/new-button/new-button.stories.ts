import type { Meta, StoryObj } from '@storybook/angular';
import { NewButton } from './new-button';

const meta: Meta<NewButton> = {
  title: 'UI/NewButton',
  component: NewButton,
  tags: ['autodocs'],
  argTypes: {
    clicked: { action: 'clicked' },
  },
};
export default meta;
type Story = StoryObj<NewButton>;

export const Default: Story = {
  args: { disabled: false },
};

export const Disabled: Story = {
  args: { disabled: true },
};
