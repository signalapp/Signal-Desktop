---
'@signalapp/mock-server': major
---

Add gRPC handlers for Keys/SetOneTimeEcPreKeys, Keys/SetOneTimeKemSignedPreKeys, Keys/SetEcSignedPreKey and Keys/SetKemLastResortPreKey, remove the `PUT /v2/keys` route, keep one-time pre-keys that a key upload doesn't include, and finish provisioning a linked device once it has uploaded both kinds of one-time pre-keys, even across separate requests
