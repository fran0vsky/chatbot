import type { Meta, StoryObj } from '@storybook/angular';
import { ThemeToggle } from './theme-toggle';

const meta: Meta<ThemeToggle> = {
  title: 'UI/ThemeToggle',
  component: ThemeToggle,
  tags: ['autodocs'],
  argTypes: {
    toggled: { action: 'toggled' },
  },
};
export default meta;
type Story = StoryObj<ThemeToggle>;

export const NightMode: Story = {
  args: { isDayMode: false },
};

export const DayMode: Story = {
  args: { isDayMode: true },
};

export const Disabled: Story = {
  args: { isDayMode: false, disabled: true },
};
