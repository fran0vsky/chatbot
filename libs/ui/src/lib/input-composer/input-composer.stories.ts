import type { Meta, StoryObj } from '@storybook/angular';
import { InputComposer } from './input-composer';

const meta: Meta<InputComposer> = {
  title: 'UI/InputComposer',
  component: InputComposer,
  tags: ['autodocs'],
  argTypes: {
    send: { action: 'send' },
    stop: { action: 'stop' },
    toolToggled: { action: 'toolToggled' },
    micToggle: { action: 'micToggle' },
    teachOpen: { action: 'teachOpen' },
  },
};
export default meta;
type Story = StoryObj<InputComposer>;

export const Default: Story = {
  args: {
    placeholder: 'Message',
    disabled: false,
  },
};

export const WithPlaceholder: Story = {
  args: {
    placeholder: 'Explain quantum computing in simple terms...',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Message',
    disabled: true,
  },
};

/** Shows the /teach command-menu autocomplete popover when typing a leading slash. */
export const CommandMenu: Story = {
  args: {
    placeholder: 'Message',
    disabled: false,
  },
};
