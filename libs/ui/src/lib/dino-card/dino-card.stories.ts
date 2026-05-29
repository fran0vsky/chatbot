import type { Meta, StoryObj } from '@storybook/angular';
import { DinoSummary } from '@org/shared-types';
import { DinoCard } from './dino-card';

const rexford: DinoSummary = {
  id: 'rexford',
  name: 'Rexford',
  species: 'Tyrannosaurus',
  persona: 'Blunt, fast, allergic to fluff.',
  blurb: 'Cuts straight to the answer. Great when you want facts without the small talk.',
  specialty: 'Fast factual answers',
  model: 'openai/gpt-oss-120b:free',
  toolNames: ['web_search', 'fetch_page'],
};

const meta: Meta<DinoCard> = {
  title: 'UI/DinoCard',
  component: DinoCard,
  tags: ['autodocs'],
  argTypes: {
    selected: { action: 'selected' },
  },
};
export default meta;
type Story = StoryObj<DinoCard>;

export const Default: Story = {
  args: {
    dino: rexford,
    active: false,
  },
};

export const Active: Story = {
  args: {
    dino: rexford,
    active: true,
  },
};

export const NoTools: Story = {
  args: {
    dino: {
      ...rexford,
      id: 'philo',
      name: 'Philo',
      species: 'Stegosaurus',
      persona: 'Slow, thoughtful, a little philosophical.',
      blurb: 'Talks things through with you. No tools — just conversation.',
      specialty: 'Reflective discussion',
      toolNames: [],
    },
    active: false,
  },
};
