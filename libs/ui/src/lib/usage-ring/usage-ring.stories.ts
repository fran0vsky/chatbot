import type { Meta, StoryObj } from '@storybook/angular';
import { UsageRing } from './usage-ring';

const meta: Meta<UsageRing> = {
  title: 'UI/UsageRing',
  component: UsageRing,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<UsageRing>;

/** Low fill — freshly started conversation (≈15%). */
export const Low: Story = {
  args: {
    percent: 15,
    tokens: 3200,
    warnThreshold: 80,
  },
};

/** Mid fill — active conversation (≈55%). */
export const Mid: Story = {
  args: {
    percent: 55,
    tokens: 12000,
    warnThreshold: 80,
  },
};

/** Warning state — near the context limit (≈85%). */
export const Warning: Story = {
  args: {
    percent: 85,
    tokens: 18500,
    warnThreshold: 80,
  },
};

/** Full — context window at 100%. */
export const Full: Story = {
  args: {
    percent: 100,
    tokens: 22000,
    warnThreshold: 80,
  },
};
