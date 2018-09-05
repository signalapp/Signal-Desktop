import { Attachment } from '../../../../types/Attachment';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  received_at: number;
} & {
  thumbnailObjectUrl?: string;
  objectURL?: string;
};
