import type { Meta, StoryObj } from '@storybook/angular';
import { MascotPanel } from './mascot-panel';

const meta: Meta<MascotPanel> = {
  title: 'UI/MascotPanel',
  component: MascotPanel,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'inline-radio',
      options: ['idle', 'thinking'],
    },
    isDayMode: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<MascotPanel>;

export const NightIdle: Story = {
  args: { status: 'idle', isDayMode: false },
};

export const NightThinking: Story = {
  args: { status: 'thinking', isDayMode: false },
};

export const DayIdle: Story = {
  args: { status: 'idle', isDayMode: true },
};
