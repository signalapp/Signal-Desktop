import { expect } from 'chai';
import Sinon from 'sinon';
import { stubWindowLog } from '../../../test-utils/utils';

describe('Disappearing Messages', () => {
  stubWindowLog();

  beforeEach(() => {
    // TODO Stubbing
  });

  afterEach(() => {
    Sinon.restore();
  });

  // ts/util/expiringMessages.ts
  it('setExpirationStartTimestamp', async () => {
    expect('TODO').to.be.eq('TODO');
  });

  it('changeToDisappearingMessageType', async () => {
    expect('TODO').to.be.eq('TODO');
  });

  it('changeToDisappearingConversationMode', async () => {
    expect('TODO').to.be.eq('TODO');
  });

  it('checkForExpireUpdateInContentMessage', async () => {
    expect('TODO').to.be.eq('TODO');
  });

  // ts/models/conversation.ts
  it('updateExpireTimer', async () => {
    expect('TODO').to.be.eq('TODO');
  });

  // ts/models/message.ts
  it('isExpirationTimerUpdate', async () => {
    expect('TODO').to.be.eq('TODO');
  });
});
