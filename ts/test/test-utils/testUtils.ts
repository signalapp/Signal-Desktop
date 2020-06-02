import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import * as DataShape from '../../../js/modules/data';
import * as window from '../../window';

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
