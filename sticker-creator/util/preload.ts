import { Metadata } from 'sharp';

declare global {
  interface Window {
    convertToWebp: ConvertToWebpFn;
    encryptAndUpload: EncryptAndUploadFn;
  }
}

export type WebpData = {
  buffer: Buffer;
  src: string;
  path: string;
  meta: Metadata & { pages?: number }; // Pages is not currently in the sharp metadata type
};

export type ConvertToWebpFn = (
  path: string,
  width?: number,
  height?: number
) => Promise<WebpData>;

export type StickerData = { webp?: WebpData; emoji?: string };
export type PackMetaData = { packId: string; key: string };

export type EncryptAndUploadFn = (
  manifest: { title: string; author: string },
  stickers: Array<StickerData>,
  cover: WebpData,
  onProgress?: () => unknown
) => Promise<PackMetaData>;

export const { encryptAndUpload, convertToWebp } = window;
