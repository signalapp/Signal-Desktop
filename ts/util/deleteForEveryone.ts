import { DeletesModelType, MessageModelType } from '../model-types.d';

const ONE_DAY = 24 * 60 * 60 * 1000;

export async function deleteForEveryone(
  message: MessageModelType,
  doe: DeletesModelType,
  shouldPersist: boolean = true
): Promise<void> {
  // Make sure the server timestamps for the DOE and the matching message
  // are less than one day apart
  const delta = Math.abs(
    doe.get('serverTimestamp') - message.get('serverTimestamp')
  );
  if (delta > ONE_DAY) {
    window.log.info('Received late DOE. Dropping.', {
      fromId: doe.get('fromId'),
      targetSentTimestamp: doe.get('targetSentTimestamp'),
      messageServerTimestamp: message.get('serverTimestamp'),
      deleteServerTimestamp: doe.get('serverTimestamp'),
    });
    return;
  }

  await message.handleDeleteForEveryone(doe, shouldPersist);
}
