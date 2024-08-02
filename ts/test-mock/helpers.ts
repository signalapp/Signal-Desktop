// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type Device,
  type Group,
  PrimaryDevice,
  type Proto,
  StorageState,
} from '@signalapp/mock-server';
import { assert } from 'chai';
import Long from 'long';
import type { Locator, Page } from 'playwright';
import { expect } from 'playwright/test';

export function bufferToUuid(buffer: Buffer): string {
  const hex = buffer.toString('hex');

  return [
    hex.substring(0, 8),
    hex.substring(8, 12),
    hex.substring(12, 16),
    hex.substring(16, 20),
    hex.substring(20),
  ].join('-');
}

export async function typeIntoInput(
  input: Locator,
  text: string
): Promise<void> {
  let currentValue = '';
  let isInputElement = true;

  try {
    currentValue = await input.inputValue();
  } catch (e) {
    isInputElement = false;
    // if input is actually not an input (e.g. contenteditable)
    currentValue = (await input.textContent()) ?? '';
  }

  const newValue = `${currentValue}${text}`;

  await input.fill(newValue);

  // Wait to ensure that the input (and react state controlling it) has actually
  // updated with the right value
  if (isInputElement) {
    await expect(input).toHaveValue(newValue);
  } else {
    await input.locator(`:text("${newValue}")`).waitFor();
  }
}

export async function expectItemsWithText(
  items: Locator,
  expected: ReadonlyArray<string | RegExp>
): Promise<void> {
  // Wait for each message to appear in case they're not all there yet
  for (const [index, message] of expected.entries()) {
    const nth = items.nth(index);
    // eslint-disable-next-line no-await-in-loop
    await nth.waitFor();
    // eslint-disable-next-line no-await-in-loop
    const text = await nth.innerText();
    const log = `Expect item at index ${index} to match`;
    if (typeof message === 'string') {
      assert.strictEqual(text, message, log);
    } else {
      assert.match(text, message, log);
    }
  }

  const innerTexts = await items.allInnerTexts();
  assert.deepEqual(
    innerTexts.length,
    expected.length,
    `Expect correct number of items\nActual:\n${innerTexts
      .map(text => `  - "${text}"\n`)
      .join('')}\nExpected:\n${expected
      .map(text => `  - ${text.toString()}\n`)
      .join('')}`
  );
}

export async function expectSystemMessages(
  context: Page | Locator,
  expected: ReadonlyArray<string | RegExp>
): Promise<void> {
  await expectItemsWithText(
    context.locator('.SystemMessage__contents'),
    expected
  );
}

function getDevice(author: PrimaryDevice | Device): Device {
  return author instanceof PrimaryDevice ? author.device : author;
}

type GroupInfo = {
  group: Group;
  members: Array<PrimaryDevice>;
};

function maybeWrapInSyncMessage({
  isSync,
  to,
  sentTo,
  dataMessage,
}: {
  isSync: boolean;
  to: PrimaryDevice | Device;
  sentTo?: Array<PrimaryDevice | Device>;
  dataMessage: Proto.IDataMessage;
}): Proto.IContent {
  return isSync
    ? {
        syncMessage: {
          sent: {
            destinationServiceId: getDevice(to).aci,
            message: dataMessage,
            timestamp: dataMessage.timestamp,
            unidentifiedStatus: (sentTo ?? [to]).map(contact => ({
              destinationServiceId: getDevice(contact).aci,
              destination: getDevice(contact).number,
            })),
          },
        },
      }
    : { dataMessage };
}

function isToGroup(to: Device | PrimaryDevice | GroupInfo): to is GroupInfo {
  return 'group' in to;
}

export function sendTextMessage({
  from,
  to,
  text,
  attachments,
  desktop,
  timestamp = Date.now(),
}: {
  from: PrimaryDevice;
  to: PrimaryDevice | Device | GroupInfo;
  text: string;
  attachments?: Array<Proto.IAttachmentPointer>;
  desktop: Device;
  timestamp?: number;
}): Promise<void> {
  const isSync = from.secondaryDevices.includes(desktop);
  const toDevice = isSync || isToGroup(to) ? desktop : getDevice(to);
  const groupInfo = isToGroup(to) ? to : undefined;
  return from.sendRaw(
    toDevice,
    maybeWrapInSyncMessage({
      isSync,
      to: to as PrimaryDevice,
      dataMessage: {
        body: text,
        attachments,
        timestamp: Long.fromNumber(timestamp),
        groupV2: groupInfo
          ? {
              masterKey: groupInfo.group.masterKey,
              revision: groupInfo.group.revision,
            }
          : undefined,
      },
      sentTo: groupInfo ? groupInfo.members : [to as PrimaryDevice | Device],
    }),
    { timestamp }
  );
}

export function sendReaction({
  from,
  to,
  targetAuthor,
  targetMessageTimestamp,
  emoji = '👍',
  reactionTimestamp = Date.now(),
  desktop,
}: {
  from: PrimaryDevice;
  to: PrimaryDevice | Device;
  targetAuthor: PrimaryDevice | Device;
  targetMessageTimestamp: number;
  emoji: string;
  reactionTimestamp?: number;
  desktop: Device;
}): Promise<void> {
  const isSync = from.secondaryDevices.includes(desktop);
  return from.sendRaw(
    isSync ? desktop : getDevice(to),
    maybeWrapInSyncMessage({
      isSync,
      to,
      dataMessage: {
        timestamp: Long.fromNumber(reactionTimestamp),
        reaction: {
          emoji,
          targetAuthorAci: getDevice(targetAuthor).aci,
          targetTimestamp: Long.fromNumber(targetMessageTimestamp),
        },
      },
    }),
    {
      timestamp: reactionTimestamp,
    }
  );
}

async function getStorageState(phone: PrimaryDevice) {
  return (await phone.getStorageState()) ?? StorageState.getEmpty();
}

export async function createGroup(
  phone: PrimaryDevice,
  otherMembers: Array<PrimaryDevice>,
  groupTitle: string
): Promise<Group> {
  const group = await phone.createGroup({
    title: groupTitle,
    members: [phone, ...otherMembers],
  });
  let state = await getStorageState(phone);

  state = state
    .addGroup(group, {
      whitelisted: true,
    })
    .pinGroup(group);

  // Finally whitelist and pin contacts
  for (const member of otherMembers) {
    state = state.addContact(member, {
      whitelisted: true,
      serviceE164: member.device.number,
      identityKey: member.publicKey.serialize(),
      profileKey: member.profileKey.serialize(),
      givenName: member.profileName,
    });
  }
  await phone.setStorageState(state);
  return group;
}

export async function clickOnConversation(
  page: Page,
  contact: PrimaryDevice
): Promise<void> {
  const leftPane = page.locator('#LeftPane');
  await leftPane.getByTestId(contact.device.aci).click();
}
export async function pinContact(
  phone: PrimaryDevice,
  contact: PrimaryDevice
): Promise<void> {
  const state = await getStorageState(phone);
  state.pin(contact);
  await phone.setStorageState(state);
}

export function acceptConversation(page: Page): Promise<void> {
  return page
    .locator('.module-message-request-actions button >> "Accept"')
    .click();
}

export function getTimeline(page: Page): Locator {
  return page.locator('.module-timeline__messages__container');
}

export function getMessageInTimelineByTimestamp(
  page: Page,
  timestamp: number
): Locator {
  return getTimeline(page).getByTestId(`${timestamp}`);
}
