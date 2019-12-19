import { Metadata } from 'sharp';

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

// @ts-ignore
export const convertToWebp: ConvertToWebpFn = window.convertToWebp;

export type StickerData = { webp?: WebpData; emoji?: string };
export type PackMetaData = { packId: string; key: string };

export type EncryptAndUploadFn = (
  manifest: { title: string; author: string },
  stickers: Array<StickerData>,
  cover: WebpData,
  onProgress?: () => unknown
) => Promise<PackMetaData>;

// @ts-ignore
export const encryptAndUpload: EncryptAndUploadFn = window.encryptAndUpload;
