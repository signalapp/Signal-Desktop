# Post-Quantum Encryption for Signal Desktop

**Final Year Project** — Integrating ML-KEM-768 post-quantum cryptography into Signal Desktop's messaging pipeline.

## Overview

This fork of [Signal Desktop](https://github.com/signalapp/Signal-Desktop) (v7.81.0) adds a hybrid post-quantum encryption layer on top of Signal's existing Double Ratchet protocol. The goal is to protect message confidentiality against future quantum computer attacks ("harvest now, decrypt later" threat model) while maintaining backward compatibility.

## Architecture

The implementation wraps Signal's existing encryption with an additional layer:

```
Plaintext → Signal Protocol (Double Ratchet) → ML-KEM-768 + AES-256-GCM → Ciphertext
```

### Key Components

| File | Description |
|------|-------------|
| `ts/textsecure/PQWrapper.ts` | Core PQ encryption module — ML-KEM-768 key generation, encapsulation/decapsulation, AES-256-GCM authenticated encryption |
| `ts/textsecure/OutgoingMessage.preload.ts` | Modified to apply PQ encryption before message queue |
| `ts/textsecure/MessageReceiver.preload.ts` | Modified to apply PQ decryption on incoming messages |
| `ts/textsecure/pqBenchmarkLogger.ts` | JSONL benchmark logging for measuring PQ operation overhead |
| `ts/textsecure/pqSharedDir.ts` | Cross-instance shared directory for local PQ key exchange |
| `scripts/energy-monitor.sh` | CPU/memory monitoring script for energy analysis |

### How It Works

1. **Key Exchange**: Each client generates an ML-KEM-768 keypair and shares its public key via a shared directory (local testing mode)
2. **Sending**: If the recipient's PQ public key is available, the message is encapsulated using ML-KEM-768 and encrypted with AES-256-GCM. Otherwise, a handshake message is sent containing the sender's public key.
3. **Receiving**: PQ-encrypted messages are decapsulated and decrypted. Handshake messages trigger public key storage for future encrypted communication.

## Technologies

- **ML-KEM-768** (NIST FIPS 203) — Module-Lattice-Based Key Encapsulation Mechanism
- **AES-256-GCM** — Authenticated encryption for the message payload
- **[@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum)** — Pure TypeScript ML-KEM implementation
- **[@noble/ciphers](https://github.com/paulmillr/noble-ciphers)** — AES-GCM implementation

## Benchmarking

The implementation includes built-in benchmarking that logs timing data for:
- ML-KEM key generation, encapsulation, and decapsulation
- AES-256-GCM encryption and decryption
- Total PQ overhead per message (sender and receiver)

Benchmark data is written as JSONL to `~/SignalPQBenchmarks/`.

## Running Locally

```bash
# Install dependencies
pnpm install

# Build (required after code changes)
pnpm run build:esbuild

# Run two instances for testing
NODE_APP_INSTANCE=alice pnpm start    # Terminal 1
NODE_APP_INSTANCE=bob pnpm start      # Terminal 2
```

Toggle PQ encryption on/off via `PQ_ENABLED` in `ts/textsecure/PQWrapper.ts`.

## Results

With PQ enabled, each message incurs approximately 1.5–2.5 ms of additional overhead for the combined ML-KEM + AES-GCM operations — negligible for real-time messaging.

## License

Same as Signal Desktop — [AGPL-3.0](LICENSE).
