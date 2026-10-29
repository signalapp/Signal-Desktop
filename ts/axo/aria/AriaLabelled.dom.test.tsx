// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { AriaLabelled } from './AriaLabelled.dom.tsx';
import { renderAxo } from '../_test-helpers/render.dom.tsx';
import { testStoriesWithAxe } from '../_test-helpers/stories.dom.tsx';
import * as stories from './AriaLabelled.dom.stories.tsx';

function expectIdRefsToExist(element: Element, attribute: string): void {
  const ids = (element.getAttribute(attribute) ?? '').split(' ');
  for (const id of ids) {
    expect(document.getElementById(id), `#${id}`).not.toBeNull();
  }
}

describe('AriaLabelled', () => {
  testStoriesWithAxe(stories);

  test('uses the `id` props when given', async () => {
    const screen = await renderAxo(
      <AriaLabelled.Root>
        <AriaLabelled.Target asChild id="root">
          <div role="figure">
            <AriaLabelled.Label asChild id="label">
              <h2>Label</h2>
            </AriaLabelled.Label>
            <AriaLabelled.Description asChild id="description">
              <p>Description</p>
            </AriaLabelled.Description>
          </div>
        </AriaLabelled.Target>
      </AriaLabelled.Root>
    );
    const figure = screen.getByRole('figure');

    await expect.element(figure).toHaveAttribute('id', 'root');
    await expect.element(figure).toHaveAttribute('aria-labelledby', 'label');
    await expect
      .element(figure)
      .toHaveAttribute('aria-describedby', 'description');
    await expect
      .element(screen.getByRole('heading'))
      .toHaveAttribute('id', 'label');
  });

  test('is labelled and described by its children', async () => {
    const screen = await renderAxo(
      <AriaLabelled.Root>
        <AriaLabelled.Target asChild>
          <div role="figure">
            <AriaLabelled.Label>First</AriaLabelled.Label>
            <AriaLabelled.Label>Second</AriaLabelled.Label>
            <AriaLabelled.Description>One</AriaLabelled.Description>
            <AriaLabelled.Description>Two</AriaLabelled.Description>
          </div>
        </AriaLabelled.Target>
      </AriaLabelled.Root>
    );
    const figure = screen.getByRole('figure');

    await expect.element(figure).toHaveAccessibleName('First Second');
    await expect.element(figure).toHaveAccessibleDescription('One Two');
    expectIdRefsToExist(figure.element(), 'aria-labelledby');
    expectIdRefsToExist(figure.element(), 'aria-describedby');
  });

  test('combines the `description` prop with description children', async () => {
    const screen = await renderAxo(
      <AriaLabelled.Root>
        <AriaLabelled.Target asChild label="Label" description="Prefix">
          <div role="figure">
            <AriaLabelled.Description>Description</AriaLabelled.Description>
          </div>
        </AriaLabelled.Target>
      </AriaLabelled.Root>
    );
    const figure = screen.getByRole('figure');

    await expect.element(figure).toHaveAccessibleName('Label');
    await expect
      .element(figure)
      .toHaveAccessibleDescription('Prefix Description');
    expectIdRefsToExist(figure.element(), 'aria-describedby');
  });

  test('keeps the id of the child without an `id` prop', async () => {
    const screen = await renderAxo(
      <AriaLabelled.Root>
        <AriaLabelled.Target asChild label="Prefix">
          <div role="figure" id="child">
            <AriaLabelled.Label>Label</AriaLabelled.Label>
          </div>
        </AriaLabelled.Target>
      </AriaLabelled.Root>
    );
    const figure = screen.getByRole('figure');

    await expect.element(figure).toHaveAttribute('id', 'child');
    await expect.element(figure).toHaveAccessibleName('Prefix Label');
    expectIdRefsToExist(figure.element(), 'aria-labelledby');
  });

  function Toggleable(): ReactNode {
    const [showSecond, setShowSecond] = useState(true);
    return (
      <AriaLabelled.Root>
        <AriaLabelled.Target asChild>
          <div role="figure">
            <AriaLabelled.Label>First</AriaLabelled.Label>
            {showSecond && <AriaLabelled.Label>Second</AriaLabelled.Label>}
            <button type="button" onClick={() => setShowSecond(false)}>
              Remove
            </button>
          </div>
        </AriaLabelled.Target>
      </AriaLabelled.Root>
    );
  }

  test('updates when labels are removed', async () => {
    const screen = await renderAxo(<Toggleable />);
    const figure = screen.getByRole('figure');

    await expect.element(figure).toHaveAccessibleName('First Second');
    await screen.getByRole('button', { name: 'Remove' }).click();
    await expect.element(figure).toHaveAccessibleName('First');
    expectIdRefsToExist(figure.element(), 'aria-labelledby');
  });
});
