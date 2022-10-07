import { RingBuffer } from '../../../utils/RingBuffer';

const rollingDeletedMessageIds: Map<string, RingBuffer<number>> = new Map();

// keep 2000 deleted message ids in memory
const perRoomRollingRemovedIds = 2000;

const addMessageDeletedId = (conversationId: string, messageDeletedId: number) => {
  if (!rollingDeletedMessageIds.has(conversationId)) {
    rollingDeletedMessageIds.set(conversationId, new RingBuffer<number>(perRoomRollingRemovedIds));
  }
  const ringBuffer = rollingDeletedMessageIds.get(conversationId);
  if (!ringBuffer) {
    return;
  }
  ringBuffer.add(messageDeletedId);
};


const hasMessageDeletedId = (conversationId: string, messageDeletedId: number) => {
  if (!rollingDeletedMessageIds.has(conversationId)) {
    return false;
  }

  const messageIdWasDeletedRecently = rollingDeletedMessageIds
    ?.get(conversationId)
    ?.has(messageDeletedId);

  return messageIdWasDeletedRecently;
};

export const sogsRollingDeletions = { addMessageDeletedId, hasMessageDeletedId };
