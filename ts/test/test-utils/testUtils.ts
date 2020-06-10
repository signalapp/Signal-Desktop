import * as sinon from 'sinon';
import * as crypto from 'crypto';
import * as window from '../../window';
import * as DataShape from '../../../js/modules/data';
import { v4 as uuid } from 'uuid';

import { ImportMock } from 'ts-mock-imports';
import { PubKey } from '../../../ts/session/types';
import {
  ChatMessage,
  OpenGroupMessage,
  ClosedGroupChatMessage,
} from '../../session/messages/outgoing';

const sandbox = sinon.createSandbox();

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock
// tslint:disable-next-line: no-require-imports no-var-requires
const Data = require('../../../js/modules/data');
type DataFunction = typeof DataShape;

/**
 * Stub a function inside Data.
 *
 * Note: This uses a custom sandbox.
 * Please call `restoreStubs()` or `stub.restore()` to restore original functionality.
 */
export function stubData(fn: keyof DataFunction): sinon.SinonStub {
  return sandbox.stub(Data, fn);
}

type WindowFunction = typeof window;

/**
 * Stub a window object.
 *
 * Note: This uses a custom sandbox.
 * Please call `restoreStubs()` or `stub.restore()` to restore original functionality.
 */
export function stubWindow<K extends keyof WindowFunction>(
  fn: K,
  replaceWith?: Partial<WindowFunction[K]>
) {
  return ImportMock.mockOther(window, fn, replaceWith);
}

export function restoreStubs() {
  ImportMock.restore();
  sandbox.restore();
}

export function generateFakePubkey(): PubKey {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `05${hexBuffer}`;

  return new PubKey(pubkeyString);
}

export function generateChatMessage(): ChatMessage {
  return new ChatMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: uuid(),
    timestamp: Date.now(),
    attachments: undefined,
    quote: undefined,
    expireTimer: undefined,
    lokiProfile: undefined,
    preview: undefined,
  });
}

export function generateClosedGroupChatMessage(): ClosedGroupChatMessage {
  const chatMessage = generateChatMessage();

  return new ClosedGroupChatMessage({
    chatMessage,
    groupId: 'example-closed-group',
  });
}

export function generateOpenGroupMessage(): OpenGroupMessage {
  const openGroup = {
    server: 'example.server',
    channel: 1,
    conversationId: '@example.server',
  };

  return new OpenGroupMessage({
    identifier: uuid(),
    timestamp: Date.now(),
    group: openGroup,
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    attachments: undefined,
    quote: undefined,
    preview: undefined,
  });
}
