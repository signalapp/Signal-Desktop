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
import { OpenGroup } from '../../session/types/OpenGroup';

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

export function generateOpenGroupMessage(): OpenGroupMessage {
  const group = new OpenGroup({
    server: 'chat.example.server',
    channel: 0,
    conversationId: '0',
  });

  return new OpenGroupMessage({
    timestamp: Date.now(),
    group,
    attachments: undefined,
    preview: undefined,
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    quote: undefined,
  });
}

export function generateClosedGroupMessage(): ClosedGroupChatMessage {
  return new ClosedGroupChatMessage({
    identifier: uuid(),
    groupId: generateFakePubkey().key,
    chatMessage: generateChatMessage(),
  });
}

export function generateMemberList(size: number): Array<PubKey> {
  const numMembers = Math.floor(size);

  return numMembers > 0
    ? Array.from({ length: numMembers }, generateFakePubkey)
    : [];
}
