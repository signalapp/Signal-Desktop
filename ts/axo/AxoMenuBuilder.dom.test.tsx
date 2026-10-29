// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { AxoMenuBuilder } from './AxoMenuBuilder.dom.tsx';
import { AxoButton } from './AxoButton.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoMenuBuilder.dom.stories.tsx';

type TestMenuProps = Readonly<{
  renderer: AxoMenuBuilder.Renderer;
  onReply?: () => void;
}>;

function TestMenu(props: TestMenuProps): ReactNode {
  return (
    <AxoMenuBuilder.Root renderer={props.renderer}>
      <AxoMenuBuilder.Trigger>
        <AxoButton.Root variant="strong-secondary" size="md">
          Message
        </AxoButton.Root>
      </AxoMenuBuilder.Trigger>
      <AxoMenuBuilder.Content>
        <AxoMenuBuilder.Item symbol="reply" onSelect={() => props.onReply?.()}>
          Reply
        </AxoMenuBuilder.Item>
        <AxoMenuBuilder.Item disabled onSelect={vi.fn()}>
          Forward
        </AxoMenuBuilder.Item>
        <AxoMenuBuilder.Separator />
        <AxoMenuBuilder.Sub>
          <AxoMenuBuilder.SubTrigger>More</AxoMenuBuilder.SubTrigger>
          <AxoMenuBuilder.SubContent>
            <AxoMenuBuilder.Item onSelect={vi.fn()}>Info</AxoMenuBuilder.Item>
          </AxoMenuBuilder.SubContent>
        </AxoMenuBuilder.Sub>
        <AxoMenuBuilder.Group>
          <AxoMenuBuilder.Label>Options</AxoMenuBuilder.Label>
          <AxoMenuBuilder.CheckboxItem checked onCheckedChange={vi.fn()}>
            Pin
          </AxoMenuBuilder.CheckboxItem>
          <AxoMenuBuilder.RadioGroup value="a" onValueChange={vi.fn()}>
            <AxoMenuBuilder.RadioItem value="a">A</AxoMenuBuilder.RadioItem>
            <AxoMenuBuilder.RadioItem value="b">B</AxoMenuBuilder.RadioItem>
          </AxoMenuBuilder.RadioGroup>
        </AxoMenuBuilder.Group>
      </AxoMenuBuilder.Content>
    </AxoMenuBuilder.Root>
  );
}

const menu = page.getByRole('menu');
const trigger = page.getByRole('button', {
  name: 'Message',
  includeHidden: true,
});

describe('AxoMenuBuilder', () => {
  testStoriesWithAxe(stories);

  test('AxoDropdownMenu renderer opens on click', async () => {
    await renderAxo(<TestMenu renderer="AxoDropdownMenu" />);

    await trigger.click();
    await expect.element(menu).toMatchAriaInlineSnapshot(`
      - menu "Message":
        - menuitem "Reply"
        - menuitem "Forward" [disabled]
        - separator
        - menuitem "More"
        - group:
          - text: Options
          - menuitemcheckbox "Pin" [checked]
          - group:
            - menuitemradio "A" [checked]
            - menuitemradio "B"
    `);
  });

  test('AxoContextMenu renderer opens on right click', async () => {
    const onReply = vi.fn();
    await renderAxo(<TestMenu renderer="AxoContextMenu" onReply={onReply} />);

    await trigger.click();
    await expect.element(menu).not.toBeInTheDocument();

    await trigger.click({ button: 'right' });
    await menu.getByRole('menuitem', { name: 'Reply' }).click();
    expect(onReply).toHaveBeenCalledOnce();
  });
});
