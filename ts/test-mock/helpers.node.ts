// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
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
import type { SignalService } from '../protobuf/index.std.js';
import { strictAssert } from '../util/assert.std.js';

const debug = createDebug('mock:test:helpers');

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
  additionalText: string,
  previousText: string
): Promise<void> {
  const updatedText = `${previousText}${additionalText}`;

  // Check if the element is an `input` or `[contenteditable]`
  let isInputElement = true;
  try {
    // Discard value, we're using a matcher later to assert the previous value
    await input.inputValue();
  } catch (e) {
    isInputElement = false;
  }

  if (isInputElement) {
    await expect(input).toHaveValue(previousText);
  } else {
    await expect(input).toHaveText(previousText);
  }

  await input.fill(updatedText);

  // Wait to ensure that the input (and react state controlling it) has actually
  // updated with the right value
  if (isInputElement) {
    await expect(input).toHaveValue(updatedText);
  } else {
    await expect(input).toHaveText(updatedText);
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
            destinationServiceIdBinary: getDevice(to).aciBinary,
            message: dataMessage,
            timestamp: dataMessage.timestamp,
            unidentifiedStatus: (sentTo ?? [to]).map(contact => ({
              destinationServiceIdBinary: getDevice(contact).aciBinary,
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
  sticker,
  preview,
  quote,
  desktop,
  timestamp = Date.now(),
}: {
  from: PrimaryDevice;
  to: PrimaryDevice | Device | GroupInfo;
  text: string | undefined;
  attachments?: Array<Proto.IAttachmentPointer>;
  sticker?: Proto.DataMessage.ISticker;
  preview?: Proto.IPreview;
  quote?: Proto.DataMessage.IQuote;
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
        sticker,
        preview: preview == null ? null : [preview],
        quote,
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
          targetAuthorAciBinary: getDevice(targetAuthor).aciRawUuid,
          targetSentTimestamp: Long.fromNumber(targetMessageTimestamp),
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
      e164: member.device.number,
      identityKey: member.publicKey.serialize(),
      profileKey: member.profileKey.serialize(),
      givenName: member.profileName,
    });
  }
  await phone.setStorageState(state);
  return group;
}
export function getLeftPane(page: Page): Locator {
  return page.locator('#LeftPane');
}

export async function clickOnConversationWithAci(
  page: Page,
  aci: string
): Promise<void> {
  const leftPane = getLeftPane(page);
  await leftPane.getByTestId(aci).click();
}

export async function clickOnConversation(
  page: Page,
  contact: PrimaryDevice
): Promise<void> {
  await clickOnConversationWithAci(page, contact.device.aci);
}

export async function pinContact(
  phone: PrimaryDevice,
  contact: PrimaryDevice
): Promise<void> {
  const state = await getStorageState(phone);
  state.pin(contact);
  await phone.setStorageState(state);
}

export async function acceptConversation(page: Page): Promise<void> {
  await page
    .locator('.module-message-request-actions button >> "Accept"')
    .click();

  const confirmationButton = page
    .locator('.MessageRequestActionsConfirmation')
    .getByRole('button', { name: 'Accept' });

  await confirmationButton.waitFor({
    timeout: 500,
  });

  if (await confirmationButton.isVisible()) {
    await confirmationButton.click();
  }
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

export function getTimelineMessageWithText(page: Page, text: string): Locator {
  return getTimeline(page).locator('.module-message').filter({ hasText: text });
}

export async function composerAttachImages(
  page: Page,
  filePaths: ReadonlyArray<string>
): Promise<void> {
  const AttachmentInput = page.getByTestId('attachfile-input');

  const AttachmentsList = page.locator('.module-attachments');
  const AttachmentsListImageLoaded = AttachmentsList.locator(
    '.module-image--loaded'
  );

  debug('setting input files');
  await AttachmentInput.setInputFiles(filePaths);

  debug(`waiting for ${filePaths.length} items`);
  await AttachmentsListImageLoaded.nth(filePaths.length - 1).waitFor();

  await Promise.all(
    filePaths.map(async (_, index) => {
      debug(`waiting for ${index} image to render in attachments list`);
      await AttachmentsListImageLoaded.nth(index).waitFor({
        state: 'visible',
      });
    })
  );
}

export async function sendMessageWithAttachments(
  page: Page,
  receiver: PrimaryDevice,
  text: string,
  filePaths: Array<string>
): Promise<Array<SignalService.IAttachmentPointer>> {
  await composerAttachImages(page, filePaths);

  debug('sending message');
  const input = await waitForEnabledComposer(page);
  await typeIntoInput(input, text, '');
  await input.press('Enter');

  const Message = getTimelineMessageWithText(page, text);
  const MessageImageLoaded = Message.locator('.module-image__image');

  await Message.waitFor();

  await Promise.all(
    filePaths.map(async (_, index) => {
      debug(`waiting for ${index} image to render in timeline`);
      await MessageImageLoaded.nth(index).waitFor({
        state: 'visible',
      });
    })
  );

  debug('get received message data');
  const receivedMessage = await receiver.waitForMessage();
  const attachments = receivedMessage.dataMessage.attachments ?? [];
  strictAssert(
    attachments.length === filePaths.length,
    'attachments must exist'
  );

  return attachments;
}

export async function waitForEnabledComposer(page: Page): Promise<Locator> {
  const composeArea = page.locator(
    '.composition-area-wrapper, .Inbox__conversation .ConversationView'
  );
  const composeContainer = composeArea.locator(
    '[data-testid=CompositionInput][data-enabled=true]'
  );
  await composeContainer.waitFor();

  return composeContainer.locator('.ql-editor');
}

export async function createCallLink(
  page: Page,
  {
    name,
    isAdminApprovalRequired = undefined,
  }: { name: string; isAdminApprovalRequired?: boolean | undefined }
): Promise<string | undefined> {
  await page.locator('[data-testid="NavTabsItem--Calls"]').click();
  await page.locator('.NavSidebar__HeaderTitle').getByText('Calls').waitFor();

  await page
    .locator('.CallsList__ItemTile')
    .getByText('Create a Call Link')
    .click();

  const editModal = page.locator('.CallLinkEditModal');
  await editModal.waitFor();

  if (isAdminApprovalRequired !== undefined) {
    const restrictionsInput = editModal.getByLabel('Require admin approval');
    if (isAdminApprovalRequired) {
      await expect(restrictionsInput).toHaveJSProperty('value', '0');
      await restrictionsInput.selectOption({ label: 'On' });
      await expect(restrictionsInput).toHaveJSProperty('value', '1');
    } else {
      await expect(restrictionsInput).toHaveJSProperty('value', '0');
    }
  }

  await editModal.locator('button', { hasText: 'Add call name' }).click();

  const addNameModal = page.locator('.CallLinkAddNameModal');
  await addNameModal.waitFor();

  const nameInput = addNameModal.getByLabel('Call name');
  await nameInput.fill(name);

  const saveBtn = addNameModal.getByText('Save');
  await saveBtn.click();

  await editModal.waitFor();

  const doneBtn = editModal.getByText('Done');
  await doneBtn.click();

  const callLinkTitle = await page
    .locator('.CallsList__ItemTile')
    .getByText(name);

  const callLinkItem = await page.locator('.CallsList__Item', {
    has: callLinkTitle,
  });
  const testId = await callLinkItem.getAttribute('data-testid');
  return testId || undefined;
}
