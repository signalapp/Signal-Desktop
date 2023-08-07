// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { times } from 'lodash';
import { ConversationModel } from '../models/conversations';
import type { ConversationAttributesType } from '../model-types.d';
import { UUID } from '../types/UUID';
import { DAY, HOUR, MINUTE, MONTH } from '../util/durations';

import { routineProfileRefresh } from '../routineProfileRefresh';

describe('routineProfileRefresh', () => {
  let sinonSandbox: sinon.SinonSandbox;
  let getProfileFn: sinon.SinonStub;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
    getProfileFn = sinon.stub();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  function makeConversation(
    overrideAttributes: Partial<ConversationAttributesType> = {}
  ): ConversationModel {
    const result = new ConversationModel({
      accessKey: UUID.generate().toString(),
      active_at: Date.now(),
      draftAttachments: [],
      draftBodyRanges: [],
      draftTimestamp: null,
      id: UUID.generate().toString(),
      inbox_position: 0,
      isPinned: false,
      lastMessageDeletedForEveryone: false,
      lastMessageStatus: 'sent',
      left: false,
      markedUnread: false,
      messageCount: 2,
      messageCountBeforeMessageRequests: 0,
      messageRequestResponseType: 0,
      muteExpiresAt: 0,
      profileAvatar: undefined,
      profileKeyCredential: UUID.generate().toString(),
      profileKeyCredentialExpiration: Date.now() + 2 * DAY,
      profileSharing: true,
      quotedMessageId: null,
      sealedSender: 1,
      sentMessageCount: 1,
      sharedGroupNames: [],
      timestamp: Date.now(),
      type: 'private',
      uuid: UUID.generate().toString(),
      version: 2,
      ...overrideAttributes,
    });
    return result;
  }

  function makeGroup(
    groupMembers: Array<ConversationModel>
  ): ConversationModel {
    const result = makeConversation({ type: 'group' });
    // This is easier than setting up all of the scaffolding for `getMembers`.
    sinonSandbox.stub(result, 'getMembers').returns(groupMembers);
    return result;
  }

  function makeStorage(lastAttemptAt?: number) {
    return {
      get: sinonSandbox
        .stub()
        .withArgs('lastAttemptedToRefreshProfilesAt')
        .returns(lastAttemptAt),
      put: sinonSandbox.stub().resolves(undefined),
    };
  }

  it('does nothing when the last refresh time is less one hour', async () => {
    const conversation1 = makeConversation();
    const conversation2 = makeConversation();
    const storage = makeStorage(Date.now() - 47 * MINUTE);

    await routineProfileRefresh({
      allConversations: [conversation1, conversation2],
      ourConversationId: UUID.generate().toString(),
      storage,
      getProfileFn,
      id: 1,
    });

    sinon.assert.notCalled(getProfileFn);
    sinon.assert.notCalled(storage.put);
  });

  it('asks conversations to get their profiles', async () => {
    const conversation1 = makeConversation();
    const conversation2 = makeConversation();

    await routineProfileRefresh({
      allConversations: [conversation1, conversation2],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    sinon.assert.calledWith(
      getProfileFn,
      conversation1.get('uuid'),
      conversation1.get('e164')
    );
    sinon.assert.calledWith(
      getProfileFn,
      conversation2.get('uuid'),
      conversation2.get('e164')
    );
  });

  it('skips unregistered conversations and those fetched in the last three days', async () => {
    const normal = makeConversation();
    const recentlyFetched = makeConversation({
      profileLastFetchedAt: Date.now() - DAY * 2 - HOUR * 3,
    });
    const unregisteredAndStale = makeConversation({
      firstUnregisteredAt: Date.now() - 2 * MONTH,
    });

    await routineProfileRefresh({
      allConversations: [normal, recentlyFetched, unregisteredAndStale],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    sinon.assert.calledOnce(getProfileFn);
    sinon.assert.calledWith(
      getProfileFn,
      normal.get('uuid'),
      normal.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileFn,
      recentlyFetched.get('uuid'),
      recentlyFetched.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileFn,
      unregisteredAndStale.get('uuid'),
      unregisteredAndStale.get('e164')
    );
  });

  it('skips your own conversation', async () => {
    const notMe = makeConversation();
    const me = makeConversation();

    await routineProfileRefresh({
      allConversations: [notMe, me],
      ourConversationId: me.id,
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    sinon.assert.calledWith(getProfileFn, notMe.get('uuid'), notMe.get('e164'));
    sinon.assert.neverCalledWith(getProfileFn, me.get('uuid'), me.get('e164'));
  });

  it('includes your own conversation if profileKeyCredential is expired', async () => {
    const notMe = makeConversation();
    const me = makeConversation({
      profileKey: 'fakeProfileKey',
      profileKeyCredential: undefined,
      profileKeyCredentialExpiration: undefined,
    });

    await routineProfileRefresh({
      allConversations: [notMe, me],
      ourConversationId: me.id,
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    sinon.assert.calledWith(getProfileFn, notMe.get('uuid'), notMe.get('e164'));
    sinon.assert.calledWith(getProfileFn, me.get('uuid'), me.get('e164'));
  });

  it('skips conversations that were refreshed in last three days', async () => {
    const neverRefreshed = makeConversation();
    const refreshedToday = makeConversation({
      profileLastFetchedAt: Date.now() - HOUR * 5,
    });
    const refreshedYesterday = makeConversation({
      profileLastFetchedAt: Date.now() - DAY,
    });
    const refreshedTwoDaysAgo = makeConversation({
      profileLastFetchedAt: Date.now() - DAY * 2,
    });
    const refreshedThreeDaysAgo = makeConversation({
      profileLastFetchedAt: Date.now() - DAY * 3 - 1,
    });

    await routineProfileRefresh({
      allConversations: [
        neverRefreshed,
        refreshedToday,
        refreshedYesterday,
        refreshedTwoDaysAgo,
        refreshedThreeDaysAgo,
      ],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    sinon.assert.calledTwice(getProfileFn);
    sinon.assert.calledWith(
      getProfileFn,
      neverRefreshed.get('uuid'),
      neverRefreshed.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileFn,
      refreshedToday.get('uuid'),
      refreshedToday.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileFn,
      refreshedYesterday.get('uuid'),
      refreshedYesterday.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileFn,
      refreshedTwoDaysAgo.get('uuid'),
      refreshedTwoDaysAgo.get('e164')
    );
    sinon.assert.calledWith(
      getProfileFn,
      refreshedThreeDaysAgo.get('uuid'),
      refreshedThreeDaysAgo.get('e164')
    );
  });

  it('only refreshes profiles for the 50 conversations with the oldest profileLastFetchedAt', async () => {
    const me = makeConversation();

    const normalConversations = times(25, () => makeConversation());
    const neverFetched = times(10, () =>
      makeConversation({
        profileLastFetchedAt: undefined,
      })
    );
    const unregisteredUsers = times(10, () =>
      makeConversation({
        firstUnregisteredAt: Date.now() - MONTH * 2,
      })
    );

    const shouldNotBeIncluded = [
      // Recently-active groups with no other members
      makeGroup([]),
      makeGroup([me]),
      ...unregisteredUsers,
    ];

    await routineProfileRefresh({
      allConversations: [
        me,

        ...unregisteredUsers,
        ...normalConversations,
        ...neverFetched,
      ],
      ourConversationId: me.id,
      storage: makeStorage(),
      getProfileFn,
      id: 1,
    });

    [...normalConversations, ...neverFetched].forEach(conversation => {
      sinon.assert.calledWith(
        getProfileFn,
        conversation.get('uuid'),
        conversation.get('e164')
      );
    });

    [me, ...shouldNotBeIncluded].forEach(conversation => {
      sinon.assert.neverCalledWith(
        getProfileFn,
        conversation.get('uuid'),
        conversation.get('e164')
      );
    });
  });
});
