import * as sinon from 'sinon';
import * as crypto from 'crypto';
import * as window from '../../window';
import * as DataShape from '../../../js/modules/data';
import { v4 as uuid } from 'uuid';

import { PubKey } from '../../../ts/session/types';
import {
  ChatMessage,
  ClosedGroupChatMessage,
  OpenGroupMessage,
} from '../../session/messages/outgoing';
import { OpenGroup } from '../../session/types/OpenGroup';

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

type ArgFunction<T> = (arg: T) => void;
type MaybePromise<T> = Promise<T> | T;

/**
 * Create a promise which waits until `done` is called or until timeout period is reached.
 * @param task The task to wait for.
 * @param timeout The timeout period.
 */
// tslint:disable-next-line: no-shadowed-variable
export async function waitForTask<T>(task: (done: ArgFunction<T>) => MaybePromise<void>, timeout: number = 2000): Promise<T> {
  const timeoutPromise = new Promise<T>((_, rej) => {
    const wait = setTimeout(() => {
      clearTimeout(wait);
      rej(new Error('Task timed out.'));
    }, timeout);
  });

  // tslint:disable-next-line: no-shadowed-variable
  const taskPromise = new Promise(async (res, rej) => {
    try {
      const taskReturn = task(res);
      return taskReturn instanceof Promise ? taskReturn : Promise.resolve(taskReturn);
    } catch (e) {
      rej(e);
    }
  });

  return Promise.race([timeoutPromise, taskPromise]) as Promise<T>;
}

/**
 * Creates a promise which periodically calls the `check` until `done` is called or until timeout period is reached.
 * @param check The check which runs every 100ms.
 * @param timeout The time before an error is thrown.
 */
// tslint:disable-next-line: no-shadowed-variable
export async function periodicallyCheck(check: (done: ArgFunction<void>) => MaybePromise<void>, timeout: number = 1000): Promise<void> {
  return waitForTask(complete => {
    let interval: NodeJS.Timeout | undefined;
    const cleanup = () => {
      if (interval) {
        clearInterval(interval);
        interval = undefined;
      }
    };
    setTimeout(cleanup, timeout);

    const onDone = () => {
      complete();
      cleanup();
    };
    interval = setInterval(async () => {
      try {
        await toPromise(check(onDone));
      } catch (e) {
        cleanup();
        throw e;
      }
    }, 100);
  }, timeout);
}

/**
 * Creates a promise which waits until `check` returns `true` or rejects if timeout preiod is reached.
 * @param check The boolean check.
 * @param timeout The time before an error is thrown.
 */
export async function waitUntil(check: () => MaybePromise<boolean>, timeout: number = 2000) {
  return periodicallyCheck(async done => {
    const result = await toPromise(check());
    if (result) {
      done();
    }
  }, timeout);
}

async function toPromise<T>(maybePromise: MaybePromise<T>): Promise<T> {
  return maybePromise instanceof Promise ? maybePromise : Promise.resolve(maybePromise);
}
