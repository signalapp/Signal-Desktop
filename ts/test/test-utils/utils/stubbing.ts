import * as sinon from 'sinon';
import * as crypto from 'crypto';
import * as DataShape from '../../../../js/modules/data';

const globalAny: any = global;
const sandbox = sinon.createSandbox();

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock
// tslint:disable-next-line: no-require-imports no-var-requires
const Data = require('../../../../js/modules/data');
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
