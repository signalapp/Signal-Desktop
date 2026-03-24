# PQ-Signal: Post-Quantum Encryption for Signal Desktop

**Final Year Project** — Integrating ML-KEM-768 post-quantum cryptography into Signal Desktop (v7.81.0).

## Overview

This fork adds a hybrid post-quantum encryption layer to Signal Desktop's existing Double Ratchet protocol. Every message is additionally encrypted using **ML-KEM-768** (NIST FIPS 203) key encapsulation combined with **AES-256-GCM** authenticated encryption, providing defense against future quantum computing attacks.

## Architecture

```
Plaintext → Signal Protocol (Double Ratchet) → PQ Wrapper (ML-KEM-768 + AES-256-GCM) → Ciphertext
```

The PQ layer is implemented as a transparent wrapper (`PQWrapper.ts`) that sits on top of Signal's existing encryption pipeline:

- **Sender side** (`OutgoingMessage.preload.ts`): Messages are PQ-encrypted before being queued for delivery
- **Receiver side** (`MessageReceiver.preload.ts`): Incoming messages are PQ-decrypted before being passed to Signal's decryption
- **Key exchange**: ML-KEM-768 keypairs are generated per-session; shared secrets are derived via KEM encapsulation/decapsulation

## Key Files

| File | Purpose |
|------|---------|
| `ts/textsecure/PQWrapper.ts` | ML-KEM-768 + AES-256-GCM encryption/decryption, `PQ_ENABLED` toggle |
| `ts/textsecure/OutgoingMessage.preload.ts` | PQ encrypt integration on message send |
| `ts/textsecure/MessageReceiver.preload.ts` | PQ decrypt integration on message receive |
| `ts/textsecure/pqBenchmarkLogger.ts` | JSONL benchmark logging for performance analysis |
| `ts/textsecure/pqSharedDir.ts` | Cross-instance shared directory for local key exchange |
| `scripts/energy-monitor.sh` | CPU/memory monitoring script for energy analysis |

## Dependencies

- [`@noble/post-quantum`](https://github.com/paulmillr/noble-post-quantum) — ML-KEM-768 implementation
- [`@noble/ciphers`](https://github.com/paulmillr/noble-ciphers) — AES-256-GCM

## Running

```bash
# Install dependencies
pnpm install

# Build (required after code changes)
pnpm run build:esbuild

# Run two local instances for testing
NODE_APP_INSTANCE=alice pnpm start   # Terminal 1
NODE_APP_INSTANCE=bob pnpm start     # Terminal 2
```

Toggle PQ encryption on/off via the `PQ_ENABLED` flag in `PQWrapper.ts`.

## Benchmark Results

With PQ enabled, message encryption adds ~2.5ms average overhead per message (ML-KEM-768 encapsulation + AES-256-GCM encryption). See the thesis for full performance analysis including energy consumption measurements.

## Branch

All PQ integration work is on the `fyp-signal-7.81.0` branch, based on Signal Desktop v7.81.0.

## Thesis

The full thesis documenting this project is available in the companion repository.

---

*Based on [Signal Desktop](https://github.com/signalapp/Signal-Desktop) by Signal Messenger, LLC. Licensed under AGPL-3.0.*
