import type { Meta, StoryObj } from '@storybook/angular';
import { Mascot } from './mascot';

const meta: Meta<Mascot> = {
  title: 'UI/Mascot',
  component: Mascot,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'inline-radio',
      options: ['sm', 'hero'],
    },
  },
};
export default meta;
type Story = StoryObj<Mascot>;

export const Small: Story = {
  args: { size: 'sm' },
};

export const Hero: Story = {
  args: { size: 'hero' },
};
