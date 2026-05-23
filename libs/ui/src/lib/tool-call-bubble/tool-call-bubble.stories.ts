import type { Meta, StoryObj } from '@storybook/angular';
import { ToolCallBubble } from './tool-call-bubble';

const meta: Meta<ToolCallBubble> = {
  title: 'UI/ToolCallBubble',
  component: ToolCallBubble,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<ToolCallBubble>;

export const GetCurrentTime: Story = {
  args: {
    message: {
      text: '',
      role: 'tool',
      toolName: 'get_current_time',
      toolArgs: {},
      toolResult: '2026-05-23T14:32:11Z (2026-05-23 14:32 UTC)',
    },
  },
};

export const WebSearch: Story = {
  args: {
    message: {
      text: '',
      role: 'tool',
      toolName: 'web_search',
      toolArgs: { query: 'latest LangGraph release' },
      toolResult:
        '• LangGraph 0.4 released with improved tool calling support\n• New ToolNode prebuilt component simplifies graph construction',
    },
  },
};

export const Empty: Story = {
  args: {
    message: {
      text: '',
      role: 'tool',
      toolName: 'web_search',
      toolArgs: { query: 'asdfqwerzxcv' },
      toolResult: 'No results found for: asdfqwerzxcv',
    },
  },
};
