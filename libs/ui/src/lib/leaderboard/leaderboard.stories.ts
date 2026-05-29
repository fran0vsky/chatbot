import type { Meta, StoryObj } from '@storybook/angular';
import { LeaderboardRow } from '@org/shared-types';
import { Leaderboard } from './leaderboard';

const sampleRows: LeaderboardRow[] = [
  { dinoId: 'rexford', name: 'Rexford', species: 'Tyrannosaurus', rating: 1072, wins: 5, losses: 1, draws: 0, games: 6 },
  { dinoId: 'glyphos', name: 'Glyphos', species: 'Stegosaurus', rating: 1024, wins: 3, losses: 2, draws: 1, games: 6 },
  { dinoId: 'nimbus', name: 'Nimbus', species: 'Pteranodon', rating: 1000, wins: 0, losses: 0, draws: 0, games: 0 },
  { dinoId: 'veloce', name: 'Veloce', species: 'Velociraptor', rating: 952, wins: 1, losses: 5, draws: 0, games: 6 },
];

const meta: Meta<Leaderboard> = {
  title: 'UI/Leaderboard',
  component: Leaderboard,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<Leaderboard>;

export const WithData: Story = {
  args: {
    rows: sampleRows,
  },
};

export const Empty: Story = {
  args: {
    rows: [],
  },
};

export const SingleRow: Story = {
  args: {
    rows: [sampleRows[0]],
  },
};
