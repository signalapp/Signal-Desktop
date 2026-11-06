---
'@signalapp/mock-server': major
---

Add a gRPC handler for Challenge/AnswerChallenge and remove the `PUT /v1/challenge` websocket route. `respondToChallengesWith()` takes `{ type: 'rejected' }` or `{ type: 'rateLimited', retryAfterSeconds }` instead of an HTTP status
