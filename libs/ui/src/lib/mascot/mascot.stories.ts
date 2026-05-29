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
    dinoId: {
      control: 'text',
    },
    theme: {
      control: 'inline-radio',
      options: [undefined, 'day', 'night'],
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

// Per-dino mascots. Until the art is generated + run through the pipeline these
// fall back to the generic Spino, but they demonstrate the dinoId + theme API.
export const DinoDay: Story = {
  args: { size: 'hero', dinoId: 'rexford', theme: 'day' },
};

export const DinoNight: Story = {
  args: { size: 'hero', dinoId: 'veloce', theme: 'night' },
};
