// Copyright 2015 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  createReadStream,
  unlinkSync,
  writeFileSync,
  mkdtempSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { v4 as generateGuid } from 'uuid';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import fse from 'fs-extra';

import protobuf from '../protobuf/wrap.std.js';
import { createLogger } from '../logging/log.std.js';
import * as Bytes from '../Bytes.std.js';
import * as Errors from '../types/errors.std.js';
import {
  getAbsoluteAttachmentPath,
  deleteAttachmentData,
  readAttachmentData,
} from '../util/migrations.preload.js';
import { APPLICATION_OCTET_STREAM } from '../types/MIME.std.js';
import { type AciString, generateAci } from '../types/ServiceId.std.js';
import { SignalService as Proto } from '../protobuf/index.std.js';
import {
  ParseContactsTransform,
  parseContactsV2,
} from '../textsecure/ContactsParser.preload.js';
import type { ContactDetailsWithAvatar } from '../textsecure/ContactsParser.preload.js';
import { strictAssert } from '../util/assert.std.js';
import { toAciObject } from '../util/ServiceId.node.js';
import {
  generateKeys,
  encryptAttachmentV2ToDisk,
} from '../AttachmentCrypto.node.js';

const log = createLogger('ContactsParser_test');

const { Writer } = protobuf;

const DEFAULT_ACI = generateAci();

describe('ContactsParser', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'Signal'));
  });
  afterEach(async () => {
    await fse.remove(tempDir);
  });

  describe('parseContactsV2', () => {
    it('parses an array buffer of contacts', async () => {
      let path: string | undefined;

      try {
        const data = getTestBuffer();
        const keys = generateKeys();

        ({ path } = await encryptAttachmentV2ToDisk({
          keys,
          getAbsoluteAttachmentPath,
          needIncrementalMac: false,
          plaintext: { data },
        }));

        const contacts = await parseContactsV2({
          version: 2,
          localKey: Buffer.from(keys).toString('base64'),
          path,
          size: data.byteLength,
          contentType: APPLICATION_OCTET_STREAM,
        });

        assert.strictEqual(contacts.length, 3);

        await Promise.all(contacts.map(contact => verifyContact(contact)));
      } finally {
        if (path) {
          await deleteAttachmentData(path);
        }
      }
    });

    it('parses an array buffer of contacts with small chunk size', async () => {
      let absolutePath: string | undefined;

      try {
        const bytes = getTestBuffer();
        const fileName = generateGuid();
        absolutePath = join(tempDir, fileName);
        writeFileSync(absolutePath, bytes);

        const contacts = await parseContactsWithSmallChunkSize({
          absolutePath,
        });
        assert.strictEqual(contacts.length, 3);

        await Promise.all(contacts.map(contact => verifyContact(contact)));
      } finally {
        if (absolutePath) {
          unlinkSync(absolutePath);
        }
      }
    });

    it('parses an array buffer of contacts where one contact has no avatar', async () => {
      let absolutePath: string | undefined;

      try {
        const bytes = Bytes.concatenate([
          generatePrefixedContact(undefined),
          getTestBuffer(),
        ]);

        const fileName = generateGuid();
        absolutePath = join(tempDir, fileName);
        writeFileSync(absolutePath, bytes);

        const contacts = await parseContactsWithSmallChunkSize({
          absolutePath,
        });
        assert.strictEqual(contacts.length, 4);

        await Promise.all(
          contacts.map((contact, index) => {
            const avatarIsMissing = index === 0;
            return verifyContact(contact, avatarIsMissing);
          })
        );
      } finally {
        if (absolutePath) {
          unlinkSync(absolutePath);
        }
      }
    });
  });
});

class SmallChunksTransform extends Transform {
  constructor(private chunkSize: number) {
    super();
  }

  override _transform(
    incomingChunk: Buffer | undefined,
    _encoding: string,
    done: (error?: Error) => void
  ) {
    if (!incomingChunk || incomingChunk.byteLength === 0) {
      done();
      return;
    }

    try {
      const totalSize = incomingChunk.byteLength;

      const chunkCount = Math.floor(totalSize / this.chunkSize);
      const remainder = totalSize % this.chunkSize;

      for (let i = 0; i < chunkCount; i += 1) {
        const start = i * this.chunkSize;
        const end = start + this.chunkSize;
        this.push(incomingChunk.subarray(start, end));
      }
      if (remainder > 0) {
        this.push(incomingChunk.subarray(chunkCount * this.chunkSize));
      }
    } catch (error) {
      done(error);
      return;
    }

    done();
  }
}

function generateAvatar(): Uint8Array {
  const result = new Uint8Array(255);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = i;
  }
  return result;
}

function getTestBuffer(): Uint8Array {
  const avatarBuffer = generateAvatar();
  const prefixedContact = generatePrefixedContact(avatarBuffer);

  const chunks: Array<Uint8Array> = [];
  for (let i = 0; i < 3; i += 1) {
    chunks.push(prefixedContact);
    chunks.push(avatarBuffer);
  }

  return Bytes.concatenate(chunks);
}

function generatePrefixedContact(
  avatarBuffer: Uint8Array | undefined,
  aci: AciString | null = DEFAULT_ACI
) {
  const contactInfoBuffer = Proto.ContactDetails.encode({
    name: 'Zero Cool',
    number: '+10000000000',
    aciBinary: aci == null ? null : toAciObject(aci).getRawUuidBytes(),
    avatar: avatarBuffer
      ? { contentType: 'image/jpeg', length: avatarBuffer.length }
      : undefined,
  }).finish();

  const writer = new Writer();
  writer.bytes(contactInfoBuffer);
  const prefixedContact = writer.finish();
  return prefixedContact;
}

async function verifyContact(
  contact: ContactDetailsWithAvatar,
  avatarIsMissing?: boolean
): Promise<void> {
  assert.strictEqual(contact.name, 'Zero Cool');
  assert.strictEqual(contact.number, '+10000000000');
  assert.strictEqual(contact.aci, DEFAULT_ACI);

  if (avatarIsMissing) {
    return;
  }

  strictAssert(contact.avatar?.path, 'Avatar needs path');

  const avatarBytes = await readAttachmentData(contact.avatar);
  await deleteAttachmentData(contact.avatar.path);

  for (let j = 0; j < 255; j += 1) {
    assert.strictEqual(avatarBytes[j], j);
  }
}

async function parseContactsWithSmallChunkSize({
  absolutePath,
}: {
  absolutePath: string;
}): Promise<ReadonlyArray<ContactDetailsWithAvatar>> {
  const logId = 'parseContactsWithSmallChunkSize';

  const readStream = createReadStream(absolutePath);
  const smallChunksTransform = new SmallChunksTransform(32);
  const parseContactsTransform = new ParseContactsTransform();

  try {
    await pipeline(readStream, smallChunksTransform, parseContactsTransform);
  } catch (error) {
    try {
      readStream.close();
    } catch (cleanupError) {
      log.error(
        `${logId}: Failed to clean up after error`,
        Errors.toLogFormat(cleanupError)
      );
    }

    throw error;
  }

  readStream.close();

  return parseContactsTransform.contacts;
}
