import { expect } from 'chai';
import Sinon from 'sinon';
import { Data } from '../../../../ts/data/data';
import { OpenGroupData } from '../../../data/opengroups';

import * as utilWorker from '../../../webworker/workers/util_worker_interface';

const globalAny: any = global;

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock
// tslint:disable: no-require-imports no-var-requires
type DataFunction = typeof Data;
type OpenGroupDataFunction = typeof OpenGroupData;

/**
 * Stub a function inside Data.
 *
 * Note: This uses a custom sandbox.
 * Please call `restoreStubs()` or `stub.restore()` to restore original functionality.
 */
export function stubData<K extends keyof DataFunction>(fn: K): sinon.SinonStub {
  return Sinon.stub(Data, fn);
}

export function stubOpenGroupData<K extends keyof OpenGroupDataFunction>(fn: K): sinon.SinonStub {
  return Sinon.stub(OpenGroupData, fn);
}

export function stubUtilWorker(fnName: string, returnedValue: any): sinon.SinonStub {
  return Sinon.stub(utilWorker, 'callUtilsWorker')
    .withArgs(fnName as any)
    .resolves(returnedValue);
}
export function stubCreateObjectUrl() {
  // tslint:disable-next-line: no-empty no-function-expression
  (global as any).URL = function() {};
  (global as any).URL.createObjectURL = () => {
    // tslint:disable-next-line: insecure-random
    return `${Date.now()}:${Math.floor(Math.random() * 1000)}`;
  };
}

type WindowValue<K extends keyof Window> = Partial<Window[K]> | undefined;

/**
 * Stub a window object
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

export const enableLogRedirect = true;

export const stubWindowLog = () => {
  stubWindow('log', {
    // tslint:disable: no-void-expression no-console
    info: (...args: any) => (enableLogRedirect ? console.info(...args) : {}),
    warn: (...args: any) => (enableLogRedirect ? console.warn(...args) : {}),
    error: (...args: any) => (enableLogRedirect ? console.error(...args) : {}),
    debug: (...args: any) => (enableLogRedirect ? console.debug(...args) : {}),
  });
};

export async function expectAsyncToThrow(toAwait: () => Promise<any>, errorMessageToCatch: string) {
  try {
    await toAwait();
    throw new Error('fake_error');
  } catch (e) {
    expect(e.message).to.not.be.eq('fake_error');
    expect(e.message).to.be.eq(errorMessageToCatch);
  }
}
