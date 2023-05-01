import { ElementHandle } from '@playwright/test';
import { Page } from 'playwright-core';
import { sleepFor } from '../../../session/utils/Promise';
import { Strategy } from '../types/testing';
// tslint:disable: no-console

// WAIT FOR FUNCTIONS

export async function waitForTestIdWithText(window: Page, dataTestId: string, text?: string) {
  let builtSelector = `css=[data-testid=${dataTestId}]`;
  if (text) {
    // " =>  \\\"
    /* prettier-ignore */
    // tslint:disable-next-line: quotemark
    const escapedText = text.replace(/"/g, '\\\"');

    builtSelector += `:has-text("${escapedText}")`;
    console.warn('builtSelector:', builtSelector);
    // console.warn('Text is tiny bubble: ', escapedText);
  }
  // console.info('looking for selector', builtSelector);
  const found = await window.waitForSelector(builtSelector, { timeout: 55000 });
  // console.info('found selector', builtSelector);

  return found;
}

export async function waitForElement(
  window: Page,
  strategy: Strategy,
  selector: string,
  maxWaitMs?: number
) {
  const builtSelector = `css=[${strategy}=${selector}]`;

  return window.waitForSelector(builtSelector, { timeout: maxWaitMs });
}

export async function waitForTextMessage(window: Page, text: string, maxWait?: number) {
  let builtSelector = `:has-text("${text}")`;
  if (text) {
    // " =>  \\\"
    /* prettier-ignore */
    // tslint:disable-next-line: quotemark
    const escapedText = text.replace(/"/g, '\\\"');

    builtSelector += `:has-text("${escapedText}")`;
    console.warn('builtSelector:', builtSelector);
    // console.warn('Text is tiny bubble: ', escapedText);
  }
  const el = await window.waitForSelector(builtSelector, { timeout: maxWait });
  return el;
}

export async function waitForControlMessageWithText(window: Page, text: string) {
  return waitForTestIdWithText(window, 'control-message', text);
}

export async function waitForMatchingText(window: Page, text: string) {
  const builtSelector = `css=:has-text("${text}")`;
  console.info(`waitForMatchingText: ${text}`);

  await window.waitForSelector(builtSelector, { timeout: 55000 });

  console.info(`got matchingText: ${text}`);
}

export async function waitForLoadingAnimationToFinish(window: Page) {
  let loadingAnimation: ElementHandle<SVGElement | HTMLElement> | undefined;

  await waitForElement(window, 'data-testid', 'loading-animation');

  do {
    try {
      loadingAnimation = await waitForElement(window, 'data-testid', 'loading-animation', 100);
      await sleepFor(100);
      console.info('loading-animation was found, waiting for it to be gone');
    } catch (e) {
      loadingAnimation = undefined;
    }
  } while (loadingAnimation);
}
console.info('Loading animation has finished');

// ACTIONS

export async function clickOnElement(
  window: Page,
  strategy: Strategy,
  selector: string,
  maxWait?: number
) {
  const builtSelector = `css=[${strategy}=${selector}]`;
  await window.waitForSelector(builtSelector, { timeout: maxWait });
  await window.click(builtSelector);
  return;
}

export async function clickOnMatchingText(window: Page, text: string, rightButton = false) {
  console.info(`clickOnMatchingText: "${text}"`);
  return window.click(`"${text}"`, rightButton ? { button: 'right' } : undefined);
}

export async function clickOnTestIdWithText(
  window: Page,
  dataTestId: string,
  text?: string,
  rightButton?: boolean
) {
  console.info(`clickOnTestIdWithText with testId:${dataTestId} and text:${text ? text : 'none'}`);

  const builtSelector = !text
    ? `css=[data-testid=${dataTestId}]`
    : `css=[data-testid=${dataTestId}]:has-text("${text}")`;

  await window.waitForSelector(builtSelector);
  return window.click(builtSelector, rightButton ? { button: 'right' } : undefined);
}

export function getMessageTextContentNow() {
  return `Test message timestamp: ${Date.now()}`;
}

export async function typeIntoInput(window: Page, dataTestId: string, text: string) {
  console.info(`typeIntoInput testId: ${dataTestId} : "${text}"`);
  const builtSelector = `css=[data-testid=${dataTestId}]`;
  return window.type(builtSelector, text);
}
