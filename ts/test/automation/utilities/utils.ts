import { ElementHandle } from '@playwright/test';
import { Page } from 'playwright-core';
import { sleepFor } from '../../../session/utils/Promise';
import { DataTestId, loaderType, Strategy } from '../types/testing';
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
  maxWaitMs?: number, 
  text?: string
) {
  const builtSelector = !text
    ? `css=[${strategy}=${selector}]`
    : `css=[${strategy}=${selector}]:has-text("${text.replace(/"/g, '\\"')}")`;

  return window.waitForSelector(builtSelector, { timeout: maxWaitMs });
}

export async function waitForTextMessage(window: Page, text: string, maxWait?: number) {
  let builtSelector = `css=[data-testid=control-message]:has-text("${text}")`;
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
  console.info(`Text message found. Text: , ${text}`);
  return el;
}

export async function waitForControlMessageWithText(window: Page, text: string) {
  return waitForTestIdWithText(window, 'control-message', text);
}

export async function waitForMatchingText(window: Page, text: string, maxWait?: number) {
  const builtSelector = `css=:has-text("${text}")`;
  const maxTimeout = maxWait ?? 55000;
  console.info(`waitForMatchingText: ${text}`);

  await window.waitForSelector(builtSelector, { timeout: maxTimeout });

  console.info(`got matchingText: ${text}`);
}

export async function waitForLoadingAnimationToFinish(
  window: Page,
  loader: loaderType,
  maxWait?: number
) {
  let loadingAnimation: ElementHandle<SVGElement | HTMLElement> | undefined;

  await waitForElement(window, 'data-testid', `${loader}`, maxWait);

  do {
    try {
      loadingAnimation = await waitForElement(window, 'data-testid', `${loader}`, 100);
      await sleepFor(100);
      console.info('loading-animation was found, waiting for it to be gone');
    } catch (e) {
      loadingAnimation = undefined;
    }
  } while (loadingAnimation);
  console.info('Loading animation has finished');
}

export async function checkPathLight(window: Page, maxWait?: number) {
  let pathLight: ElementHandle<SVGElement | HTMLElement> | undefined;
  const maxWaitTime = maxWait || 100000;
  const waitPerLoop = 100;
  let start = Date.now();

  pathLight = await waitForElement(window, 'data-testid', "path-light-container", maxWait);
  let pathColor = await pathLight.getAttribute('color');

  while(pathColor === 'var(--button-path-error-color)') {
    await sleepFor(waitPerLoop) 
    pathLight = await waitForElement(window, 'data-testid', "path-light-container", maxWait);
    pathColor = await pathLight.getAttribute('color');
    start += waitPerLoop 
    if(Date.now() - start >= (maxWaitTime / 2)) {
      console.log('Path building...')
    }

    if(Date.now() - start >= maxWaitTime) { 
      throw new Error('Timed out waiting for path')
    }
  }
  console.log('Path built correctly, Yay!', pathColor)
}

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
  dataTestId: DataTestId,
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

export async function typeIntoInput(window: Page, dataTestId: DataTestId, text: string) {
  console.info(`typeIntoInput testId: ${dataTestId} : "${text}"`);
  const builtSelector = `css=[data-testid=${dataTestId}]`;
  return window.fill(builtSelector, text);
}

export async function typeIntoInputSlow(window: Page, dataTestId: DataTestId, text: string) {
  console.info(`typeIntoInput testId: ${dataTestId} : "${text}"`);
  const builtSelector = `css=[data-testid=${dataTestId}]`;
  await window.waitForSelector(builtSelector);
  return window.type(builtSelector, text, { delay: 100 });
}

export async function hasTextElementBeenDeleted(window: Page, text: string, maxWait?: number) {
  const fakeError = `Matching text: ${text} has been found... oops`;
  try {
    await waitForMatchingText(window, text, maxWait);
    throw new Error(fakeError);
  } catch (e) {
    if (e.message === fakeError) {
      throw e;
    }
  }
  console.info('Element has not been found, congratulations', text);
}

export async function doesTextIncludeString(window: Page, dataTestId: DataTestId, text: string) {
  const element = await waitForTestIdWithText(window, dataTestId);
  const el = await element.innerText();

  const builtSelector = el.includes(text);
  if (builtSelector) {
    console.info('Text found:', text);
  } else {
    throw new Error(`Text not found: , ${text}`);
  }
}

export async function hasElementBeenDeleted(
  window: Page,
  strategy: Strategy,
  selector: string,
  maxWait?: number
) {
  const fakeError = `Element ${selector} has been found... oops`;
  try {
    await waitForElement(window, strategy, selector, maxWait);
    throw new Error(fakeError);
  } catch (e) {
    if (e.message === fakeError) {
      throw e;
    }
  }
  console.info(`${selector} has not been found, congrats`);
}

export async function hasElementPoppedUpThatShouldnt(
  window: Page,
  strategy: Strategy,
  selector: string,
  text?: string
) {
  const builtSelector = !text
    ? `css=[${strategy}=${selector}]`
    : `css=[${strategy}=${selector}]:has-text("${text.replace(/"/g, '\\"')}")`;

  const fakeError = `Found ${selector}, oops..`;
  const elVisible = await window.isVisible(builtSelector);
  if (elVisible === true) {
    throw new Error(fakeError);
  }
}
