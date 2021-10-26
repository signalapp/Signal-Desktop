// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { times } from 'lodash';
import { ConversationModel } from '../models/conversations';
import type { ConversationAttributesType } from '../model-types.d';
import { UUID } from '../types/UUID';

import { routineProfileRefresh } from '../routineProfileRefresh';
import * as getProfileStub from '../util/getProfile';

describe('routineProfileRefresh', () => {
  let sinonSandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(getProfileStub, 'getProfile').resolves(undefined);
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
      profileKeyVersion: '',
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

  it('does nothing when the last refresh time is less than 12 hours ago', async () => {
    const conversation1 = makeConversation();
    const conversation2 = makeConversation();
    const storage = makeStorage(Date.now() - 1234);

    await routineProfileRefresh({
      allConversations: [conversation1, conversation2],
      ourConversationId: UUID.generate().toString(),
      storage,
    });

    sinon.assert.notCalled(getProfileStub.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(storage.put);
  });

  it('asks conversations to get their profiles', async () => {
    const conversation1 = makeConversation();
    const conversation2 = makeConversation();

    await routineProfileRefresh({
      allConversations: [conversation1, conversation2],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
    });

    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      conversation1.get('uuid'),
      conversation1.get('e164')
    );
    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      conversation2.get('uuid'),
      conversation2.get('e164')
    );
  });

  it("skips conversations that haven't been active in 30 days", async () => {
    const recentlyActive = makeConversation();
    const inactive = makeConversation({
      active_at: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    const neverActive = makeConversation({ active_at: undefined });

    await routineProfileRefresh({
      allConversations: [recentlyActive, inactive, neverActive],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(getProfileStub.getProfile as sinon.SinonStub);
    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      recentlyActive.get('uuid'),
      recentlyActive.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      inactive.get('uuid'),
      inactive.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      neverActive.get('uuid'),
      neverActive.get('e164')
    );
  });

  it('skips your own conversation', async () => {
    const notMe = makeConversation();
    const me = makeConversation();

    await routineProfileRefresh({
      allConversations: [notMe, me],
      ourConversationId: me.id,
      storage: makeStorage(),
    });

    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      notMe.get('uuid'),
      notMe.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      me.get('uuid'),
      me.get('e164')
    );
  });

  it('skips conversations that were refreshed in the last hour', async () => {
    const neverRefreshed = makeConversation();
    const recentlyFetched = makeConversation({
      profileLastFetchedAt: Date.now() - 59 * 60 * 1000,
    });

    await routineProfileRefresh({
      allConversations: [neverRefreshed, recentlyFetched],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(getProfileStub.getProfile as sinon.SinonStub);
    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      neverRefreshed.get('uuid'),
      neverRefreshed.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      recentlyFetched.get('uuid'),
      recentlyFetched.get('e164')
    );
  });

  it('"digs into" the members of an active group', async () => {
    const privateConversation = makeConversation();

    const recentlyActiveGroupMember = makeConversation();
    const inactiveGroupMember = makeConversation({
      active_at: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    const memberWhoHasRecentlyRefreshed = makeConversation({
      profileLastFetchedAt: Date.now() - 59 * 60 * 1000,
    });

    const groupConversation = makeGroup([
      recentlyActiveGroupMember,
      inactiveGroupMember,
      memberWhoHasRecentlyRefreshed,
    ]);

    await routineProfileRefresh({
      allConversations: [
        privateConversation,
        recentlyActiveGroupMember,
        inactiveGroupMember,
        memberWhoHasRecentlyRefreshed,
        groupConversation,
      ],
      ourConversationId: UUID.generate().toString(),
      storage: makeStorage(),
    });

    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      privateConversation.get('uuid'),
      privateConversation.get('e164')
    );
    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      recentlyActiveGroupMember.get('uuid'),
      recentlyActiveGroupMember.get('e164')
    );
    sinon.assert.calledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      inactiveGroupMember.get('uuid'),
      inactiveGroupMember.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      memberWhoHasRecentlyRefreshed.get('uuid'),
      memberWhoHasRecentlyRefreshed.get('e164')
    );
    sinon.assert.neverCalledWith(
      getProfileStub.getProfile as sinon.SinonStub,
      groupConversation.get('uuid'),
      groupConversation.get('e164')
    );
  });

  it('only refreshes profiles for the 50 most recently active direct conversations', async () => {
    const me = makeConversation();

    const activeConversations = times(40, () => makeConversation());

    const inactiveGroupMembers = times(10, () =>
      makeConversation({
        active_at: Date.now() - 999 * 24 * 60 * 60 * 1000,
      })
    );
    const recentlyActiveGroup = makeGroup(inactiveGroupMembers);

    const shouldNotBeIncluded = [
      // Recently-active groups with no other members
      makeGroup([]),
      makeGroup([me]),
      // Old direct conversations
      ...times(3, () =>
        makeConversation({
          active_at: Date.now() - 365 * 24 * 60 * 60 * 1000,
        })
      ),
      // Old groups
      ...times(3, () => makeGroup(inactiveGroupMembers)),
    ];

    await routineProfileRefresh({
      allConversations: [
        me,

        ...activeConversations,

        recentlyActiveGroup,
        ...inactiveGroupMembers,

        ...shouldNotBeIncluded,
      ],
      ourConversationId: me.id,
      storage: makeStorage(),
    });

    [...activeConversations, ...inactiveGroupMembers].forEach(conversation => {
      sinon.assert.calledWith(
        getProfileStub.getProfile as sinon.SinonStub,
        conversation.get('uuid'),
        conversation.get('e164')
      );
    });

    [me, ...shouldNotBeIncluded].forEach(conversation => {
      sinon.assert.neverCalledWith(
        getProfileStub.getProfile as sinon.SinonStub,
        conversation.get('uuid'),
        conversation.get('e164')
      );
    });
  });
});
