import type { Meta, StoryObj } from '@storybook/angular';
import { HistoryPanel } from './history-panel';

const meta: Meta<HistoryPanel> = {
  title: 'UI/HistoryPanel',
  component: HistoryPanel,
  tags: ['autodocs'],
  argTypes: {
    activeView: {
      control: 'inline-radio',
      options: ['chats', 'explore', 'knowledge'],
    },
  },
};
export default meta;
type Story = StoryObj<HistoryPanel>;

const now = Date.now();
const day = 24 * 60 * 60 * 1000;

const sampleSessions = [
  {
    id: 's-1',
    title: 'Pinned: Refactor the agent loop',
    pinned: true,
    createdAt: now - 5 * day,
    updatedAt: now - 2 * 60 * 60 * 1000,
    messages: [],
  },
  {
    id: 's-2',
    title: 'Why does Angular OnPush ignore my signal?',
    pinned: false,
    createdAt: now - 3 * 60 * 60 * 1000,
    updatedAt: now - 90 * 60 * 1000,
    messages: [],
  },
  {
    id: 's-3',
    title: 'Yesterday: Plan the Postgres schema',
    pinned: false,
    createdAt: now - day - 4 * 60 * 60 * 1000,
    updatedAt: now - day - 4 * 60 * 60 * 1000,
    messages: [],
  },
];

export const Empty: Story = {
  args: { sessions: [], activeSessionId: '', activeView: 'chats' },
};

export const WithSessions: Story = {
  args: {
    sessions: sampleSessions,
    activeSessionId: 's-2',
    activeView: 'chats',
  },
};

export const ExploreActive: Story = {
  args: {
    sessions: sampleSessions,
    activeSessionId: '',
    activeView: 'explore',
  },
};

export const KnowledgeActive: Story = {
  args: {
    sessions: sampleSessions,
    activeSessionId: '',
    activeView: 'knowledge',
  },
};
