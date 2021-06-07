import _ from 'lodash';
import { SignalService } from '../protobuf';
import { sha256 } from '../session/crypto';

const recentHashByConvo = new Map<string, Array<string>>();

const maxHashToKeepPerConvo = 50;

export function isDuplicateBasedOnHash(
  dataMessage: SignalService.DataMessage,
  conversationId: string,
  sender: string
): boolean {
  const toUseForHash = {
    ..._.omit(
      SignalService.DataMessage.toObject(dataMessage),
      'timestamp',
      'profile',
      'preview',
      'profileKey'
    ),
    conversationId,
    sender,
  };

  if (!recentHashByConvo.has(conversationId)) {
    recentHashByConvo.set(conversationId, new Array());
  }
  const newHash = sha256(JSON.stringify(toUseForHash));

  // this can only be set based on the .set above()
  let recentHashForConvo = recentHashByConvo.get(conversationId) as Array<string>;

  // this hash already exists for this convo
  if (recentHashForConvo.some(n => n === newHash)) {
    return true;
  }
  // push the new hash at the end
  recentHashForConvo.push(newHash);
  if (recentHashForConvo.length > maxHashToKeepPerConvo) {
    // slice the last maxHashToKeepPerConvo hashes
    recentHashForConvo = recentHashForConvo?.slice(-maxHashToKeepPerConvo);
  }
  recentHashByConvo.set(conversationId, recentHashForConvo);
  return false;
}

// build a hash of the data and check against recent messages
