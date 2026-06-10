import { importProvidersFrom } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import { applicationConfig, type Meta, type StoryObj } from '@storybook/angular';
import { DinoSummary } from '@org/shared-types';
import { GroupResponse } from './group-response';

const rexford: DinoSummary = {
  id: 'rexford',
  name: 'Rexford',
  species: 'Tyrannosaurus',
  persona: 'Blunt, fast, allergic to fluff.',
  blurb: 'Cuts straight to the answer. Great when you want facts without the small talk.',
  specialty: 'Fast factual answers',
  model: 'openai/gpt-4o-mini',
  toolNames: ['web_search'],
};

const veloce: DinoSummary = {
  id: 'veloce',
  name: 'Veloce',
  species: 'Velociraptor',
  persona: 'Witty, lateral thinking, loves an analogy.',
  blurb: 'Takes unexpected angles. Great for creative problems or when you are stuck.',
  specialty: 'Creative lateral thinking',
  model: 'openai/gpt-4o-mini',
  toolNames: [],
};

const meta: Meta<GroupResponse> = {
  title: 'UI/GroupResponse',
  component: GroupResponse,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(MarkdownModule.forRoot())],
    }),
  ],
};
export default meta;
type Story = StoryObj<GroupResponse>;

export const Idle: Story = {
  args: {
    dino: rexford,
    text: '',
    status: 'idle',
  },
};

export const Streaming: Story = {
  args: {
    dino: rexford,
    text: 'Recursion is when a function calls itself with a simpler version of the same prob…',
    status: 'streaming',
  },
};

export const Done: Story = {
  args: {
    dino: rexford,
    text: 'Recursion is when a function calls itself with a simpler version of the same problem until a base case is reached.\n\n```ts\nfunction factorial(n: number): number {\n  return n <= 1 ? 1 : n * factorial(n - 1);\n}\n```',
    status: 'done',
  },
};

export const Error: Story = {
  args: {
    dino: veloce,
    text: '',
    status: 'error',
    error: 'Model rate-limited — try again in a moment.',
  },
};

export const StreamingNoTokensYet: Story = {
  args: {
    dino: veloce,
    text: '',
    status: 'streaming',
  },
};

export const WithReactions: Story = {
  args: {
    dino: rexford,
    text: 'A binary search halves the range each step, so it runs in O(log n).',
    status: 'done',
    reactions: [
      { dinoId: 'veloce', emoji: '🔥' },
      { dinoId: 'philo', emoji: '👍' },
    ],
  },
};

export const RespondingTo: Story = {
  args: {
    dino: veloce,
    text: "Building on Rexford's point — there's also an interpolation-search variant worth knowing.",
    status: 'done',
    respondingToName: 'Rexford',
    reactions: [{ dinoId: 'rexford', emoji: '🤝' }],
  },
};
