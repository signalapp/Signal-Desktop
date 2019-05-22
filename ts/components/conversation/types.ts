import { MIMEType } from '../../../ts/types/MIME';

export interface AttachmentType {
  caption?: string;
  contentType: MIMEType;
  fileName: string;
  /** Not included in protobuf, needs to be pulled from flags */
  isVoiceMessage?: boolean;
  /** For messages not already on disk, this will be a data url */
  url: string;
  size?: number;
  fileSize?: string;
  width?: number;
  height?: number;
  screenshot?: {
    height: number;
    width: number;
    url: string;
    contentType: MIMEType;
  };
  thumbnail?: {
    height: number;
    width: number;
    url: string;
    contentType: MIMEType;
  };
}
