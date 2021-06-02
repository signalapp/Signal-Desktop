import { Attachment } from '../../../../types/Attachment';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  received_at: number;
  sent_at: number;
};
