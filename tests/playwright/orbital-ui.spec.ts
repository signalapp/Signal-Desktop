/**
 * Orbital UI Visual Testing
 *
 * This test launches the Orbital Electron app and captures screenshots
 * for visual inspection and verification of UI components.
 */

import { test, expect, _electron as electron } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import path from 'path';

let electronApp: ElectronApplication;
let window: Page;

test.beforeAll(async () => {
  // Launch Electron app
  electronApp = await electron.launch({
    args: ['.'],
    env: {
      ...process.env,
      NODE_ENV: 'test',
    },
  });

  // Wait for the first window to open
  window = await electronApp.firstWindow();

  // Wait for app to be ready
  await window.waitForLoadState('domcontentloaded');
});

test.afterAll(async () => {
  // Close the app
  await electronApp.close();
});

test.describe('Orbital UI Screenshots', () => {
  test('capture main window', async () => {
    // Wait for the window to be visible
    await window.waitForLoadState('load');

    // Take a screenshot of the entire window
    await window.screenshot({
      path: 'test-results/screenshots/main-window.png',
      fullPage: true,
    });

    // Verify window is visible
    expect(await window.title()).toBeTruthy();
  });

  test('capture conversation list', async () => {
    // Wait for conversation list to load
    const conversationList = window.locator('[data-testid="conversation-list"], .left-pane, .ConversationList');

    if (await conversationList.count() > 0) {
      await conversationList.first().screenshot({
        path: 'test-results/screenshots/conversation-list.png',
      });
    }
  });

  test('capture orbital threading components', async () => {
    // Look for Orbital-specific threading UI elements
    const threadList = window.locator('[data-testid="orbital-thread-list"], .OrbitalThreadList');

    if (await threadList.count() > 0) {
      await threadList.first().screenshot({
        path: 'test-results/screenshots/orbital-thread-list.png',
      });
    }
  });
});

test.describe('Orbital UI Component Tests', () => {
  test('verify app loads', async () => {
    // Verify the window exists and has a title
    const title = await window.title();
    expect(title).toBeTruthy();
  });

  test('check for main navigation', async () => {
    // Check for common UI elements
    const body = await window.locator('body');
    expect(await body.isVisible()).toBe(true);
  });
});
