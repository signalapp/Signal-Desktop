// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { strictAssert } from '../util/assert';
import { DataWriter } from '../sql/Client';

import type { ConversationModel } from '../models/conversations';
import type { AciString, PniString, ServiceIdString } from '../types/ServiceId';
import { generateAci, generatePni } from '../types/ServiceId';
import type { SafeCombineConversationsParams } from '../ConversationController';

const ACI_1 = generateAci();
const ACI_2 = generateAci();
const E164_1 = '+14155550111';
const E164_2 = '+14155550112';
const PNI_1 = generatePni();
const PNI_2 = generatePni();
const reason = 'test';

type ParamsType = {
  serviceId?: ServiceIdString;
  aci?: AciString;
  e164?: string;
  pni?: PniString;
};

describe('ConversationController', () => {
  describe('maybeMergeContacts', () => {
    let mergeOldAndNew: (
      options: SafeCombineConversationsParams
    ) => Promise<void>;

    beforeEach(async () => {
      await DataWriter._removeAllConversations();

      window.ConversationController.reset();
      await window.ConversationController.load();
      await window.textsecure.storage.protocol.hydrateCaches();

      mergeOldAndNew = () => {
        throw new Error('mergeOldAndNew: Should not be called!');
      };
    });

    it('throws when provided no data', () => {
      assert.throws(() => {
        window.ConversationController.maybeMergeContacts({
          mergeOldAndNew,
          reason,
        });
      }, 'Need to provide at least one');
    });

    function create(
      name: string,
      { serviceId: maybeServiceId, aci, e164, pni }: ParamsType
    ): ConversationModel {
      const identifier = aci || maybeServiceId || e164 || pni;
      const serviceId = aci || maybeServiceId || pni;

      strictAssert(identifier, 'create needs aci, e164, pni, or serviceId');

      const conversation = window.ConversationController.getOrCreate(
        identifier,
        'private',
        { serviceId, e164, pni }
      );
      expectLookups(conversation, name, { serviceId, aci, e164, pni });

      return conversation;
    }

    function expectLookups(
      conversation: ConversationModel | undefined,
      name: string,
      { serviceId, aci, e164, pni }: ParamsType
    ) {
      assert.exists(conversation, `${name} conversation exists`);

      // Verify that this conversation hasn't been deleted
      assert.strictEqual(
        window.ConversationController.get(conversation?.id)?.id,
        conversation?.id,
        `${name} vs. lookup by id`
      );

      if (serviceId) {
        assert.strictEqual(
          window.ConversationController.get(serviceId)?.id,
          conversation?.id,
          `${name} vs. lookup by serviceId`
        );
      }
      if (aci) {
        assert.strictEqual(
          window.ConversationController.get(aci)?.id,
          conversation?.id,
          `${name} vs. lookup by aci`
        );
      }
      if (e164) {
        assert.strictEqual(
          window.ConversationController.get(e164)?.id,
          conversation?.id,
          `${name} vs. lookup by e164`
        );
      }
      if (pni) {
        assert.strictEqual(
          window.ConversationController.get(pni)?.id,
          conversation?.id,
          `${name} vs. lookup by pni`
        );
      }
    }

    function expectPropsAndLookups(
      conversation: ConversationModel | undefined,
      name: string,
      { serviceId, aci, e164, pni }: ParamsType
    ) {
      assert.exists(conversation, `${name} conversation exists`);
      assert.strictEqual(
        conversation?.getServiceId(),
        aci || serviceId,
        `${name} serviceId matches`
      );
      assert.strictEqual(
        conversation?.get('e164'),
        e164,
        `${name} e164 matches`
      );
      assert.strictEqual(conversation?.getPni(), pni, `${name} pni matches`);

      expectLookups(conversation, name, { serviceId, e164, pni });
    }

    function expectDeleted(conversation: ConversationModel, name: string) {
      assert.isUndefined(
        window.ConversationController.get(conversation.id),
        `${name} has been deleted`
      );
    }

    describe('non-destructive updates', () => {
      it('creates a new conversation with just ACI if no matches', () => {
        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
        });

        const { conversation: second } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            reason,
          });

        expectPropsAndLookups(second, 'second', {
          aci: ACI_1,
        });

        assert.strictEqual(result?.id, second?.id, 'result and second match');
      });
      it('creates a new conversation with just e164 if no matches', () => {
        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          e164: E164_1,
        });

        const { conversation: second } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            reason,
          });

        expectPropsAndLookups(second, 'second', {
          e164: E164_1,
        });

        assert.strictEqual(result?.id, second?.id, 'result and second match');
      });
      it('creates a new conversation with e164+PNI if no matches', () => {
        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: second } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });

        expectPropsAndLookups(second, 'second', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, second?.id, 'result and second match');
      });
      it('creates a new conversation with all data if no matches', () => {
        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: second } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });

        expectPropsAndLookups(second, 'second', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, second?.id, 'result and second match');
      });

      it('fetches all-data conversation with ACI-only query', () => {
        const initial = create('initial', {
          aci: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });

      it('fetches all-data conversation with e164+PNI query', () => {
        const initial = create('initial', {
          aci: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });

        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });

      it('adds ACI to conversation with e164+PNI', () => {
        const initial = create('initial', {
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });
      it('adds ACI (via ACI+PNI) to conversation with e164+PNI', () => {
        const initial = create('initial', {
          serviceId: PNI_1,
          e164: E164_1,
        });

        expectPropsAndLookups(initial, 'initial', {
          serviceId: PNI_1,
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });

      it('adds e164+PNI to conversation with just ACI', () => {
        const initial = create('initial', {
          serviceId: ACI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });
      it('adds e164 to conversation with ACI+PNI', () => {
        const initial = create('initial', {
          aci: ACI_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });
      it('adds PNI to conversation with ACI+e164', () => {
        const initial = create('initial', {
          aci: ACI_1,
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });
      it('adds PNI to conversation with just e164', () => {
        const initial = create('initial', {
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });
      it('adds PNI+ACI to conversation with just e164', () => {
        const initial = create('initial', {
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          aci: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });
      it('adds ACI+e164 to conversation with just PNI', () => {
        const initial = create('initial', {
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          aci: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });

      it('promotes PNI used as generic serviceId to be in the PNI field as well', () => {
        const initial = create('initial', {
          serviceId: PNI_1,
          e164: E164_1,
        });
        expectPropsAndLookups(initial, 'initial', {
          serviceId: PNI_1,
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(initial?.id, result?.id, 'result and initial match');
      });
    });

    describe('with destructive updates', () => {
      it('replaces e164+PNI in conversation with matching ACI', () => {
        const initial = create('initial', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_2,
            pni: PNI_2,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_2,
          pni: PNI_2,
        });

        assert.isUndefined(
          window.ConversationController.get(E164_1),
          'old e164 no longer found'
        );
        assert.isUndefined(
          window.ConversationController.get(PNI_1),
          'old pni no longer found'
        );

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });

      it('replaces PNI in conversation with e164+PNI', () => {
        const initial = create('initial', {
          pni: PNI_1,
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            pni: PNI_2,
            e164: E164_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_2,
          e164: E164_1,
          pni: PNI_2,
        });

        assert.isUndefined(
          window.ConversationController.get(PNI_1),
          'old pni no longer found'
        );

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });
      it('adds PNI to conversation with e164+ACI', () => {
        const initial = create('initial', {
          aci: ACI_1,
          e164: E164_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            pni: PNI_1,
            e164: E164_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });
      it('replaces PNI in conversation with all data', () => {
        const initial = create('initial', {
          aci: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_2,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_2,
        });

        assert.isUndefined(
          window.ConversationController.get(PNI_1),
          'old pni no longer found'
        );

        assert.strictEqual(result?.id, initial?.id, 'result and initial match');
      });

      it('removes e164+PNI from previous conversation with an ACI, adds all data to new conversation', () => {
        const initial = create('initial', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_2,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_2,
          e164: E164_1,
          pni: PNI_1,
        });

        expectPropsAndLookups(initial, 'initial', { serviceId: ACI_1 });

        assert.notStrictEqual(
          initial?.id,
          result?.id,
          'result and initial should not match'
        );
      });
      it('removes e164+PNI from previous conversation with an ACI, adds to ACI match', () => {
        const initial = create('initial', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });
        const aciOnly = create('aciOnly', {
          serviceId: ACI_2,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_2,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(aciOnly, 'aciOnly', {
          serviceId: ACI_2,
          e164: E164_1,
          pni: PNI_1,
        });

        expectPropsAndLookups(initial, 'initial', { serviceId: ACI_1 });

        assert.strictEqual(
          aciOnly?.id,
          result?.id,
          'result and aciOnly should match'
        );
      });

      it('removes PNI from previous conversation, adds it to e164-only match', () => {
        const withE164 = create('withE164', {
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          e164: E164_2,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        expectPropsAndLookups(withPNI, 'withPNI', { e164: E164_2 });

        assert.strictEqual(
          withE164?.id,
          result?.id,
          'result and initial should match'
        );
      });
      it('removes PNI from previous conversation, adds it new e164+PNI conversation', () => {
        const initial = create('initial', {
          e164: E164_1,
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_2,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_2,
          pni: PNI_1,
        });

        expectPropsAndLookups(initial, 'initial', { e164: E164_1 });

        assert.notStrictEqual(
          initial?.id,
          result?.id,
          'result and initial should not match'
        );
      });
      it('deletes PNI-only previous conversation, adds it to e164 match', () => {
        mergeOldAndNew = ({ obsolete }) => {
          window.ConversationController.dangerouslyRemoveById(obsolete.id);
          return Promise.resolve();
        };

        const withE164 = create('withE164', {
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        expectDeleted(withPNI, 'withPNI');

        assert.strictEqual(
          withE164?.id,
          result?.id,
          'result and initial should match'
        );
      });
      it('deletes previous conversation with PNI as serviceId only, adds it to e164 match', () => {
        mergeOldAndNew = ({ obsolete }) => {
          window.ConversationController.dangerouslyRemoveById(obsolete.id);
          return Promise.resolve();
        };

        const withE164 = create('withE164', {
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          serviceId: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: PNI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        expectDeleted(withPNI, 'withPNI');

        assert.strictEqual(
          withE164?.id,
          result?.id,
          'result and initial should match'
        );
      });
      it('deletes e164+PNI previous conversation, adds data to ACI match', () => {
        mergeOldAndNew = ({ obsolete }) => {
          window.ConversationController.dangerouslyRemoveById(obsolete.id);
          return Promise.resolve();
        };

        const withE164 = create('withE164', {
          e164: E164_1,
          pni: PNI_1,
        });
        const withACI = create('withPNI', {
          aci: ACI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        expectDeleted(withE164, 'withE164');

        assert.strictEqual(
          withACI?.id,
          result?.id,
          'result and initial should match'
        );
      });

      it('handles three matching conversations: ACI-only, with E164, and with PNI', () => {
        const withACI = create('withACI', {
          aci: ACI_1,
        });
        const withE164 = create('withE164', {
          aci: ACI_2,
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          pni: PNI_1,
          e164: E164_2,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });
        expectPropsAndLookups(withE164, 'withE164', { aci: ACI_2 });
        expectPropsAndLookups(withPNI, 'withPNI', { e164: E164_2 });

        assert.strictEqual(result?.id, withACI?.id, 'result and withACI match');
      });
      it('handles three matching conversations: ACI-only, E164-only (deleted), and with PNI', () => {
        mergeOldAndNew = ({ obsolete }) => {
          window.ConversationController.dangerouslyRemoveById(obsolete.id);
          return Promise.resolve();
        };

        const withACI = create('withACI', {
          aci: ACI_1,
        });
        const withE164 = create('withE164', {
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          pni: PNI_1,
          e164: E164_2,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });
        expectPropsAndLookups(withPNI, 'withPNI', { e164: E164_2 });

        expectDeleted(withE164, 'withE164');

        assert.strictEqual(result?.id, withACI?.id, 'result and withACI match');
      });
      it('merges three matching conversations: ACI-only, E164-only (deleted), PNI-only (deleted)', () => {
        mergeOldAndNew = ({ obsolete }) => {
          window.ConversationController.dangerouslyRemoveById(obsolete.id);
          return Promise.resolve();
        };

        const withACI = create('withACI', {
          aci: ACI_1,
        });
        const withE164 = create('withE164', {
          e164: E164_1,
        });
        const withPNI = create('withPNI', {
          pni: PNI_1,
        });

        const { conversation: result } =
          window.ConversationController.maybeMergeContacts({
            mergeOldAndNew,
            aci: ACI_1,
            e164: E164_1,
            pni: PNI_1,
            reason,
          });
        expectPropsAndLookups(result, 'result', {
          serviceId: ACI_1,
          e164: E164_1,
          pni: PNI_1,
        });

        expectDeleted(withPNI, 'withPNI');
        expectDeleted(withE164, 'withE164');

        assert.strictEqual(result?.id, withACI?.id, 'result and withACI match');
      });
    });
  });
});
