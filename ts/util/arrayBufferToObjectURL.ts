import { isArrayBuffer } from 'lodash';
import { MIMEType } from '../types/MIME';

export const arrayBufferToObjectURL = ({
  data,
  type,
}: {
  data: ArrayBuffer;
  type: MIMEType;
}): string => {
  if (!isArrayBuffer(data)) {
    throw new TypeError('`data` must be an ArrayBuffer');
  }

  const blob = new Blob([data], { type });

  return URL.createObjectURL(blob);
};
