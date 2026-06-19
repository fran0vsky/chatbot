import type { Meta, StoryObj } from '@storybook/angular';
import { DinoReactivityMap, DinoSummary } from '@org/shared-types';
import { ReactivitySettings } from './reactivity-settings';

const SAMPLE_DINOS: DinoSummary[] = [
  {
    id: 'rexford',
    name: 'Rexford',
    species: 'Tyrannosaurus',
    persona: 'Blunt and fast',
    blurb: 'Gets to the point.',
    specialty: 'Fast factual answers',
    model: 'openai/gpt-4o-mini',
    toolNames: [],
  },
  {
    id: 'nimbus',
    name: 'Nimbus',
    species: 'Pteranodon',
    persona: 'Curious and wide-ranging',
    blurb: 'Soars above the details.',
    specialty: 'Big-picture thinking',
    model: 'openai/gpt-4o-mini',
    toolNames: [],
  },
  {
    id: 'custom:abc-1',
    name: 'My Custom Dino',
    species: 'Custom',
    persona: 'Helpful',
    blurb: 'User-created.',
    specialty: 'General assistance',
    model: 'openai/gpt-4o-mini',
    toolNames: [],
  },
];

const SAMPLE_LEVELS: DinoReactivityMap = {
  rexford: 'chatty',
  nimbus: 'never',
};

const meta: Meta<ReactivitySettings> = {
  title: 'UI/ReactivitySettings',
  component: ReactivitySettings,
  tags: ['autodocs'],
  argTypes: {
    levelChanged: { action: 'levelChanged' },
  },
};
export default meta;
type Story = StoryObj<ReactivitySettings>;

export const WithPresetLevels: Story = {
  args: {
    dinos: SAMPLE_DINOS,
    levels: SAMPLE_LEVELS,
  },
};

export const AllNormal: Story = {
  args: {
    dinos: SAMPLE_DINOS.slice(0, 2),
    levels: {},
  },
};

export const Empty: Story = {
  args: {
    dinos: [],
    levels: {},
  },
};

export const SingleDino: Story = {
  args: {
    dinos: [SAMPLE_DINOS[0]],
    levels: { rexford: 'rarely' },
  },
};
