// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as sinon from 'sinon';
import { v4 as uuid } from 'uuid';
import { times } from 'lodash';
import { ConversationModel } from '../models/conversations';
import { ConversationAttributesType } from '../model-types.d';

import { routineProfileRefresh } from '../routineProfileRefresh';

describe('routineProfileRefresh', () => {
  let sinonSandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  function makeConversation(
    overrideAttributes: Partial<ConversationAttributesType> = {}
  ): ConversationModel {
    const result = new ConversationModel({
      profileSharing: true,
      left: false,
      accessKey: uuid(),
      draftAttachments: [],
      draftBodyRanges: [],
      draftTimestamp: null,
      inbox_position: 0,
      isPinned: false,
      lastMessageDeletedForEveryone: false,
      lastMessageStatus: 'sent',
      markedUnread: false,
      messageCount: 2,
      messageCountBeforeMessageRequests: 0,
      messageRequestResponseType: 0,
      muteExpiresAt: 0,
      profileAvatar: undefined,
      profileKeyCredential: uuid(),
      profileKeyVersion: '',
      quotedMessageId: null,
      sealedSender: 1,
      sentMessageCount: 1,
      sharedGroupNames: [],
      id: uuid(),
      type: 'private',
      timestamp: Date.now(),
      active_at: Date.now(),
      version: 2,
      ...overrideAttributes,
    });
    sinonSandbox.stub(result, 'getProfile').resolves(undefined);
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

  function makeStorage(lastAttemptAt: undefined | number = undefined) {
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
      ourConversationId: uuid(),
      storage,
    });

    sinon.assert.notCalled(conversation1.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(conversation2.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(storage.put);
  });

  it('asks conversations to get their profiles', async () => {
    const conversation1 = makeConversation();
    const conversation2 = makeConversation();

    await routineProfileRefresh({
      allConversations: [conversation1, conversation2],
      ourConversationId: uuid(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(conversation1.getProfile as sinon.SinonStub);
    sinon.assert.calledOnce(conversation2.getProfile as sinon.SinonStub);
  });

  it("skips conversations that haven't been active in 30 days", async () => {
    const recentlyActive = makeConversation();
    const inactive = makeConversation({
      active_at: Date.now() - 31 * 24 * 60 * 60 * 1000,
    });
    const neverActive = makeConversation({ active_at: undefined });

    await routineProfileRefresh({
      allConversations: [recentlyActive, inactive, neverActive],
      ourConversationId: uuid(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(recentlyActive.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(inactive.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(neverActive.getProfile as sinon.SinonStub);
  });

  it('skips your own conversation', async () => {
    const notMe = makeConversation();
    const me = makeConversation();

    await routineProfileRefresh({
      allConversations: [notMe, me],
      ourConversationId: me.id,
      storage: makeStorage(),
    });

    sinon.assert.notCalled(me.getProfile as sinon.SinonStub);
  });

  it('skips conversations that were refreshed in the last hour', async () => {
    const neverRefreshed = makeConversation();
    const recentlyFetched = makeConversation({
      profileLastFetchedAt: Date.now() - 59 * 60 * 1000,
    });

    await routineProfileRefresh({
      allConversations: [neverRefreshed, recentlyFetched],
      ourConversationId: uuid(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(neverRefreshed.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(recentlyFetched.getProfile as sinon.SinonStub);
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
      ourConversationId: uuid(),
      storage: makeStorage(),
    });

    sinon.assert.calledOnce(privateConversation.getProfile as sinon.SinonStub);
    sinon.assert.calledOnce(
      recentlyActiveGroupMember.getProfile as sinon.SinonStub
    );
    sinon.assert.calledOnce(inactiveGroupMember.getProfile as sinon.SinonStub);
    sinon.assert.notCalled(
      memberWhoHasRecentlyRefreshed.getProfile as sinon.SinonStub
    );
    sinon.assert.notCalled(groupConversation.getProfile as sinon.SinonStub);
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
      sinon.assert.calledOnce(conversation.getProfile as sinon.SinonStub);
    });

    [me, ...shouldNotBeIncluded].forEach(conversation => {
      sinon.assert.notCalled(conversation.getProfile as sinon.SinonStub);
    });
  });
});
