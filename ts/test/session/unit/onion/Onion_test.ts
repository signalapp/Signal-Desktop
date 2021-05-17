// tslint:disable: no-implicit-dependencies max-func-body-length no-unused-expression

import chai from 'chai';
import * as sinon from 'sinon';
import _ from 'lodash';
import { describe } from 'mocha';

import { GroupUtils, PromiseUtils, UserUtils } from '../../../../session/utils';
import { TestUtils } from '../../../test-utils';
import { MessageQueue } from '../../../../session/sending/MessageQueue';
import { ContentMessage, OpenGroupMessage } from '../../../../session/messages/outgoing';
import { PubKey, RawMessage } from '../../../../session/types';
import { MessageSender } from '../../../../session/sending';
import { PendingMessageCacheStub } from '../../../test-utils/stubs';
import { ClosedGroupMessage } from '../../../../session/messages/outgoing/controlMessage/group/ClosedGroupMessage';

import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised as any);
chai.should();

const { expect } = chai;

// tslint:disable-next-line: max-func-body-length
describe('Onion', () => {
  // Initialize new stubbed cache
  const sandbox = sinon.createSandbox();
  const ourDevice = TestUtils.generateFakePubKey();
  const ourNumber = ourDevice.key;

  beforeEach(() => {
    // Utils Stubs
    sandbox.stub(UserUtils, 'getOurPubKeyStrFromCache').returns(ourNumber);

    TestUtils.stubWindow('libsignal', {
      SignalProtocolAddress: sandbox.stub(),
    } as any);
  });

  afterEach(() => {
    TestUtils.restoreStubs();
    sandbox.restore();
  });

  describe('processPending', () => {
    it('will send messages', done => {});
  });
});
