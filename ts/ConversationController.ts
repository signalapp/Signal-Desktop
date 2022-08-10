// Copyright 2020-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, pick, uniq, without } from 'lodash';
import PQueue from 'p-queue';

import type {
  ConversationModelCollectionType,
  ConversationAttributesType,
  ConversationAttributesTypeType,
} from './model-types.d';
import type { ConversationModel } from './models/conversations';
import type { MessageModel } from './models/messages';
import type { UUIDStringType } from './types/UUID';

import dataInterface from './sql/Client';
import * as log from './logging/log';
import * as Errors from './types/errors';
import { getContactId } from './messages/helpers';
import { maybeDeriveGroupV2Id } from './groups';
import { assert, strictAssert } from './util/assert';
import { isGroupV1, isGroupV2 } from './util/whatTypeOfConversation';
import { getConversationUnreadCountForAppBadge } from './util/getConversationUnreadCountForAppBadge';
import { UUID, isValidUuid, UUIDKind } from './types/UUID';
import { Address } from './types/Address';
import { QualifiedAddress } from './types/QualifiedAddress';
import { sleep } from './util/sleep';
import { isNotNil } from './util/isNotNil';
import { MINUTE, SECOND } from './util/durations';

type ConvoMatchType =
  | {
      key: 'uuid' | 'pni';
      value: UUIDStringType | undefined;
      match: ConversationModel | undefined;
    }
  | {
      key: 'e164';
      value: string | undefined;
      match: ConversationModel | undefined;
    };

const { hasOwnProperty } = Object.prototype;

function applyChangeToConversation(
  conversation: ConversationModel,
  suggestedChange: Partial<
    Pick<ConversationAttributesType, 'uuid' | 'e164' | 'pni'>
  >
) {
  const change = { ...suggestedChange };

  // Clear PNI if changing e164 without associated PNI
  if (hasOwnProperty.call(change, 'e164') && !change.pni) {
    change.pni = undefined;
  }

  // If we have a PNI but not an ACI, then the PNI will go in the UUID field
  //   Tricky: We need a special check here, because the PNI can be in the uuid slot
  if (
    change.pni &&
    !change.uuid &&
    (!conversation.get('uuid') ||
      conversation.get('uuid') === conversation.get('pni'))
  ) {
    change.uuid = change.pni;
  }

  // If we're clearing a PNI, but we didn't have an ACI - we need to clear UUID field
  if (
    !change.uuid &&
    hasOwnProperty.call(change, 'pni') &&
    !change.pni &&
    conversation.get('uuid') === conversation.get('pni')
  ) {
    change.uuid = undefined;
  }

  if (hasOwnProperty.call(change, 'uuid')) {
    conversation.updateUuid(change.uuid);
  }
  if (hasOwnProperty.call(change, 'e164')) {
    conversation.updateE164(change.e164);
  }
  if (hasOwnProperty.call(change, 'pni')) {
    conversation.updatePni(change.pni);
  }

  // Note: we don't do a conversation.set here, because change is limited to these fields
}

async function safeCombineConversations({
  logId,
  oldConversation,
  newConversation,
}: {
  logId: string;
  oldConversation: ConversationModel;
  newConversation: ConversationModel;
}) {
  try {
    await window.ConversationController.combineConversations(
      newConversation,
      oldConversation
    );
  } catch (error) {
    log.warn(
      `${logId}: error combining contacts: ${Errors.toLogFormat(error)}`
    );
  }
}

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

const {
  getAllConversations,
  getAllGroupsInvolvingUuid,
  getMessagesBySentAt,
  migrateConversationMessages,
  removeConversation,
  saveConversation,
  updateConversation,
} = dataInterface;

// We have to run this in background.js, after all backbone models and collections on
//   Whisper.* have been created. Once those are in typescript we can use more reasonable
//   require statements for referencing these things, giving us more flexibility here.
export function start(): void {
  const conversations = new window.Whisper.ConversationCollection();

  window.getConversations = () => conversations;
  window.ConversationController = new ConversationController(conversations);
}

export class ConversationController {
  private _initialFetchComplete = false;

  private _initialPromise: undefined | Promise<void>;

  private _conversationOpenStart = new Map<string, number>();

  private _hasQueueEmptied = false;

  private _combineConversationsQueue = new PQueue({ concurrency: 1 });

  constructor(private _conversations: ConversationModelCollectionType) {
    const debouncedUpdateUnreadCount = debounce(
      this.updateUnreadCount.bind(this),
      SECOND,
      {
        leading: true,
        maxWait: SECOND,
        trailing: true,
      }
    );

    // A few things can cause us to update the app-level unread count
    window.Whisper.events.on('updateUnreadCount', debouncedUpdateUnreadCount);
    this._conversations.on(
      'add remove change:active_at change:unreadCount change:markedUnread change:isArchived change:muteExpiresAt',
      debouncedUpdateUnreadCount
    );

    // If the conversation is muted we set a timeout so when the mute expires
    // we can reset the mute state on the model. If the mute has already expired
    // then we reset the state right away.
    this._conversations.on('add', (model: ConversationModel): void => {
      model.startMuteTimer();
    });
  }

  updateUnreadCount(): void {
    if (!this._hasQueueEmptied) {
      return;
    }

    const canCountMutedConversations =
      window.storage.get('badge-count-muted-conversations') || false;

    const newUnreadCount = this._conversations.reduce(
      (result: number, conversation: ConversationModel) =>
        result +
        getConversationUnreadCountForAppBadge(
          conversation.attributes,
          canCountMutedConversations
        ),
      0
    );
    window.storage.put('unreadCount', newUnreadCount);

    if (newUnreadCount > 0) {
      window.setBadgeCount(newUnreadCount);
      window.document.title = `${window.getTitle()} (${newUnreadCount})`;
    } else {
      window.setBadgeCount(0);
      window.document.title = window.getTitle();
    }
    window.updateTrayIcon(newUnreadCount);
  }

  onEmpty(): void {
    this._hasQueueEmptied = true;
    this.updateUnreadCount();
  }

  get(id?: string | null): ConversationModel | undefined {
    if (!this._initialFetchComplete) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    // This function takes null just fine. Backbone typings are too restrictive.
    return this._conversations.get(id as string);
  }

  getAll(): Array<ConversationModel> {
    return this._conversations.models;
  }

  dangerouslyCreateAndAdd(
    attributes: Partial<ConversationAttributesType>
  ): ConversationModel {
    return this._conversations.add(attributes);
  }

  dangerouslyRemoveById(id: string): void {
    this._conversations.remove(id);
    this._conversations.resetLookups();
  }

  getOrCreate(
    identifier: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps = {}
  ): ConversationModel {
    if (typeof identifier !== 'string') {
      throw new TypeError("'id' must be a string");
    }

    if (type !== 'private' && type !== 'group') {
      throw new TypeError(
        `'type' must be 'private' or 'group'; got: '${type}'`
      );
    }

    if (!this._initialFetchComplete) {
      throw new Error(
        'ConversationController.get() needs complete initial fetch'
      );
    }

    let conversation = this._conversations.get(identifier);
    if (conversation) {
      return conversation;
    }

    const id = UUID.generate().toString();

    if (type === 'group') {
      conversation = this._conversations.add({
        id,
        uuid: undefined,
        e164: undefined,
        groupId: identifier,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else if (isValidUuid(identifier)) {
      conversation = this._conversations.add({
        id,
        uuid: identifier,
        e164: undefined,
        groupId: undefined,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    } else {
      conversation = this._conversations.add({
        id,
        uuid: undefined,
        e164: identifier,
        groupId: undefined,
        type,
        version: 2,
        ...additionalInitialProps,
      });
    }

    const create = async () => {
      if (!conversation.isValid()) {
        const validationError = conversation.validationError || {};
        log.error(
          'Contact is not valid. Not saving, but adding to collection:',
          conversation.idForLogging(),
          validationError.stack
        );

        return conversation;
      }

      try {
        if (isGroupV1(conversation.attributes)) {
          maybeDeriveGroupV2Id(conversation);
        }
        await saveConversation(conversation.attributes);
      } catch (error) {
        log.error(
          'Conversation save failed! ',
          identifier,
          type,
          'Error:',
          error && error.stack ? error.stack : error
        );
        throw error;
      }

      return conversation;
    };

    conversation.initialPromise = create();

    return conversation;
  }

  async getOrCreateAndWait(
    id: string | null,
    type: ConversationAttributesTypeType,
    additionalInitialProps = {}
  ): Promise<ConversationModel> {
    await this.load();
    const conversation = this.getOrCreate(id, type, additionalInitialProps);

    if (conversation) {
      await conversation.initialPromise;
      return conversation;
    }

    throw new Error('getOrCreateAndWait: did not get conversation');
  }

  getConversationId(address: string | null): string | null {
    if (!address) {
      return null;
    }

    const [id] = window.textsecure.utils.unencodeNumber(address);
    const conv = this.get(id);

    if (conv) {
      return conv.get('id');
    }

    return null;
  }

  getOurConversationId(): string | undefined {
    const e164 = window.textsecure.storage.user.getNumber();
    const aci = window.textsecure.storage.user
      .getUuid(UUIDKind.ACI)
      ?.toString();
    const pni = window.textsecure.storage.user
      .getUuid(UUIDKind.PNI)
      ?.toString();

    if (!e164 && !aci && !pni) {
      return undefined;
    }

    const conversation = this.maybeMergeContacts({
      aci,
      e164,
      pni,
      reason: 'getOurConversationId',
    });

    return conversation?.id;
  }

  getOurConversationIdOrThrow(): string {
    const conversationId = this.getOurConversationId();
    if (!conversationId) {
      throw new Error(
        'getOurConversationIdOrThrow: Failed to fetch ourConversationId'
      );
    }
    return conversationId;
  }

  getOurConversation(): ConversationModel | undefined {
    const conversationId = this.getOurConversationId();
    return conversationId ? this.get(conversationId) : undefined;
  }

  getOurConversationOrThrow(): ConversationModel {
    const conversation = this.getOurConversation();
    if (!conversation) {
      throw new Error(
        'getOurConversationOrThrow: Failed to fetch our own conversation'
      );
    }

    return conversation;
  }

  areWePrimaryDevice(): boolean {
    const ourDeviceId = window.textsecure.storage.user.getDeviceId();

    return ourDeviceId === 1;
  }

  // Note: If you don't know what kind of UUID it is, put it in the 'aci' param.
  maybeMergeContacts({
    aci: providedAci,
    e164,
    pni: providedPni,
    reason,
    mergeOldAndNew = safeCombineConversations,
  }: {
    aci?: string;
    e164?: string;
    pni?: string;
    reason: string;
    recursionCount?: number;
    mergeOldAndNew?: (options: {
      logId: string;
      oldConversation: ConversationModel;
      newConversation: ConversationModel;
    }) => Promise<void>;
  }): ConversationModel | undefined {
    const dataProvided = [];
    if (providedAci) {
      dataProvided.push('aci');
    }
    if (e164) {
      dataProvided.push('e164');
    }
    if (providedPni) {
      dataProvided.push('pni');
    }
    const logId = `maybeMergeContacts/${reason}/${dataProvided.join('+')}`;

    const aci = providedAci ? UUID.cast(providedAci) : undefined;
    const pni = providedPni ? UUID.cast(providedPni) : undefined;

    if (!aci && !e164 && !pni) {
      throw new Error(
        `${logId}: Need to provide at least one of: aci, e164, pni`
      );
    }

    const identifier = aci || e164 || pni;
    strictAssert(identifier, `${logId}: identifier must be truthy!`);

    const matches: Array<ConvoMatchType> = [
      {
        key: 'uuid',
        value: aci,
        match: window.ConversationController.get(aci),
      },
      {
        key: 'e164',
        value: e164,
        match: window.ConversationController.get(e164),
      },
      { key: 'pni', value: pni, match: window.ConversationController.get(pni) },
    ];
    let unusedMatches: Array<ConvoMatchType> = [];

    let targetConversation: ConversationModel | undefined;
    let matchCount = 0;
    matches.forEach(item => {
      const { key, value, match } = item;

      if (!value) {
        return;
      }

      if (!match) {
        if (targetConversation) {
          log.info(
            `${logId}: No match for ${key}, applying to target conversation`
          );
          // Note: This line might erase a known e164 or PNI
          applyChangeToConversation(targetConversation, {
            [key]: value,
          });
        } else {
          unusedMatches.push(item);
        }
        return;
      }

      matchCount += 1;
      unusedMatches.forEach(unused => {
        strictAssert(unused.value, 'An unused value should always be truthy');

        // Example: If we find that our PNI match has no ACI, then it will be our target.
        //   Tricky: PNI can end up in UUID slot, so we need to special-case it
        if (
          !targetConversation &&
          (!match.get(unused.key) ||
            (unused.key === 'uuid' && match.get(unused.key) === pni))
        ) {
          log.info(
            `${logId}: Match on ${key} does not have ${unused.key}, ` +
              `so it will be our target conversation - ${match.idForLogging()}`
          );
          targetConversation = match;
        }

        // If PNI match already has an ACI, then we need to create a new one
        if (!targetConversation) {
          targetConversation = this.getOrCreate(unused.value, 'private');
          log.info(
            `${logId}: Match on ${key} already had ${unused.key}, ` +
              `so created new target conversation - ${targetConversation.idForLogging()}`
          );
        }

        log.info(
          `${logId}: Applying new value for ${unused.key} to target conversation`
        );
        applyChangeToConversation(targetConversation, {
          [unused.key]: unused.value,
        });
      });

      unusedMatches = [];

      if (targetConversation && targetConversation !== match) {
        // Clear the value on the current match, since it belongs on targetConversation!
        //   Note: we need to do the remove first, because it will clear the lookup!
        log.info(
          `${logId}: Clearing ${key} on match, and adding it to target conversation`
        );
        const change: Pick<
          Partial<ConversationAttributesType>,
          'uuid' | 'e164' | 'pni'
        > = {
          [key]: undefined,
        };
        // When the PNI is being used in the uuid field alone, we need to clear it
        if (key === 'pni' && match.get('uuid') === pni) {
          change.uuid = undefined;
        }
        applyChangeToConversation(match, change);

        applyChangeToConversation(targetConversation, {
          [key]: value,
        });

        // Note: The PNI check here is just to be bulletproof; if we know a UUID is a PNI,
        //   then that should be put in the UUID field as well!
        if (!match.get('uuid') && !match.get('e164') && !match.get('pni')) {
          log.warn(
            `${logId}: Removing old conversation which matched on ${key}. ` +
              'Merging with target conversation.'
          );
          mergeOldAndNew({
            logId,
            oldConversation: match,
            newConversation: targetConversation,
          });
        }
      } else if (targetConversation && !targetConversation?.get(key)) {
        // This is mostly for the situation where PNI was erased when updating e164
        log.debug(`${logId}: Re-adding ${key} on target conversation`);
        applyChangeToConversation(targetConversation, {
          [key]: value,
        });
      }

      if (!targetConversation) {
        // log.debug(
        //   `${logId}: Match on ${key} is target conversation - ${match.idForLogging()}`
        // );
        targetConversation = match;
      }
    });

    if (targetConversation) {
      return targetConversation;
    }

    strictAssert(
      matchCount === 0,
      `${logId}: should be no matches if no targetConversation`
    );

    log.info(`${logId}: Creating a new conversation with all inputs`);
    return this.getOrCreate(identifier, 'private', { e164, pni });
  }

  /**
   * Given a UUID and/or an E164, returns a string representing the local
   * database id of the given contact. Will create a new conversation if none exists;
   * otherwise will return whatever is found.
   */
  lookupOrCreate({
    e164,
    uuid,
  }: {
    e164?: string | null;
    uuid?: string | null;
  }): ConversationModel | undefined {
    const normalizedUuid = uuid ? uuid.toLowerCase() : undefined;
    const identifier = normalizedUuid || e164;

    if ((!e164 && !uuid) || !identifier) {
      log.warn('lookupOrCreate: Called with neither e164 nor uuid!');
      return undefined;
    }

    const convoE164 = this.get(e164);
    const convoUuid = this.get(normalizedUuid);

    // 1. Handle no match at all
    if (!convoE164 && !convoUuid) {
      log.info('lookupOrCreate: Creating new contact, no matches found');
      const newConvo = this.getOrCreate(identifier, 'private');

      // `identifier` would resolve to uuid if we had both, so fix up e164
      if (normalizedUuid && e164) {
        newConvo.updateE164(e164);
      }

      return newConvo;
    }

    // 2. Handle match on only UUID
    if (!convoE164 && convoUuid) {
      return convoUuid;
    }

    // 3. Handle match on only E164
    if (convoE164 && !convoUuid) {
      return convoE164;
    }

    // For some reason, TypeScript doesn't believe that we can trust that these two values
    //   are truthy by this point. So we'll throw if that isn't the case.
    if (!convoE164 || !convoUuid) {
      throw new Error(
        'lookupOrCreate: convoE164 or convoUuid are falsey but should both be true!'
      );
    }

    // 4. If the two lookups agree, return that conversation
    if (convoE164 === convoUuid) {
      return convoUuid;
    }

    // 5. If the two lookups disagree, log and return the UUID match
    log.warn(
      `lookupOrCreate: Found a split contact - UUID ${normalizedUuid} and E164 ${e164}. Returning UUID match.`
    );
    return convoUuid;
  }

  async checkForConflicts(): Promise<void> {
    log.info('checkForConflicts: starting...');
    const byUuid = Object.create(null);
    const byE164 = Object.create(null);
    const byGroupV2Id = Object.create(null);
    // We also want to find duplicate GV1 IDs. You might expect to see a "byGroupV1Id" map
    //   here. Instead, we check for duplicates on the derived GV2 ID.

    const { models } = this._conversations;

    // We iterate from the oldest conversations to the newest. This allows us, in a
    //   conflict case, to keep the one with activity the most recently.
    for (let i = models.length - 1; i >= 0; i -= 1) {
      const conversation = models[i];
      assert(
        conversation,
        'Expected conversation to be found in array during iteration'
      );

      const uuid = conversation.get('uuid');
      const pni = conversation.get('pni');
      const e164 = conversation.get('e164');

      if (uuid) {
        const existing = byUuid[uuid];
        if (!existing) {
          byUuid[uuid] = conversation;
        } else {
          log.warn(`checkForConflicts: Found conflict with uuid ${uuid}`);

          // Keep the newer one if it has an e164, otherwise keep existing
          if (conversation.get('e164')) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(conversation, existing);
            byUuid[uuid] = conversation;
          } else {
            // Keep existing - note that this applies if neither had an e164
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(existing, conversation);
          }
        }
      }

      if (pni) {
        const existing = byUuid[pni];
        if (!existing) {
          byUuid[pni] = conversation;
        } else {
          log.warn(`checkForConflicts: Found conflict with pni ${pni}`);

          // Keep the newer one if it has additional data, otherwise keep existing
          if (conversation.get('e164') || conversation.get('pni')) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(conversation, existing);
            byUuid[pni] = conversation;
          } else {
            // Keep existing - note that this applies if neither had an e164
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(existing, conversation);
          }
        }
      }

      if (e164) {
        const existing = byE164[e164];
        if (!existing) {
          byE164[e164] = conversation;
        } else {
          // If we have two contacts with the same e164 but different truthy UUIDs, then
          //   we'll delete the e164 on the older one
          if (
            conversation.get('uuid') &&
            existing.get('uuid') &&
            conversation.get('uuid') !== existing.get('uuid')
          ) {
            log.warn(
              `checkForConflicts: Found two matches on e164 ${e164} with different truthy UUIDs. Dropping e164 on older.`
            );

            existing.set({ e164: undefined });
            updateConversation(existing.attributes);

            byE164[e164] = conversation;

            continue;
          }

          log.warn(`checkForConflicts: Found conflict with e164 ${e164}`);

          // Keep the newer one if it has a UUID, otherwise keep existing
          if (conversation.get('uuid')) {
            // Keep new one
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(conversation, existing);
            byE164[e164] = conversation;
          } else {
            // Keep existing - note that this applies if neither had a UUID
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(existing, conversation);
          }
        }
      }

      let groupV2Id: undefined | string;
      if (isGroupV1(conversation.attributes)) {
        maybeDeriveGroupV2Id(conversation);
        groupV2Id = conversation.get('derivedGroupV2Id');
        assert(
          groupV2Id,
          'checkForConflicts: expected the group V2 ID to have been derived, but it was falsy'
        );
      } else if (isGroupV2(conversation.attributes)) {
        groupV2Id = conversation.get('groupId');
      }

      if (groupV2Id) {
        const existing = byGroupV2Id[groupV2Id];
        if (!existing) {
          byGroupV2Id[groupV2Id] = conversation;
        } else {
          const logParenthetical = isGroupV1(conversation.attributes)
            ? ' (derived from a GV1 group ID)'
            : '';
          log.warn(
            `checkForConflicts: Found conflict with group V2 ID ${groupV2Id}${logParenthetical}`
          );

          // Prefer the GV2 group.
          if (
            isGroupV2(conversation.attributes) &&
            !isGroupV2(existing.attributes)
          ) {
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(conversation, existing);
            byGroupV2Id[groupV2Id] = conversation;
          } else {
            // eslint-disable-next-line no-await-in-loop
            await this.combineConversations(existing, conversation);
          }
        }
      }
    }

    log.info('checkForConflicts: complete!');
  }

  async combineConversations(
    current: ConversationModel,
    obsolete: ConversationModel
  ): Promise<void> {
    const logId = `combineConversations/${obsolete.id}->${current.id}`;

    return this._combineConversationsQueue.add(async () => {
      const conversationType = current.get('type');

      if (!this.get(obsolete.id)) {
        log.warn(`${logId}: Already combined obsolete conversation`);
      }

      if (obsolete.get('type') !== conversationType) {
        assert(
          false,
          `${logId}: cannot combine a private and group conversation. Doing nothing`
        );
        return;
      }

      const dataToCopy: Partial<ConversationAttributesType> = pick(
        obsolete.attributes,
        [
          'conversationColor',
          'customColor',
          'customColorId',
          'draftAttachments',
          'draftBodyRanges',
          'draftTimestamp',
          'messageCount',
          'messageRequestResponseType',
          'quotedMessageId',
          'sentMessageCount',
        ]
      );

      const keys = Object.keys(dataToCopy) as Array<
        keyof ConversationAttributesType
      >;
      keys.forEach(key => {
        if (current.get(key) === undefined) {
          current.set(key, dataToCopy[key]);

          // To ensure that any files on disk don't get deleted out from under us
          if (key === 'draftAttachments') {
            obsolete.set(key, undefined);
          }
        }
      });

      if (obsolete.get('isPinned')) {
        obsolete.unpin();

        if (!current.get('isPinned')) {
          current.pin();
        }
      }

      const obsoleteId = obsolete.get('id');
      const obsoleteUuid = obsolete.getUuid();
      const currentId = current.get('id');
      log.warn(
        `${logId}: Combining two conversations -`,
        `old: ${obsolete.idForLogging()} -> new: ${current.idForLogging()}`
      );

      if (conversationType === 'private' && obsoleteUuid) {
        if (!current.get('profileKey') && obsolete.get('profileKey')) {
          log.warn(`${logId}: Copying profile key from old to new contact`);

          const profileKey = obsolete.get('profileKey');

          if (profileKey) {
            await current.setProfileKey(profileKey);
          }
        }

        log.warn(`${logId}: Delete all sessions tied to old conversationId`);
        const ourACI = window.textsecure.storage.user.getUuid(UUIDKind.ACI);
        const ourPNI = window.textsecure.storage.user.getUuid(UUIDKind.PNI);
        await Promise.all(
          [ourACI, ourPNI].map(async ourUuid => {
            if (!ourUuid) {
              return;
            }
            const deviceIds =
              await window.textsecure.storage.protocol.getDeviceIds({
                ourUuid,
                identifier: obsoleteUuid.toString(),
              });
            await Promise.all(
              deviceIds.map(async deviceId => {
                const addr = new QualifiedAddress(
                  ourUuid,
                  new Address(obsoleteUuid, deviceId)
                );
                await window.textsecure.storage.protocol.removeSession(addr);
              })
            );
          })
        );

        log.warn(
          `${logId}: Delete all identity information tied to old conversationId`
        );

        if (obsoleteUuid) {
          await window.textsecure.storage.protocol.removeIdentityKey(
            obsoleteUuid
          );
        }

        log.warn(
          `${logId}: Ensure that all V1 groups have new conversationId instead of old`
        );
        const groups = await this.getAllGroupsInvolvingUuid(obsoleteUuid);
        groups.forEach(group => {
          const members = group.get('members');
          const withoutObsolete = without(members, obsoleteId);
          const currentAdded = uniq([...withoutObsolete, currentId]);

          group.set({
            members: currentAdded,
          });
          updateConversation(group.attributes);
        });
      }

      // Note: we explicitly don't want to update V2 groups

      log.warn(`${logId}: Delete the obsolete conversation from the database`);
      await removeConversation(obsoleteId);

      log.warn(`${logId}: Update cached messages in MessageController`);
      window.MessageController.update((message: MessageModel) => {
        if (message.get('conversationId') === obsoleteId) {
          message.set({ conversationId: currentId });
        }
      });

      log.warn(`${logId}: Update messages table`);
      await migrateConversationMessages(obsoleteId, currentId);

      log.warn(
        `${logId}: Emit refreshConversation event to close old/open new`
      );
      window.Whisper.events.trigger('refreshConversation', {
        newId: currentId,
        oldId: obsoleteId,
      });

      log.warn(
        `${logId}: Eliminate old conversation from ConversationController lookups`
      );
      this._conversations.remove(obsolete);
      this._conversations.resetLookups();

      current.captureChange('combineConversations');

      log.warn(`${logId}: Complete!`);
    });
  }

  /**
   * Given a groupId and optional additional initialization properties,
   * ensures the existence of a group conversation and returns a string
   * representing the local database ID of the group conversation.
   */
  ensureGroup(groupId: string, additionalInitProps = {}): string {
    return this.getOrCreate(groupId, 'group', additionalInitProps).get('id');
  }

  /**
   * Given certain metadata about a message (an identifier of who wrote the
   * message and the sent_at timestamp of the message) returns the
   * conversation the message belongs to OR null if a conversation isn't
   * found.
   */
  async getConversationForTargetMessage(
    targetFromId: string,
    targetTimestamp: number
  ): Promise<ConversationModel | null | undefined> {
    const messages = await getMessagesBySentAt(targetTimestamp);
    const targetMessage = messages.find(m => getContactId(m) === targetFromId);

    if (targetMessage) {
      return this.get(targetMessage.conversationId);
    }

    return null;
  }

  async getAllGroupsInvolvingUuid(
    uuid: UUID
  ): Promise<Array<ConversationModel>> {
    const groups = await getAllGroupsInvolvingUuid(uuid.toString());
    return groups.map(group => {
      const existing = this.get(group.id);
      if (existing) {
        return existing;
      }

      return this._conversations.add(group);
    });
  }

  getByDerivedGroupV2Id(groupId: string): ConversationModel | undefined {
    return this._conversations.find(
      item => item.get('derivedGroupV2Id') === groupId
    );
  }

  reset(): void {
    delete this._initialPromise;
    this._initialFetchComplete = false;
    this._conversations.reset([]);
  }

  load(): Promise<void> {
    this._initialPromise ||= this.doLoad();
    return this._initialPromise;
  }

  // A number of things outside conversation.attributes affect conversation re-rendering.
  //   If it's scoped to a given conversation, it's easy to trigger('change'). There are
  //   important values in storage and the storage service which change rendering pretty
  //   radically, so this function is necessary to force regeneration of props.
  async forceRerender(identifiers?: Array<string>): Promise<void> {
    let count = 0;
    const conversations = identifiers
      ? identifiers.map(identifier => this.get(identifier)).filter(isNotNil)
      : this._conversations.models.slice();
    log.info(
      `forceRerender: Starting to loop through ${conversations.length} conversations`
    );

    for (let i = 0, max = conversations.length; i < max; i += 1) {
      const conversation = conversations[i];

      if (conversation.cachedProps) {
        conversation.oldCachedProps = conversation.cachedProps;
        conversation.cachedProps = null;

        conversation.trigger('props-change', conversation, false);
        count += 1;
      }

      if (count % 10 === 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(300);
      }
    }
    log.info(`forceRerender: Updated ${count} conversations`);
  }

  onConvoOpenStart(conversationId: string): void {
    this._conversationOpenStart.set(conversationId, Date.now());
  }

  onConvoMessageMount(conversationId: string): void {
    const loadStart = this._conversationOpenStart.get(conversationId);
    if (loadStart === undefined) {
      return;
    }

    this._conversationOpenStart.delete(conversationId);
    this.get(conversationId)?.onOpenComplete(loadStart);
  }

  repairPinnedConversations(): void {
    const pinnedIds = window.storage.get('pinnedConversationIds', []);

    for (const id of pinnedIds) {
      const convo = this.get(id);

      if (!convo || convo.get('isPinned')) {
        continue;
      }

      log.warn(
        `ConversationController: Repairing ${convo.idForLogging()}'s isPinned`
      );
      convo.set('isPinned', true);

      window.Signal.Data.updateConversation(convo.attributes);
    }
  }

  private async doLoad(): Promise<void> {
    log.info('ConversationController: starting initial fetch');

    if (this._conversations.length) {
      throw new Error('ConversationController: Already loaded!');
    }

    try {
      const collection = await getAllConversations();

      // Get rid of temporary conversations
      const temporaryConversations = collection.filter(conversation =>
        Boolean(conversation.isTemporary)
      );

      if (temporaryConversations.length) {
        log.warn(
          `ConversationController: Removing ${temporaryConversations.length} temporary conversations`
        );
      }
      const queue = new PQueue({
        concurrency: 3,
        timeout: MINUTE * 30,
        throwOnTimeout: true,
      });
      queue.addAll(
        temporaryConversations.map(item => async () => {
          await removeConversation(item.id);
        })
      );
      await queue.onIdle();

      // Hydrate the final set of conversations
      this._conversations.add(
        collection.filter(conversation => !conversation.isTemporary)
      );

      this._initialFetchComplete = true;

      await Promise.all(
        this._conversations.map(async conversation => {
          try {
            // Hydrate contactCollection, now that initial fetch is complete
            conversation.fetchContacts();

            const isChanged = maybeDeriveGroupV2Id(conversation);
            if (isChanged) {
              updateConversation(conversation.attributes);
            }

            // In case a too-large draft was saved to the database
            const draft = conversation.get('draft');
            if (draft && draft.length > MAX_MESSAGE_BODY_LENGTH) {
              conversation.set({
                draft: draft.slice(0, MAX_MESSAGE_BODY_LENGTH),
              });
              updateConversation(conversation.attributes);
            }

            // Clean up the conversations that have UUID as their e164.
            const e164 = conversation.get('e164');
            const uuid = conversation.get('uuid');
            if (isValidUuid(e164) && uuid) {
              conversation.set({ e164: undefined });
              updateConversation(conversation.attributes);

              log.info(`Cleaning up conversation(${uuid}) with invalid e164`);
            }
          } catch (error) {
            log.error(
              'ConversationController.load/map: Failed to prepare a conversation',
              error && error.stack ? error.stack : error
            );
          }
        })
      );
      log.info('ConversationController: done with initial fetch');
    } catch (error) {
      log.error(
        'ConversationController: initial fetch failed',
        error && error.stack ? error.stack : error
      );
      throw error;
    }
  }
}
