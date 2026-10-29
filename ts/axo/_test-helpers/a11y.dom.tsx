// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import axe from 'axe-core';
import { computeAccessibleName, getRole } from 'dom-accessibility-api';
import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import type { Locator } from 'vitest/browser';

/**
 * Rules that only make sense for a whole page, not for a component rendered
 * in isolation.
 */
const PAGE_LEVEL_RULES = [
  'region',
  'landmark-one-main',
  'page-has-heading-one',
  'html-has-lang',
];

function resolveElement(target: Element | Locator): Element {
  return target instanceof Element ? target : target.element();
}

/**
 * Violations that happen across many components, so they aren't listed in
 * every test's `knownViolations`.
 */
function isIgnored(rule: string, element: Element): boolean {
  if (rule === 'color-contrast') {
    // TODO: Some AxoButton variants don't have enough contrast
    return element.closest('.axo-button') != null;
  }
  if (rule === 'aria-hidden-focus') {
    // Radix hides the rest of the page while a modal layer (like a menu) is
    // open, but focus is trapped inside of the layer
    return element.closest('[data-aria-hidden]') != null;
  }
  return false;
}

const MAX_NODES_PER_VIOLATION = 5;

/** Formats axe violations as a readable report for error messages. */
export function formatAxeViolations(
  violations: ReadonlyArray<axe.Result>
): string {
  let result = '';

  for (const violation of violations) {
    if (result !== '') {
      result += '\n\n';
    }

    result += `  [${violation.id}] (${violation.impact ?? 'unknown'}) ${violation.help}\n`;
    result += `    ${violation.helpUrl}`;

    for (const node of violation.nodes.slice(0, MAX_NODES_PER_VIOLATION)) {
      result += `\n    - ${node.target.join(' ')}`;
      result += `\n      ${node.html}`;
      for (const line of (node.failureSummary ?? '').split('\n')) {
        result += `\n      ${line}`;
      }
    }

    const remaining = violation.nodes.length - MAX_NODES_PER_VIOLATION;
    if (remaining > 0) {
      result += `\n    ...and ${remaining} more`;
    }
  }

  return result;
}

/**
 * Runs axe-core against `target` and returns any WCAG 2.x A/AA violations.
 */
export async function getAxeViolations(
  target: Element | Locator = document.body
): Promise<ReadonlyArray<axe.Result>> {
  const results = await axe.run(resolveElement(target), {
    elementRef: true,
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    },
    rules: Object.fromEntries(
      PAGE_LEVEL_RULES.map(rule => [rule, { enabled: false }])
    ),
  });

  const filtered: Array<axe.Result> = [];

  for (const violation of results.violations) {
    const nodes: Array<axe.NodeResult> = [];
    for (const node of violation.nodes) {
      if (node.element == null || !isIgnored(violation.id, node.element)) {
        nodes.push(node);
      }
    }
    if (nodes.length > 0) {
      filtered.push({ ...violation, nodes });
    }
  }

  return filtered;
}

/**
 * Runs axe-core against `target` (defaults to the whole document, which
 * includes portalled content) and fails with a readable report if any WCAG
 * 2.x A/AA violations are found.
 */
export async function expectNoAxeViolations(
  target: Element | Locator = document.body,
  options: Readonly<{ disabledRules?: ReadonlyArray<string> }> = {}
): Promise<void> {
  const disabledRules = new Set(options.disabledRules ?? []);
  const violations = (await getAxeViolations(target)).filter(violation => {
    return !disabledRules.has(violation.id);
  });

  // Always asserts, so it counts towards `expect.requireAssertions`
  expect(
    violations.length > 0
      ? `Found ${violations.length} axe violation(s):\n\n${formatAxeViolations(violations)}`
      : ''
  ).toBe('');
}

/**
 * Describes an element by its role and accessible name, the same way a
 * screen reader would announce it. Useful for readable focus assertions.
 *
 * @example
 * ```tsx
 * describeElement(button) // 'button "Save"'
 * ```
 */
function describeElement(element: Element | null): string {
  if (element == null || element === document.body) {
    return '(nothing)';
  }
  const role = getRole(element) ?? element.tagName.toLowerCase();
  const name = computeAccessibleName(element);
  return name === '' ? role : `${role} "${name}"`;
}

/**
 * Describes the currently focused element.
 *
 * @example
 * expect(describeFocused()).toBe('menuitem "Reload"');
 */
export function describeFocused(): string {
  return describeElement(document.activeElement);
}

const MAX_TAB_STOPS = 50;

/**
 * Presses Tab from the current focus until focus leaves the page or returns
 * to an element it already visited, and returns a description of each
 * element that received focus.
 *
 * If focus wraps around (like in a focus trap), the last item is the
 * repeated element.
 *
 * @example
 * ```tsx
 * expect(await getTabSequence()).toEqual(['button "Cancel"', 'button "Save"']);
 *
 * // Focus trapped in a dialog, starting on "Close"
 * expect(await getTabSequence()).toEqual(['button "Save"', 'button "Close"']);
 * ```
 */
export async function getTabSequence(): Promise<Array<string>> {
  const visited = new Set<Element>();
  if (document.activeElement != null) {
    visited.add(document.activeElement);
  }

  const sequence: Array<string> = [];
  while (sequence.length < MAX_TAB_STOPS) {
    // oxlint-disable-next-line no-await-in-loop
    await userEvent.tab();
    const element = document.activeElement;
    if (element == null || element === document.body) {
      return sequence;
    }
    sequence.push(describeElement(element));
    if (visited.has(element)) {
      return sequence;
    }
    visited.add(element);
  }

  throw new Error(
    `Tab sequence has more than ${MAX_TAB_STOPS} stops:\n${sequence.join('\n')}`
  );
}
