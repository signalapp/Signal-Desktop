import { readFileSync, statSync } from 'fs';
import type { PNGWithMetadata } from 'pngjs';
import { PNG } from 'pngjs';
import path from 'path';
import { v4 as getGuid } from 'uuid';
import type { BaseAttachmentDraftType } from '../../../types/Attachment';
import { fromBuffer, fromFile } from './jpeg';
import { createTempDir } from '../../../updater/common';
import { sniffImageMimeType } from '../../../util/sniffImageMimeType';
import type { MIMEType } from '../../../types/MIME';
import { IMAGE_PNG } from '../../../types/MIME';
import { sha256 as toSha256 } from '../../../Crypto';

export { createTempDir } from '../../../updater/common';

export const log = (...msg: Array<unknown>): void =>
  window.testUtilities.debug(msg);

export type Result = {
  data: Uint8Array;
  clientUuid: string;
  pending: false;
  screenshotData?: Uint8Array;
  fileName?: string;
  path?: string;
} & BaseAttachmentDraftType;

export type Dimensions = { width?: number; height?: number };

export type FileInfo = {
  path: string;
  dimensions?: Dimensions;
  size: number;
  buffer?: Buffer;
};

export const fileSize = (file: string): number => statSync(file).size;

export const MiB = 1024 * 1024;

export type AnnotatedBlob = {
  blob: Blob;
  size: Dimensions;
  originalSize: Dimensions;
};

export const png = (file: string | Buffer): PNGWithMetadata =>
  PNG.sync.read(Buffer.isBuffer(file) ? file : readFileSync(file));

export const jpeg = (file: string | Buffer): Promise<FileInfo> =>
  Buffer.isBuffer(file) ? fromBuffer(file) : fromFile(file);

export const jpegDimensions = async (
  file: string | Buffer
): Promise<Dimensions | undefined> =>
  (await (Buffer.isBuffer(file) ? fromBuffer(file) : fromFile(file)))
    .dimensions;

export const pngDimensions = (file: Buffer): Dimensions => {
  const fileType = getFileType(file);

  if (fileType !== IMAGE_PNG) {
    throw new Error(
      `The supplied buffer does not represent a PNG file, it has type <${fileType}>`
    );
  }

  const image = png(file);

  return { width: image.width, height: image.height };
};

const getFileType = (buffer: Buffer): MIMEType => {
  const type = sniffImageMimeType(buffer);

  if (!type) {
    throw new Error('Unknown file type');
  }

  return type;
};

export const getTempPath = async (
  filename: string | undefined = undefined
): Promise<string> => path.join(await createTempDir(), filename || getGuid());

export const sha256 = (file: string): string =>
  Buffer.from(toSha256(readFileSync(file))).toString('hex');
