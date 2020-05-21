export interface OutgoingMessage {
  timestamp: number;
}

// Remove me once this is read
// Note for Audric, we don't have a `plainText()` function here because i realised that we use Uint8Arrays when encrypting
// It wouldn't make sense for this then to be `plainTextBuffer(): UInt8Array` as that's specific to OutgoingContentMessage.
// Thus i've left it out and moved it to outgoing content message
