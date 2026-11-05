---
'@signalapp/mock-server': major
---

Remove the `PUT /v1/accounts/username_hash/confirm` route; use the gRPC `Accounts/ConfirmUsernameHash` handler instead
