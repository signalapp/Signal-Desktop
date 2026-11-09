# @signalapp/mock-server

## 28.0.0

### Major Changes

- 3019d9d: Add a gRPC handler for Challenge/AnswerChallenge and remove the `PUT /v1/challenge` websocket route. `respondToChallengesWith()` takes `{ type: 'rejected' }` or `{ type: 'rateLimited', retryAfterSeconds }` instead of an HTTP status
- b8e1906: Add gRPC handler for Keys/GetPreKeyCount, remove the `GET /v2/keys` pre-key count route, and return zero pre-key counts for devices without keys
- 35fb23d: Add gRPC handlers for Keys/SetOneTimeEcPreKeys, Keys/SetOneTimeKemSignedPreKeys, Keys/SetEcSignedPreKey and Keys/SetKemLastResortPreKey, remove the `PUT /v2/keys` route, keep one-time pre-keys that a key upload doesn't include, and finish provisioning a linked device once it has uploaded both kinds of one-time pre-keys, even across separate requests
- f8ecd02: Add gRPC handlers for Accounts/SetRegistrationLock and Accounts/ClearRegistrationLock, and remove the `PUT` and `DELETE /v1/accounts/registration_lock` routes
- f6af7de: Add gRPC handler for Devices/SetCapabilities and remove the `PUT /v1/devices/capabilities` route
- 173d093: Sync chat gRPC protos from libsignal v0.106.0 and report CopyMedia auth failures as a STREAM_CLOSED gRPC status
- 4da1be7: Remove the `PUT /v1/accounts/username_hash/confirm` route; use the gRPC `Accounts/ConfirmUsernameHash` handler instead

### Minor Changes

- 9ba4c88: Add gRPC handler for Accounts/DeleteAccount
- 0582148: Add gRPC handler for Accounts/SetDiscoverableByPhoneNumber
- 44e6656: Add a gRPC handler for Donations/CreateDonationPermits that issues real donation permits
- c4a03dd: Add a gRPC handler for Devices/GetDevices and keep linked devices' encrypted names
- ceab077: Add a gRPC handler for KeysAnonymous/GetPreKeys
- cad7d43: Add a gRPC handler for Donations/RedeemReceipt
- c0e7934: Add gRPC handler for Devices/RemoveDevice
- 1be4f1a: Add gRPC handler for Messages/ReportMessage
- b7505dd: Add gRPC handlers for Messages/SendMessage, MessagesAnonymous/SendSingleRecipientMessage, MessagesAnonymous/SendStory and AccountsAnonymous/CheckAccountExistence, and return mismatched devices from Messages/SendSyncMessage
- a22889f: Add gRPC handler for Attachments/GetStickerUploadForm
- 2674703: Update grpc missing route handler to return UNIMPLEMENTED status instead of HTTP 404
- 2e79663: Add `getRateLimitCount()` to read a rate-limited pair's request count without clearing it
- edb0415: Add support for joining group links to mock server
- 8e3dc06: Update storage proto for hidden and favorite sticker packs

### Patch Changes

- 63fdb81: Allow empty attachmentBackfill capability
- b0e515f: Split the gRPC handlers into one file per service under `src/server/grpc/`
- 95ce9b6: Rename installed sticker pack proto for clarity with upcoming sticker records
- Updated dependencies [417c44a]
  - @signalapp/types@0.4.0

## 27.0.0

### Major Changes

- 375e413: Moves backup APIs to GRPC
- 375e413: Moves backup listMedia to GRPC

### Minor Changes

- 2886354: Make the storage item/manifest accessors synchronous so that writes can't interleave with reads

## 26.0.0

### Major Changes

- ae68dc8: gRPC support for username hash/link endpoints
