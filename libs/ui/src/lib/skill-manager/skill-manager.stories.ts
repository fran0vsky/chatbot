import type { Meta, StoryObj } from '@storybook/angular';
import { DinoSkill } from '@org/shared-types';
import { SkillManager } from './skill-manager';

const skills: DinoSkill[] = [
  { id: 's1', title: 'British English', instruction: 'Always answer in British English.', whenToActivate: 'When the user asks a factual question' },
  { id: 's2', title: 'Cite sources', instruction: 'End factual answers with a short source list.' },
];

const memories = [
  { id: 'm1', content: 'Building a dino chat app called SpinoChat.' },
  { id: 'm2', content: 'Prefers concise, no-fluff answers.' },
];

const meta: Meta<SkillManager> = {
  title: 'UI/SkillManager',
  component: SkillManager,
  tags: ['autodocs'],
  argTypes: {
    skillDeleted: { action: 'skillDeleted' },
    memoryDeleted: { action: 'memoryDeleted' },
    skillEdited: { action: 'skillEdited' },
  },
};
export default meta;
type Story = StoryObj<SkillManager>;

export const Populated: Story = {
  args: { skills, memories },
};

export const Empty: Story = {
  args: { skills: [], memories: [] },
};

export const SkillsOnly: Story = {
  args: { skills, memories: [] },
};
