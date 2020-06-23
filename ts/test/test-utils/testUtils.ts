import * as sinon from 'sinon';
import * as crypto from 'crypto';
import * as window from '../../window';
import * as DataShape from '../../../js/modules/data';
import { v4 as uuid } from 'uuid';

import { OpenGroup, PubKey } from '../../../ts/session/types';
import {
  ChatMessage,
  ClosedGroupChatMessage,
  OpenGroupMessage,
} from '../../session/messages/outgoing';
import {
  ConversationAttributes,
} from '../../../js/models/conversation';
import { TestUtils } from '.';

const globalAny: any = global;
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
export function stubData<K extends keyof DataFunction>(fn: K): sinon.SinonStub {
  return sandbox.stub(Data, fn);
}

type WindowValue<K extends keyof Window> = Partial<Window[K]> | undefined;

/**
 * Stub a window object.
 *
 * Note: This uses a custom sandbox.
 * Please call `restoreStubs()` or `stub.restore()` to restore original functionality.
 */
export function stubWindow<K extends keyof Window>(
  fn: K,
  value: WindowValue<K>
) {
  // tslint:disable-next-line: no-typeof-undefined
  if (typeof globalAny.window === 'undefined') {
    globalAny.window = {};
  }

  const set = (newValue: WindowValue<K>) => {
    globalAny.window[fn] = newValue;
  };

  const get = () => {
    return globalAny.window[fn] as WindowValue<K>;
  };

  globalAny.window[fn] = value;

  return {
    get,
    set,
  };
}

export function restoreStubs() {
  globalAny.window = undefined;
  sandbox.restore();
}

export function generateFakePubKey(): PubKey {
  // Generates a mock pubkey for testing
  const numBytes = PubKey.PUBKEY_LEN / 2 - 1;
  const hexBuffer = crypto.randomBytes(numBytes).toString('hex');
  const pubkeyString = `05${hexBuffer}`;

  return new PubKey(pubkeyString);
}

export function generateFakePubKeys(amount: number): Array<PubKey> {
  const numPubKeys = amount > 0 ? Math.floor(amount) : 0;

  // tslint:disable-next-line: no-unnecessary-callback-wrapper
  return new Array(numPubKeys).fill(0).map(() => generateFakePubKey());
}

export function generateChatMessage(identifier?: string): ChatMessage {
  return new ChatMessage({
    body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit',
    identifier: identifier ?? uuid(),
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

export function generateClosedGroupMessage(
  groupId?: string
): ClosedGroupChatMessage {
  return new ClosedGroupChatMessage({
    identifier: uuid(),
    groupId: groupId ?? generateFakePubKey().key,
    chatMessage: generateChatMessage(),
  });
}

interface MockPrivateConversationParams {
  id?: string;
  isPrimary: boolean;
}

export class MockPrivateConversation {
  public id: string;
  public isPrimary: boolean;
  public attributes: ConversationAttributes;

  constructor(params: MockPrivateConversationParams) {
    const dayInSeconds = 86400;

    this.isPrimary = params.isPrimary;
    this.id = params.id ?? TestUtils.generateFakePubKey().key;

    this.attributes = {
      members: [],
      left: false,
      expireTimer: dayInSeconds,
      profileSharing: true,
      mentionedUs: false,
      unreadCount: 99,
      isArchived: false,
      active_at: Date.now(),
      timestamp: Date.now(),
      secondaryStatus: !this.isPrimary,
    };
  }

  public isPrivate() {
    return true;
  }

  public isOurLocalDevice() {
    return false;
  }

  public isBlocked() {
    return false;
  }

  public getPrimaryDevicePubKey() {
    return this.isPrimary ? this.id : TestUtils.generateFakePubKey().key;
  }
}
