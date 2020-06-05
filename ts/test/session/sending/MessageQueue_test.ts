// import { expect } from 'chai';

// import { ChatMessage, SessionResetMessage } from '../../../session/messages/outgoing';
// import { TextEncoder } from 'util';
// import { MessageUtils } from '../../../session/utils';
// import { PendingMessageCache } from '../../../session/sending/PendingMessageCache';


// // Used for ExampleMessage
// import { v4 as uuid } from 'uuid';
// import { SignalService } from '../../../protobuf';

// export class ExampleMessage extends ContentMessage {
//   constructor() {
//     super({
//       timestamp: Math.floor(Math.random() * 10000000000000),
//       identifier: uuid(),
//     });
//   }

//   public ttl(): number {
//     // throw new Error("Method not implemented.");
//     return 5;
//   }

//   protected contentProto(): SignalService.Content {
//     // throw new Error("Method not implemented.");

//     // TODO - get actual content
//     const content = SignalService.Content.create();

//     return content;
//   }
// }


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
