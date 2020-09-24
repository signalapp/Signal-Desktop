import { Attachment } from '../../../../types/Attachment';

export type Message = {
  id: string;
  attachments: Array<Attachment>;
  // Assuming this is for the API
  // eslint-disable-next-line camelcase
  received_at: number;
};
