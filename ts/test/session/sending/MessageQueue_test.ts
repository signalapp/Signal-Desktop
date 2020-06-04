// import { expect } from 'chai';

// import { ChatMessage, SessionResetMessage,  } from '../../../session/messages/outgoing';
// import { TextEncoder } from 'util';
// import { MessageUtils } from '../../../session/utils';
// import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';

// describe('PendingMessageCache', () => {
//     const pendingMessageCache = new PendingMessageCache();

//     let sessionResetMessage: SessionResetMessage;
//     const preKeyBundle = {
//         deviceId: 123456,
//         preKeyId: 654321,
//         signedKeyId: 111111,
//         preKey: new TextEncoder().encode('preKey'),
//         signature: new TextEncoder().encode('signature'),
//         signedKey: new TextEncoder().encode('signedKey'),
//         identityKey: new TextEncoder().encode('identityKey'),
//     };

//     // queue with session reset message.
//     // should return undefined
//     // TOOD: Send me to MESSAGE QUEUE TEST
//     it('queue session reset message', () => {
//       const timestamp = Date.now();
//       sessionResetMessage = new SessionResetMessage({timestamp, preKeyBundle});

//     });

// });
