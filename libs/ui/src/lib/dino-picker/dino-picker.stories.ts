import type { Meta, StoryObj } from '@storybook/angular';
import { DinoSummary } from '@org/shared-types';
import { DinoPicker } from './dino-picker';

const dinos: DinoSummary[] = [
  {
    id: 'rexford',
    name: 'Rexford',
    species: 'Tyrannosaurus',
    persona: 'Blunt, fast, allergic to fluff.',
    blurb: 'Cuts straight to the answer. Great when you want facts without the small talk.',
    specialty: 'Fast factual answers',
    model: 'openai/gpt-oss-120b:free',
    toolNames: ['web_search', 'fetch_page'],
  },
  {
    id: 'philo',
    name: 'Philo',
    species: 'Stegosaurus',
    persona: 'Slow, thoughtful, a little philosophical.',
    blurb: 'Talks things through with you. No tools — just conversation.',
    specialty: 'Reflective discussion',
    model: 'z-ai/glm-4.5-air:free',
    toolNames: [],
  },
  {
    id: 'vera',
    name: 'Vera',
    species: 'Velociraptor',
    persona: 'Sharp, curious, always digging deeper.',
    blurb: 'Hunts down sources and recent events before answering.',
    specialty: 'Research and fresh facts',
    model: 'openai/gpt-oss-20b:free',
    toolNames: ['web_search'],
  },
];

const meta: Meta<DinoPicker> = {
  title: 'UI/DinoPicker',
  component: DinoPicker,
  tags: ['autodocs'],
  argTypes: {
    dinoSelected: { action: 'dinoSelected' },
  },
};
export default meta;
type Story = StoryObj<DinoPicker>;

export const Default: Story = {
  args: {
    dinos,
    activeDinoId: 'rexford',
  },
};

export const Empty: Story = {
  args: {
    dinos: [],
  },
};
