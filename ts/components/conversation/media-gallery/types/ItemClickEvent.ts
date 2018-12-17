import { AttachmentType } from '../../types';
import { Message } from './Message';

export interface ItemClickEvent {
  message: Message;
  attachment: AttachmentType;
  type: 'media' | 'documents';
}
