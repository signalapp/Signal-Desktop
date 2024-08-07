import { MessageAttributes } from '../../models/messageType';

type LokiProfile = {
  displayName: string;
  avatarPointer?: string;
  profileKey: Uint8Array | null;
};

type MessageResultProps = MessageAttributes & { snippet: string };

export { LokiProfile, MessageResultProps };
