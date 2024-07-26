/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai';
import Sinon from 'sinon';
import { SessionInput } from '../../components/inputs';
import { TestUtils } from '../test-utils';
import { findAllByElementType, renderComponent } from './renderComponent';

// TODO[epic=SES-2418] migrate to Storybook
describe('SessionInput', () => {
  beforeEach(() => {
    TestUtils.stubSVGElement();
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('should render an input', async () => {
    const result = renderComponent(<SessionInput type="text" />);
    const inputElements = findAllByElementType(result, 'input');
    expect(inputElements.length, 'should have an input element').to.equal(1);
    result.unmount();
  });
});
