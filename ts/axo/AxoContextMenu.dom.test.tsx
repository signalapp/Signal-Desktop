// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { AxoContextMenu } from './AxoContextMenu.dom.tsx';
import { renderAxo } from './_test-helpers/render.dom.tsx';
import { describeFocused } from './_test-helpers/a11y.dom.tsx';
import { testStoriesWithAxe } from './_test-helpers/stories.dom.tsx';
import * as stories from './AxoContextMenu.dom.stories.tsx';

function TestMenu(props: Readonly<{ children?: ReactNode }>): ReactNode {
  return (
    <AxoContextMenu.Root>
      <AxoContextMenu.Trigger>
        {props.children ?? <button type="button">Conversation</button>}
      </AxoContextMenu.Trigger>
      <AxoContextMenu.Content>
        <AxoContextMenu.Item onSelect={vi.fn<() => void>()}>
          Reload
        </AxoContextMenu.Item>
        <AxoContextMenu.RadioGroup
          value="tyler"
          onValueChange={vi.fn<() => void>()}
        >
          <AxoContextMenu.RadioItem value="jamie">
            Jamie
          </AxoContextMenu.RadioItem>
          <AxoContextMenu.RadioItem value="tyler">
            Tyler
          </AxoContextMenu.RadioItem>
        </AxoContextMenu.RadioGroup>
      </AxoContextMenu.Content>
    </AxoContextMenu.Root>
  );
}

// Menu content is portalled outside of the render container
const menu = page.getByRole('menu');

describe('AxoContextMenu', () => {
  testStoriesWithAxe(stories);

  describe('opens with the keyboard shortcut', () => {
    async function check(platform: string, shortcut: string) {
      vi.stubGlobal('platform', platform);
      await renderAxo(<TestMenu />);

      await userEvent.tab();
      await userEvent.keyboard(shortcut);
      await expect.element(menu).toBeVisible();
      await expect.poll(describeFocused).toBe('menuitem "Reload"');
    }

    test('on Windows', () =>
      check('win32', '{Control>}{Shift>}{F10}{/Shift}{/Control}'));

    test('on macOS', () => check('darwin', '{Meta>}{F12}{/Meta}'));
  });

  test('does not open when right clicking a link', async () => {
    await renderAxo(
      <TestMenu>
        <div>
          <a href="https://signal.org">signal.org</a>
        </div>
      </TestMenu>
    );

    await page
      .getByRole('link', { name: 'signal.org' })
      .click({ button: 'right' });
    await expect.element(menu).not.toBeInTheDocument();
  });

  test('typeahead focuses radio items', async () => {
    vi.stubGlobal('platform', 'win32');
    await renderAxo(<TestMenu />);

    await userEvent.tab();
    await userEvent.keyboard('{Control>}{Shift>}{F10}{/Shift}{/Control}');
    await expect.element(menu).toBeVisible();

    await userEvent.keyboard('J');
    await expect.poll(describeFocused).toBe('menuitemradio "Jamie"');
  });
});
