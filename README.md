# Session

[![Build Status](https://travis-ci.org/loki-project/loki-messenger.svg?branch=development)](https://travis-ci.org/loki-project/loki-messenger)

Session allows for truly decentralized, end to end, and private encrypted chats. Session is built to handle both online and fully Asynchronous offline messages. Session implements the Signal protocol for message encryption. Our Client interface is a fork of [Signal Messenger](https://signal.org/).

## Summary

Session integrates directly with Loki [Service Nodes](https://lokidocs.com/ServiceNodes/SNOverview/), which are a set of distributed, decentralized and Sybil resistant nodes. Service Nodes act as servers which store messages offline, and a set of nodes which allow for onion routing functionality obfuscating users IP Addresses. For a full understanding of how Session works, read the [Loki whitepaper](https://loki.network/whitepaper).

**Offline messages**

Offline messaging uses Swarms, given any users public key the user can resolve a public key to a specific grouping of Service Nodes (AKA Swarm) each user in Session belongs to a Swarm. When routing a message offline the user selects a Service node in the destination users Swarm, when the user comes online they query any node in their Swarm, if the Swarm is holding any messages for the user they disseminate those messages to the user.

![Swarm Messaging](https://i.imgur.com/o13Knds.png)

Spam protections for Session are based on a Proof of Work which is attached to any message that exceeds a default size or Time To Live, this process is discussed further in the [Loki whitepaper](https://loki.network/whitepaper).

## Want to Contribute? Found a Bug or Have a feature request?

Please search for any [existing issues](https://github.com/loki-project/loki-messenger/issues) that describe your bugs in order to avoid duplicate submissions. Submissions can be made by making a pull request to our development branch, if you don't know where to start contributing , try reading the Github issues page for ideas.

## Build instruction

Build instructions can be found in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Copyright 2018- Current, Loki Foundation
Copyright 2014-2018, Open Whisper Systems
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
