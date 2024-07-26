/* eslint-disable func-names */
import { expect } from 'chai';
import Sinon from 'sinon';
import { ConfigDumpData } from '../../../data/configDump/configDump';
import { Data } from '../../../data/data';
import { OpenGroupData } from '../../../data/opengroups';

import { load } from '../../../node/locale';
import { setupi18n } from '../../../util/i18n';
import * as libsessionWorker from '../../../webworker/workers/browser/libsession_worker_interface';
import * as utilWorker from '../../../webworker/workers/browser/util_worker_interface';

const globalAny: any = global;

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock

type DataFunction = typeof Data;
type OpenGroupDataFunction = typeof OpenGroupData;
type ConfigDumpDataFunction = typeof ConfigDumpData;

export type TypedStub<T extends Record<string, unknown>, K extends keyof T> = T[K] extends (
  ...args: any
) => any
  ? Sinon.SinonStub<Parameters<T[K]>, ReturnType<T[K]>>
  : never;

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

export function stubConfigDumpData<K extends keyof ConfigDumpDataFunction>(fn: K): sinon.SinonStub {
  return Sinon.stub(ConfigDumpData, fn);
}

export function stubUtilWorker(fnName: string, returnedValue: any): sinon.SinonStub {
  return Sinon.stub(utilWorker, 'callUtilsWorker')
    .withArgs(fnName as any)
    .resolves(returnedValue);
}

export function stubLibSessionWorker(value: any) {
  Sinon.stub(libsessionWorker, 'callLibSessionWorker').resolves(value);
}

export function stubCreateObjectUrl() {
  (global as any).URL = function () {};
  (global as any).URL.createObjectURL = () => {
    return `${Date.now()}:${Math.floor(Math.random() * 1000)}`;
  };
}

type WindowValue<K extends keyof Window> = Partial<Window[K]> | undefined;

/**
 * Stub a window object
 */
export function stubWindow<K extends keyof Window>(fn: K, value: WindowValue<K>) {
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

/**
 * Resolves "SVGElement is undefined error" in motion components by making JSDOM treat SVG elements as regular DOM elements
 * @link https://github.com/jsdom/jsdom/issues/2734#issuecomment-569416871
 * */
export function stubSVGElement() {
  if (!globalAny.SVGElement) {
    globalAny.SVGElement = globalAny.Element;
  }
}

export const enableLogRedirect = false;

export const stubWindowLog = () => {
  stubWindow('log', {
    info: (...args: any) => (enableLogRedirect ? console.info(...args) : {}),
    warn: (...args: any) => (enableLogRedirect ? console.warn(...args) : {}),
    error: (...args: any) => (enableLogRedirect ? console.error(...args) : {}),
    debug: (...args: any) => (enableLogRedirect ? console.debug(...args) : {}),
  });
};

export const stubWindowFeatureFlags = () => {
  stubWindow('sessionFeatureFlags', { debug: {} } as any);
};

export const stubWindowWhisper = () => {
  stubWindow('Whisper', {
    events: {
      on: (name: string, callback: (param1?: any, param2?: any) => void) => {
        if (enableLogRedirect) {
          console.info(`Whisper Event registered ${name} ${callback}`);
        }
        callback();
      },
      trigger: (name: string, param1?: any, param2?: any) =>
        enableLogRedirect
          ? console.info(`Whisper Event triggered ${name} ${param1} ${param2}`)
          : {},
    },
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

/** You must call stubWindowLog() before using */
export const stubI18n = () => {
  const locale = load({ appLocale: 'en', logger: window.log });
  stubWindow('i18n', setupi18n('en', locale.messages));
};
