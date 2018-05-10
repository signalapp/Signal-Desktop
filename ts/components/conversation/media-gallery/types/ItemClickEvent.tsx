/**
 * @prettier
 */
import { AttachmentType } from './AttachmentType';
import { Message } from './Message';

export interface ItemClickEvent {
  message: Message;
  type: AttachmentType;
}
