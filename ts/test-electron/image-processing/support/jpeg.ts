import type { OutputInfo } from 'sharp';
import sharpJpg from 'sharp';
import { getTempPath, type FileInfo } from '.';

export const fromBuffer = async (
  buffer: Buffer | undefined
): Promise<FileInfo> => {
  const { info, data } = await toJpg(buffer);

  return {
    path: await getTempPath(),
    buffer: data,
    dimensions: {
      width: info.width,
      height: info.height,
    },
    size: info.size,
  };
};

export const fromFile = async (filePath: string): Promise<FileInfo> => {
  const { info, data: buffer } = await toJpg(filePath);

  return {
    path: filePath,
    buffer,
    dimensions: {
      width: info.width,
      height: info.height,
    },
    size: info.size,
  };
};

const toJpg = (
  file: string | Buffer | undefined
): Promise<{ data: Buffer; info: OutputInfo }> => {
  const jpegFile = sharpJpg(file, {});
  return jpegFile.toBuffer({
    resolveWithObject: true,
  });
};
