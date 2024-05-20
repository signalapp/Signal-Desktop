/* eslint-disable import/no-extraneous-dependencies */
import chai, { expect } from 'chai';
import chaiDom from 'chai-dom';
import { isEqual } from 'lodash';
import Sinon from 'sinon';
import { AvatarSize } from '../../components/avatar/Avatar';
import {
  AvatarPlaceHolder,
  AvatarPlaceHolderUtils,
} from '../../components/avatar/AvatarPlaceHolder/AvatarPlaceHolder';
import { MemberAvatarPlaceHolder } from '../../components/icon/MemberAvatarPlaceHolder';
import { allowOnlyOneAtATime } from '../../session/utils/Promise';
import { TestUtils } from '../test-utils';
import { stubCrypto } from '../test-utils/utils';
import { cleanup, renderComponent, waitFor } from './renderComponent';

chai.use(chaiDom);

describe('AvatarPlaceHolder', () => {
  const pubkey = TestUtils.generateFakePubKeyStr();
  const displayName = 'Hello World';

  beforeEach(async () => {
    TestUtils.stubWindowLog();

    // NOTE this is the best way I have found to stub the crypto module for now
    const crypto = await stubCrypto();
    // code must match the original exactly
    Sinon.stub(AvatarPlaceHolderUtils, 'sha512FromPubkeyOneAtAtime').returns(
      allowOnlyOneAtATime(`sha512FromPubkey-${'pubkey'}`, async () => {
        const buf = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(pubkey));

        return Array.prototype.map
          .call(new Uint8Array(buf), (x: any) => `00${x.toString(16)}`.slice(-2))
          .join('');
      })
    );
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

    // we need to wait for the component to render after calculating the hash
    await waitFor(() => {
      result.getByText('HW');
    });

    const el = result.getByTestId('avatar-placeholder');
    expect(el.outerHTML, 'should not be null').to.not.equal(null);
    expect(el.outerHTML, 'should not be undefined').to.not.equal(undefined);
    expect(el.outerHTML, 'should not be an empty string').to.not.equal('');
    expect(el.tagName, 'should be an svg').to.equal('svg');
  });

  it('should render the MemberAvatarPlaceholder if we are loading or there is no hash', async () => {
    const result = renderComponent(
      <AvatarPlaceHolder
        diameter={AvatarSize.XL}
        name={displayName}
        pubkey={''}
        dataTestId="avatar-placeholder"
      />
    );
    const el = result.getByTestId('avatar-placeholder');

    const result2 = renderComponent(
      <MemberAvatarPlaceHolder dataTestId="member-avatar-placeholder" />
    );
    const el2 = result2.getByTestId('member-avatar-placeholder');

    // The data test ids are different so we don't use the outerHTML for comparison
    expect(isEqual(el.innerHTML, el2.innerHTML)).to.equal(true);
  });

  // TODO it should render the correct theme colors
  // TODO given a pubkey it should render the correct color
  // TODO given a name it should render the correct initials
});
