// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { render } from 'vitest-browser-react';
import type { RenderResult } from 'vitest-browser-react';
import { TestAxoProvider } from '../AxoProvider.dom.tsx';
import type { AxoIntl } from '../_internal/AxoIntl.dom.tsx';

export type AxoTestTheme = 'light' | 'dark';

export type RenderAxoOptions = Readonly<{
  /** @default 'ltr' */
  direction?: AxoIntl.Direction;
  /** @default 'light' */
  theme?: AxoTestTheme;
}>;

/**
 * Applies the theme and direction to the document (not just the rendered
 * container) so that portalled content like menus and dialogs pick it up.
 */
export function applyDocumentEnvironment(
  theme: AxoTestTheme,
  direction: AxoIntl.Direction
): void {
  // Theme classes are styled by Tailwind, not manifest.css
  // oxlint-disable-next-line signal-desktop/enforce-class-name-has-styles
  document.body.classList.toggle('light-theme', theme === 'light');
  document.body.classList.toggle('dark-theme', theme === 'dark');
  document.documentElement.setAttribute('dir', direction);
}

/**
 * Renders `ui` wrapped in a `<TestAxoProvider>`.
 *
 * @example
 * ```tsx
 * const screen = await renderAxo(<AxoSwitch.Root ... />);
 * await screen.getByRole('switch').click();
 * ```
 */
export async function renderAxo(
  ui: ReactNode,
  options: RenderAxoOptions = {}
): Promise<RenderResult> {
  const theme = options.theme ?? 'light';
  const direction = options.direction ?? 'ltr';

  applyDocumentEnvironment(theme, direction);

  function Wrapper(props: { children: ReactNode }): ReactNode {
    return (
      <TestAxoProvider direction={direction}>{props.children}</TestAxoProvider>
    );
  }

  return render(ui, { wrapper: Wrapper });
}
