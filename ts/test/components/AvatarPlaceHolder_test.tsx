/* eslint-disable import/no-extraneous-dependencies */
import { expect } from 'chai';
import Sinon from 'sinon';
import { AvatarSize } from '../../components/avatar/Avatar';
import { AvatarPlaceHolder } from '../../components/avatar/AvatarPlaceHolder/AvatarPlaceHolder';
import { MemberAvatarPlaceHolder } from '../../components/icon/MemberAvatarPlaceHolder';
import { TestUtils } from '../test-utils';
import { areResultsEqual, findByDataTestId, renderComponent } from './renderComponent';

// TODO[epic=SES-2418] migrate to Storybook
describe('AvatarPlaceHolder', () => {
  const pubkey = TestUtils.generateFakePubKeyStr();
  const displayName = 'Hello World';

  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
  });

  it('should render an svg', async () => {
    const result = renderComponent(
      <AvatarPlaceHolder
        diameter={AvatarSize.XL}
        name={displayName}
        pubkey={pubkey}
        dataTestId="avatar-placeholder"
      />
    );

    const el = findByDataTestId(result, 'avatar-placeholder');
    expect(el, 'should not be null').to.not.equal(null);
    expect(el, 'should not be undefined').to.not.equal(undefined);
    expect(el.children, 'should not be an empty string').to.not.equal('');
    expect(el.type, 'should be an svg').to.equal('svg');
    result.unmount();
  });
  it('should render the MemberAvatarPlaceholder if we are loading or there is no hash', async () => {
    const result = renderComponent(
      <AvatarPlaceHolder
        diameter={AvatarSize.XL}
        name={displayName}
        pubkey={''} // makes the hash will be undefined
        dataTestId="avatar-placeholder"
      />
    );

    const result2 = renderComponent(
      <MemberAvatarPlaceHolder dataTestId="member-avatar-placeholder" />
    );

    expect(areResultsEqual(result, result2, true)).to.equal(true);
    result.unmount();
    result2.unmount();
  });
  it('should render the background using a color from our theme', async () => {
    const testPubkey = TestUtils.generateFakePubKeyStr();
    const result = renderComponent(
      // NOTE we need to test the pubkey to color generation and ordering with appium. Since we can't access the value of a css variable in with the current unit test setup
      <AvatarPlaceHolder
        diameter={AvatarSize.XL}
        name={displayName}
        pubkey={testPubkey}
        dataTestId="avatar-placeholder"
      />
    );

    const el = findByDataTestId(result, 'avatar-placeholder');
    const circle = el.findByType('circle');
    const colorVariable = circle.props.fill;
    expect(colorVariable, 'should have a background color if var(--primary-color)').to.equal(
      'var(--primary-color)'
    );
    result.unmount();
  });
});
