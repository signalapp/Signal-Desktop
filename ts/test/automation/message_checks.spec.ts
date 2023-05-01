import { test } from '@playwright/test';
import { sleepFor } from '../../session/utils/Promise';
import { beforeAllClean } from './setup/beforeEach';
import { newUser } from './setup/new_user';
import { openApp } from './setup/open';
import { createContact } from './utilities/create_contact';
import { replyTo } from './utilities/reply_message';
import {
  clickOnMatchingText,
  clickOnTestIdWithText,
  typeIntoInput,
  waitForLoadingAnimationToFinish,
} from './utilities/utils';

test.beforeEach(beforeAllClean);

test('Send image and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const testMessage = `${userA.userName} sending image to ${userB.userName}`;
  const testReply = `${userB.userName} replying to image from ${userA.userName}`;
  await createContact(windowA, windowB, userA, userB);

  await windowA.setInputFiles("input[type='file']", 'ts/test/automation/fixtures/test-image.png');
  await typeIntoInput(windowA, 'message-input-text-area', testMessage);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  // Click on untrusted attachment in window B
  await sleepFor(1000);
  await clickOnMatchingText(windowB, 'Click to download media');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button');
  await waitForLoadingAnimationToFinish(windowB);
  // Waiting for image to change from loading state to loaded (takes a second)
  await sleepFor(1000);

  await replyTo(windowB, testMessage, testReply);
});

test('Send video and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const testMessage = `${userA.userName} sending video to ${userB.userName}`;
  const testReply = `${userB.userName} replying to video from ${userA.userName}`;
  await createContact(windowA, windowB, userA, userB);

  await windowA.setInputFiles("input[type='file']", 'ts/test/automation/fixtures/test-video.mp4');
  await typeIntoInput(windowA, 'message-input-text-area', testMessage);
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await clickOnMatchingText(windowB, 'Click to download media');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button');
  await waitForLoadingAnimationToFinish(windowB);
  // Waiting for videoto change from loading state to loaded (takes a second)
  await sleepFor(1000);
  await replyTo(windowB, testMessage, testReply);
});

test('Send document and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const testMessage = `${userA.userName} sending document to ${userB.userName}`;
  const testReply = `${userB.userName} replying to document from ${userA.userName}`;
  await createContact(windowA, windowB, userA, userB);

  await windowA.setInputFiles("input[type='file']", 'ts/test/automation/fixtures/test-file.pdf');
  await typeIntoInput(windowA, 'message-input-text-area', testMessage);
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await clickOnMatchingText(windowB, 'Click to download media');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button');
  await waitForLoadingAnimationToFinish(windowB);
  // Waiting for videoto change from loading state to loaded (takes a second)
  await sleepFor(1000);
  await replyTo(windowB, testMessage, testReply);
});

test('Send voice message and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // const testReply = `${userB.userName} to ${userA.userName}`;
  await createContact(windowA, windowB, userA, userB);

  await clickOnTestIdWithText(windowA, 'microphone-button');
  await clickOnTestIdWithText(windowA, 'session-toast');
  await clickOnTestIdWithText(windowA, 'enable-microphone');
  await clickOnTestIdWithText(windowA, 'message-section');
  await clickOnTestIdWithText(windowA, 'microphone-button');
  await sleepFor(5000);
  await clickOnTestIdWithText(windowA, 'end-voice-message');
  await sleepFor(4000);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await clickOnMatchingText(windowB, 'Click to download media');
  await clickOnTestIdWithText(windowB, 'session-confirm-ok-button');
});

test('Send GIF and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  // const testReply = `${userB.userName} to ${userA.userName}`;
  await createContact(windowA, windowB, userA, userB);

  await windowA.setInputFiles("input[type='file']", 'ts/test/automation/fixtures/test-gif.gif');
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await clickOnMatchingText(windowB, 'Click to download media');
});

test('Send long text and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);

  const testReply = `${userB.userName} replying to long text message from ${userA.userName}`;
  const longText =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum quis lacinia mi. Praesent fermentum vehicula rhoncus. Aliquam ac purus lobortis, convallis nisi quis, pulvinar elit. Nam commodo eros in molestie lobortis. Donec at mattis est. In tempor ex nec velit mattis, vitae feugiat augue maximus. Nullam risus libero, bibendum et enim et, viverra viverra est. Suspendisse potenti. Sed ut nibh in sem rhoncus suscipit. Etiam tristique leo sit amet ullamcorper dictum. Suspendisse sollicitudin, lectus et suscipit eleifend, libero dui ultricies neque, non elementum nulla orci bibendum lorem. Suspendisse potenti. Aenean a tellus imperdiet, iaculis metus quis, pretium diam. Nunc varius vitae enim vestibulum interdum. In hac habitasse platea dictumst. Donec auctor sem quis eleifend fermentum. Vestibulum neque nulla, maximus non arcu gravida, condimentum euismod turpis. Cras ac mattis orci. Quisque ac enim pharetra felis sodales eleifend. Aliquam erat volutpat. Donec sit amet mollis nibh, eget feugiat ipsum. Integer vestibulum purus ac suscipit egestas. Duis vitae aliquet ligula.';

  await createContact(windowA, windowB, userA, userB);

  await typeIntoInput(windowA, 'message-input-text-area', longText);
  await sleepFor(100);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await replyTo(windowB, longText, testReply);
});

test('Send link and reply test', async () => {
  const [windowA, windowB] = await openApp(2);
  const [userA, userB] = await Promise.all([newUser(windowA, 'Alice'), newUser(windowB, 'Bob')]);
  const testMessage = 'https://nerdlegame.com/';
  const testReply = `${userB.userName} replying to link from ${userA.userName}`;

  await createContact(windowA, windowB, userA, userB);

  await typeIntoInput(windowA, 'message-input-text-area', testMessage);
  await sleepFor(5000);
  await clickOnTestIdWithText(windowA, 'send-message-button');
  await sleepFor(1000);
  await replyTo(windowB, testMessage, testReply);
});

// Send link
// Send long text
// Unsend
// Delete message
