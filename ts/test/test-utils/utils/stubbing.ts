import * as sinon from 'sinon';
import * as DataShape from '../../../../ts/data/data';
import { Application } from 'spectron';

const globalAny: any = global;
const sandbox = sinon.createSandbox();

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock
// tslint:disable-next-line: no-require-imports no-var-requires
const Data = require('../../../../ts/data/data');
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
export function stubWindow<K extends keyof Window>(fn: K, value: WindowValue<K>) {
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

export async function spyMessageQueueSend(app: Application) {
  await app.webContents.executeJavaScript(
    "var messageQueueSpy = sinon.spy(window.libsession.getMessageQueue(), 'send'); "
  );
}

export async function getAllMessagesSent(app: Application) {
  const messageQueueSpy = await app.webContents.executeJavaScript('messageQueueSpy.args;');
  if (!messageQueueSpy) {
    throw new Error('Be sure to call spyMessageQueueSend() on the correct app first.');
  }
  const messages = await app.webContents.executeJavaScript('messageQueueSpy.args');
  return messages;
}

export function restoreStubs() {
  globalAny.window = undefined;
  sandbox.restore();
}
