import type { Meta, StoryObj } from '@storybook/angular';
import { HeaderBar } from './header-bar';

const meta: Meta<HeaderBar> = {
  title: 'UI/HeaderBar',
  component: HeaderBar,
  tags: ['autodocs'],
  argTypes: {
    themeToggled: { action: 'themeToggled' },
    newChat: { action: 'newChat' },
    historyToggled: { action: 'historyToggled' },
  },
};
export default meta;
type Story = StoryObj<HeaderBar>;

export const NightMode: Story = {
  args: {
    isDayMode: false,
    disabled: false,
  },
};

export const DayMode: Story = {
  args: {
    isDayMode: true,
    disabled: false,
  },
};

export const LoadingState: Story = {
  args: {
    isDayMode: false,
    disabled: true,
  },
};
