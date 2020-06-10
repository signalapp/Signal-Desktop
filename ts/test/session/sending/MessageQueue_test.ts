import { expect } from 'chai';
import * as _ from 'lodash';

import { MessageUtils, SyncMessageUtils } from '../../../session/utils';
import { TestUtils } from '../../../test/test-utils';

import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';
import { generateChatMessage } from '../../test-utils/testUtils';
import { OpenGroup } from '../../../session/types/OpenGroup';

// Equivalent to Data.StorageItem
interface StorageItem {
  id: string;
  value: any;
}

describe('PendingMessageCache', () => {
  // Initialize new stubbed cache
  let data: StorageItem;
  let pendingMessageCacheStub: PendingMessageCache;

  beforeEach(async () => {
    //
  });

  afterEach(() => {
    //
  });

  it('can init queue', async () => {
    const device = TestUtils.generateFakePubkey();
    const message = TestUtils.generateChatMessage();
    const rawMessage = MessageUtils.toRawMessage(device, message);

    SyncMessageUtils.from(message);

    const myOpenGroup = new OpenGroup({conversationId: 'publicChat:1@feedback.getsession.org'});
    
    console.log('[vince] myOpenGroup.server:', myOpenGroup.server);
    console.log('[vince] myOpenGroup.channel:', myOpenGroup.channel);
    console.log('[vince] myOpenGroup.conversationId:', myOpenGroup.conversationId);
  });
});
