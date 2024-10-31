// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import createDebug from 'debug';
import type {
  Group,
  PrimaryDevice,
  Server,
  StorageStateRecord,
} from '@signalapp/mock-server';
import { StorageState, Proto } from '@signalapp/mock-server';
import path from 'path';
import fs from 'fs/promises';
import { range } from 'lodash';
import { CallLinkRootKey } from '@signalapp/ringrtc';
import { App } from '../playwright';
import { Bootstrap } from '../bootstrap';
import type { BootstrapOptions } from '../bootstrap';
import { MY_STORY_ID } from '../../types/Stories';
import { uuidToBytes } from '../../util/uuidToBytes';
import { artAddStickersRoute } from '../../util/signalRoutes';
import { getRoomIdFromRootKey } from '../../util/callLinksRingrtc';

export const debug = createDebug('mock:test:storage');

export { App, Bootstrap };

const GROUP_SIZE = 8;

const IdentifierType = Proto.ManifestRecord.Identifier.Type;

export type InitStorageResultType = Readonly<{
  bootstrap: Bootstrap;
  app: App;
  group: Group;
  members: ReadonlyArray<PrimaryDevice>;
}>;

//
// This function creates an initial storage service state that includes:
//
// - All contacts from contact sync (first contact pinned)
// - A pinned group with GROUP_SIZE members (from the contacts)
// - Account with e164 and profileKey
//
// In addition to above, this function will queue one incoming message in the
// group, and one for the first contact (so that both will appear in the left
// pane).
export async function initStorage(
  options?: BootstrapOptions
): Promise<InitStorageResultType> {
  // Creates primary device, contacts
  const bootstrap = new Bootstrap(options);

  await bootstrap.init();

  try {
    // Populate storage service
    const { contacts, phone } = bootstrap;

    const [firstContact] = contacts;

    const members = [...contacts].slice(0, GROUP_SIZE);

    const group = await phone.createGroup({
      title: 'Mock Group',
      members: [phone, ...members],
    });

    let state = StorageState.getEmpty();

    state = state.updateAccount({
      profileKey: phone.profileKey.serialize(),
      givenName: phone.profileName,
    });

    state = state
      .addGroup(group, {
        whitelisted: true,
      })
      .pinGroup(group);

    for (const contact of contacts) {
      state = state.addContact(contact, {
        identityState: Proto.ContactRecord.IdentityState.VERIFIED,
        whitelisted: true,

        identityKey: contact.publicKey.serialize(),
        profileKey: contact.profileKey.serialize(),
        givenName: contact.profileName,
      });
    }

    state = state.pin(firstContact);

    state = state.addRecord({
      type: IdentifierType.STORY_DISTRIBUTION_LIST,
      record: {
        storyDistributionList: {
          allowsReplies: true,
          identifier: uuidToBytes(MY_STORY_ID),
          isBlockList: true,
          name: MY_STORY_ID,
          recipientServiceIds: [],
        },
      },
    });

    await phone.setStorageState(state);

    // Link new device
    const app = await bootstrap.link();

    const { desktop } = bootstrap;

    // Send a message to the group and the first contact
    const contactSend = contacts[0].sendText(desktop, 'hello from contact', {
      timestamp: bootstrap.getTimestamp(),
      sealed: true,
    });

    const groupSend = members[0].sendText(desktop, 'hello in group', {
      timestamp: bootstrap.getTimestamp(),
      sealed: true,
      group,
    });

    await Promise.all([contactSend, groupSend]);

    return { bootstrap, app, group, members };
  } catch (error) {
    await bootstrap.saveLogs();
    throw error;
  }
}

export const FIXTURES = path.join(__dirname, '..', '..', '..', 'fixtures');

export const EMPTY = new Uint8Array(0);

export type StickerPackType = Readonly<{
  id: Buffer;
  key: Buffer;
  stickerCount: number;
}>;

export const STICKER_PACKS: ReadonlyArray<StickerPackType> = [
  {
    id: Buffer.from('c40ed069cdc2b91eccfccf25e6bcddfc', 'hex'),
    key: Buffer.from(
      'cefadd6e81c128680aead1711eb5c92c10f63bdfbc78528a4519ba682de396e4',
      'hex'
    ),
    stickerCount: 1,
  },
  {
    id: Buffer.from('ae8fedafda4768fd3384d4b3b9db963d', 'hex'),
    key: Buffer.from(
      '53f4aa8b95e1c2e75afab2328fe67eb6d7affbcd4f50cd4da89dfc325dbc73ca',
      'hex'
    ),
    stickerCount: 1,
  },
];

export function getStickerPackLink(pack: StickerPackType): string {
  return artAddStickersRoute
    .toWebUrl({
      packId: pack.id.toString('hex'),
      packKey: pack.key.toString('hex'),
    })
    .toString();
}

export function getStickerPackRecordPredicate(
  pack: StickerPackType
): (record: StorageStateRecord) => boolean {
  return ({ type, record }: StorageStateRecord): boolean => {
    if (type !== IdentifierType.STICKER_PACK) {
      return false;
    }
    return pack.id.equals(record.stickerPack?.packId ?? EMPTY);
  };
}

export async function storeStickerPacks(
  server: Server,
  stickerPacks: ReadonlyArray<StickerPackType>
): Promise<void> {
  await Promise.all(
    stickerPacks.map(async ({ id, stickerCount }) => {
      const hexId = id.toString('hex');

      await server.storeStickerPack({
        id,
        manifest: await fs.readFile(
          path.join(FIXTURES, `stickerpack-${hexId}.bin`)
        ),
        stickers: await Promise.all(
          range(0, stickerCount).map(async index =>
            fs.readFile(
              path.join(FIXTURES, `stickerpack-${hexId}-${index}.bin`)
            )
          )
        ),
      });
    })
  );
}

export function getCallLinkRecordPredicate(
  roomId: string
): (record: StorageStateRecord) => boolean {
  return ({ type, record }: StorageStateRecord): boolean => {
    const rootKeyBytes = record.callLink?.rootKey;
    if (type !== IdentifierType.CALL_LINK || rootKeyBytes == null) {
      return false;
    }
    const recordRootKey = CallLinkRootKey.fromBytes(Buffer.from(rootKeyBytes));
    const recordRoomId = getRoomIdFromRootKey(recordRootKey);
    return roomId === recordRoomId;
  };
}
