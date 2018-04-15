/**
 * @prettier
 */
export interface Message {
  body?: string;
  received_at: number;
  attachments: Array<{
    data?: ArrayBuffer;
    fileName?: string;
    size?: number;
  }>;

  // TODO: Revisit
  objectURL?: string;
}
