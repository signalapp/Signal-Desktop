import { RingBuffer } from '../../../utils/RingBuffer';

const rollingDeletedMessageIds: Map<string, RingBuffer<number>> = new Map();

const addMessageDeletedId = (conversationId: string, messageDeletedId: number) => {
  if (!rollingDeletedMessageIds.has(conversationId)) {
    rollingDeletedMessageIds.set(
      conversationId,
      new RingBuffer<number>(sogsRollingDeletions.getPerRoomCount())
    );
  }
  const ringBuffer = rollingDeletedMessageIds.get(conversationId);
  if (!ringBuffer) {
    return;
  }
  ringBuffer.insert(messageDeletedId);
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

/**
 * emptyMessageDeleteIds should only be used for testing purposes.
 */
const emptyMessageDeleteIds = () => {
  rollingDeletedMessageIds.clear();
};

export const sogsRollingDeletions = {
  addMessageDeletedId,
  hasMessageDeletedId,
  emptyMessageDeleteIds,
  getPerRoomCount,
};

// keep 2000 deleted message ids in memory
function getPerRoomCount() {
  return 2000;
}
