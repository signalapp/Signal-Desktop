// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { getShouldWeRotateProfileKey } from '../groups.preload.ts';
import {
  generateAci,
  generatePni,
} from '../test-helpers/serviceIdUtils.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { generateGroupId } from '../test-helpers/getDefaultConversation.std.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

import type { ConversationModel } from '../models/conversations.preload.ts';

describe('groups', () => {
  describe('getShouldWeRotateProfileKey', () => {
    const now = Date.now();

    const aciMe = generateAci();
    const aciA = generateAci();
    const aciB = generateAci();
    const aciC = generateAci();

    const groupIdA = generateGroupId();
    const groupIdB = generateGroupId();
    const groupIdC = generateGroupId();
    const groupIdD = generateGroupId();
    const groupIdE = generateGroupId();

    let me: ConversationModel;
    let contactNotBlocked: ConversationModel;
    let contactBlockedNoSharedGroups: ConversationModel;
    let contactBlockedWithSharedGroups: ConversationModel;

    beforeEach(async () => {
      await DataWriter._removeAllConversations();
      await DataWriter.removeAllItems();

      window.ConversationController.reset();
      await window.ConversationController.load();

      itemStorage.reset();
      await itemStorage.fetch();

      await itemStorage.user.setCredentials({
        number: '+15550000000',
        aci: aciMe,
        pni: generatePni(),
        deviceId: 2,
        deviceName: 'my device',
        password: 'password',
      });

      me = window.ConversationController.getOrCreate(aciMe, 'private');

      contactNotBlocked = window.ConversationController.getOrCreate(
        aciA,
        'private'
      );

      contactBlockedNoSharedGroups = window.ConversationController.getOrCreate(
        aciB,
        'private'
      );
      contactBlockedNoSharedGroups.block({
        viaStorageServiceSync: true, // no attempts to send sync messages
        timestamp: now,
      });

      contactBlockedWithSharedGroups =
        window.ConversationController.getOrCreate(aciC, 'private');
      contactBlockedWithSharedGroups.block({
        viaStorageServiceSync: true, // no attempts to send sync messages
        timestamp: now,
      });

      window.ConversationController.getOrCreate(groupIdA, 'group', {
        groupVersion: 2,
        name: 'groupWithBlocked',
        membersV2: [
          {
            aci: contactBlockedWithSharedGroups.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: contactNotBlocked.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: me.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
        ],
      });
      window.ConversationController.getOrCreate(groupIdB, 'group', {
        groupVersion: 2,
        name: 'groupAWithNoBlocked',
        membersV2: [
          {
            aci: me.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
        ],
      });
      window.ConversationController.getOrCreate(groupIdC, 'group', {
        groupVersion: 2,
        name: 'groupBWithNoBlocked',
        membersV2: [
          {
            aci: contactNotBlocked.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: me.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
        ],
      });
      window.ConversationController.getOrCreate(groupIdD, 'group', {
        groupVersion: 2,
        name: 'groupNotMember',
        membersV2: [
          {
            aci: contactNotBlocked.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: contactBlockedNoSharedGroups.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: contactBlockedWithSharedGroups.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
        ],
      });
      window.ConversationController.getOrCreate(groupIdE, 'group', {
        groupVersion: 2,
        name: 'terminatedGroup',
        terminated: true,
        membersV2: [
          {
            aci: contactNotBlocked.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: contactBlockedNoSharedGroups.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: contactBlockedWithSharedGroups.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
          {
            aci: me.getCheckedAci('tests'),
            role: 0,
            joinedAtVersion: 0,
          },
        ],
      });
    });
    afterEach(async () => {
      await DataWriter._removeAllConversations();
      await DataWriter.removeAllItems();

      window.ConversationController.reset();
      await window.ConversationController.load();

      itemStorage.reset();
      await itemStorage.fetch();
    });

    it('should return false if you left group and no previous member is blocked', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: true,
        previousMemberACIs: [contactNotBlocked.getCheckedAci('test')],
        currentMemberACIs: [],
      });
      assert.isFalse(shouldWeRotate);
    });
    it('should return false if you left group and all blocked previous members are still in groups with you', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: true,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [],
      });
      assert.isFalse(shouldWeRotate);
    });
    it('should return true if you left group and previous member is blocked and in no groups with you', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: true,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [],
      });
      assert.isTrue(shouldWeRotate);
    });

    it('should return false if justLeft=false and no members left', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: false,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
      });
      assert.isFalse(shouldWeRotate);
    });
    it('should return false if members who just left group are not blocked', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: false,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
      });
      assert.isFalse(shouldWeRotate);
    });
    it('should return false if members who just left group are blocked, but still in groups with you', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: false,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
        ],
      });
      assert.isFalse(shouldWeRotate);
    });
    it('should return true if member who just left group is blocked, and in no groups with you', () => {
      const shouldWeRotate = getShouldWeRotateProfileKey({
        logId: 'test',
        justLeft: false,
        previousMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedNoSharedGroups.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
        currentMemberACIs: [
          contactNotBlocked.getCheckedAci('test'),
          contactBlockedWithSharedGroups.getCheckedAci('test'),
        ],
      });
      assert.isTrue(shouldWeRotate);
    });
  });
});
