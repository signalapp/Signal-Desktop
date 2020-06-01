import * as sinon from 'sinon';
import { ImportMock } from 'ts-mock-imports';
import * as Shape from '../../../js/modules/data';

// We have to do this in a weird way because Data uses module.exports
//  which doesn't play well with sinon or ImportMock
// tslint:disable-next-line: no-require-imports no-var-requires
const Data = require('../../../js/modules/data');
type DataFunction = typeof Shape;

/**
 * Mock a function inside Data.
 *
 * Note: This uses `ImportMock` so you will have to call `ImportMock.restore()` or `stub.restore()` after each test.
 */
export function mockData(fn: keyof DataFunction, returns?: any): sinon.SinonStub {
  return ImportMock.mockFunction(Data, fn, returns);
}
