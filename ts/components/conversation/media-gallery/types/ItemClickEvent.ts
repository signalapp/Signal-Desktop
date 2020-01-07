import { AttachmentType } from '../../../../types/Attachment';
import { Message } from './Message';

export interface ItemClickEvent {
  message: Message;
  attachment: AttachmentType;
  type: 'media' | 'documents';
}
