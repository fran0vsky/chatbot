import { applicationConfig } from '@angular/core';
import { importProvidersFrom } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';
import type { Meta, StoryObj } from '@storybook/angular';
import { MessageBubble } from './message-bubble';

const meta: Meta<MessageBubble> = {
  title: 'UI/MessageBubble',
  component: MessageBubble,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [importProvidersFrom(MarkdownModule.forRoot())],
    }),
  ],
};
export default meta;
type Story = StoryObj<MessageBubble>;

export const UserMessage: Story = {
  args: {
    message: { text: 'Explain quantum computing in simple terms.', role: 'user' },
  },
};

export const AssistantMessage: Story = {
  args: {
    message: {
      text: '## Quantum Computing\n\nQuantum computing uses **qubits** instead of classical bits.\n\n- Classical bits are 0 or 1\n- Qubits can be both at once (superposition)\n\n```python\nprint("Hello, quantum world!")\n```',
      role: 'assistant',
    },
  },
};

export const ErrorMessage: Story = {
  args: {
    message: { text: 'Something went wrong. Please try again.', role: 'error' },
  },
};

export const Typing: Story = {
  args: {
    message: { text: '', role: 'assistant' },
    typing: true,
  },
};

export const WithReasoning: Story = {
  args: {
    message: {
      text: '## Summary\n\nThe answer is 42.',
      role: 'assistant',
      reasoning:
        'Let me think through this carefully.\n\nFirst, I need to consider the question deeply.\nThen I will arrive at the correct conclusion.\nThe answer involves fundamental constants of the universe.',
      reasoningDurationMs: 4200,
    },
  },
};
