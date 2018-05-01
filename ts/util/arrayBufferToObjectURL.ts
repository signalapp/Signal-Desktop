/**
 * @prettier
 */
import { MIMEType } from '../types/MIME';

export const arrayBufferToObjectURL = ({
  data,
  type,
}: {
  data: ArrayBuffer;
  type: MIMEType;
}): string => {
  const blob = new Blob([data], { type });
  return URL.createObjectURL(blob);
};
