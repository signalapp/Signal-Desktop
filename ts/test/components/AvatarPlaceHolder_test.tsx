/* eslint-disable import/no-extraneous-dependencies */
import chai, { expect } from 'chai';
import chaiDom from 'chai-dom';
import Sinon from 'sinon';
import { AvatarSize } from '../../components/avatar/Avatar';
import { AvatarPlaceHolder } from '../../components/avatar/AvatarPlaceHolder/AvatarPlaceHolder';
import { MemberAvatarPlaceHolder } from '../../components/icon/MemberAvatarPlaceHolder';
import { COLORS } from '../../themes/constants/colors';
import { TestUtils } from '../test-utils';
import { cleanup, renderComponent, waitFor } from './renderComponent';

chai.use(chaiDom);

describe('AvatarPlaceHolder', () => {
  const pubkey = TestUtils.generateFakePubKeyStr();
  const displayName = 'Hello World';

  beforeEach(() => {
    TestUtils.stubWindowLog();
  });

  afterEach(() => {
    Sinon.restore();
    cleanup();
  });

  it('should render an svg', async () => {
    // TODO[epic=ses-968] Fix warnings that appear when we run this test.
    const result = renderComponent(
      <AvatarPlaceHolder
        diameter={AvatarSize.XL}
        name={displayName}
        pubkey={pubkey}
        dataTestId="avatar-placeholder"
      />
    );

    // calculating the hash and initials needs to be done first
    await waitFor(() => {
      result.getByText('HW');
    });

    const el = result.getByTestId('avatar-placeholder');
    expect(el.outerHTML, 'should not be null').to.not.equal(null);
    expect(el.outerHTML, 'should not be undefined').to.not.equal(undefined);
    expect(el.outerHTML, 'should not be an empty string').to.not.equal('');
    expect(el.tagName, 'should be an svg').to.equal('svg');
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
    const el = result.getByTestId('avatar-placeholder');

    const result2 = renderComponent(
      <MemberAvatarPlaceHolder dataTestId="member-avatar-placeholder" />
    );
    const el2 = result2.getByTestId('member-avatar-placeholder');

    // The data test ids are different so we don't use the outerHTML for comparison
    expect(el.innerHTML).to.equal(el2.innerHTML);
    result.unmount();
  });
  it('should render the background color using the primary colors in the correct order', async () => {
    const testPubkeys = [
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382fc', // green
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382fa', // blue
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382fd', // yellow
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382ff', // pink
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382ed', // purple
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382f9', // orange
      '0541214ef26572066f0535140b1d6d021218299321c6001e2cdcaaa8cd5c9382eb', // red
    ];

    // NOTE we can trust the order of Object.keys and Object.values to be correct since our typescript build target is 'esnext'
    const primaryColorKeys = Object.keys(COLORS.PRIMARY);
    const primaryColorValues = Object.values(COLORS.PRIMARY);

    async function testBackgroundColor(testPubkey: string, expectedColorValue: string) {
      const result = renderComponent(
        <AvatarPlaceHolder
          diameter={AvatarSize.XL}
          name={displayName}
          pubkey={testPubkey}
          dataTestId="avatar-placeholder"
        />
      );

      // calculating the hash and initials needs to be done first
      await waitFor(() => {
        result.getByText('HW');
      });

      const el = result.getByTestId('avatar-placeholder');
      const circle = el.querySelector('circle');
      const circleColor = circle?.getAttribute('fill');
      expect(circleColor, 'background color should not be null').to.not.equal(null);
      expect(circleColor, 'background color should not be undefined').to.not.equal(undefined);
      expect(circleColor, 'background color should not be an empty string').to.not.equal('');
      expect(
        primaryColorValues.includes(circleColor!),
        'background color should be in COLORS.PRIMARY'
      ).to.equal(true);
      expect(
        circleColor,
        `background color should be ${primaryColorKeys[primaryColorValues.indexOf(expectedColorValue)]} (${expectedColorValue}) and not ${primaryColorKeys[primaryColorValues.indexOf(circleColor!)]} (${circleColor}) for testPubkey ${testPubkeys.indexOf(testPubkey)} (${testPubkey})`
      ).to.equal(expectedColorValue);
      result.unmount();
    }

    // NOTE this is the standard order of background colors for avatars on each platform
    await testBackgroundColor(testPubkeys[0], COLORS.PRIMARY.GREEN);
    await testBackgroundColor(testPubkeys[1], COLORS.PRIMARY.BLUE);
    await testBackgroundColor(testPubkeys[2], COLORS.PRIMARY.YELLOW);
    await testBackgroundColor(testPubkeys[3], COLORS.PRIMARY.PINK);
    await testBackgroundColor(testPubkeys[4], COLORS.PRIMARY.PURPLE);
    await testBackgroundColor(testPubkeys[5], COLORS.PRIMARY.ORANGE);
    await testBackgroundColor(testPubkeys[6], COLORS.PRIMARY.RED);
  });
});
