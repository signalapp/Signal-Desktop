import * as sinon from 'sinon';
import * as crypto from 'crypto';
import * as window from '../../window';
import * as DataShape from '../../../js/modules/data';
import { v4 as uuid } from 'uuid';

import { PubKey } from '../../../ts/session/types';
import { ChatMessage } from '../../session/messages/outgoing';

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
export function stubData(fn: keyof DataFunction): sinon.SinonStub {
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
