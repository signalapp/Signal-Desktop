Loki Messenger
==========================
Loki Messenger allows for truly decentralized and end to end and private encrypted chats, Loki Messenger is built to handle both online and fully Asynchronous offline messages , Loki messenger implements the Signal protocol for message encryption, Our Client interface is a fork of [Signal Messenger](https://signal.org/). All communication that passes through Loki messenger is routed through [Lokinet](https://github.com/loki-project/loki-network).

## Summary

Loki messenger integrates directly with Loki Service Nodes, which are a set of distributed, decentralized and Sybil resistant nodes. Service Nodes act as both federated servers which store messages offline, and a set of nodes which allow for mixnet functionality obfuscating users IP Addresses. For a full understanding of how Loki messenger works, read the [Loki whitepaper](https://loki.network/wp-content/uploads/2018/08/LokiWhitepaperV3_1.pdf)

**Online Messages** 

If Alice and Bob are both online they can simply resolve each others public keys, to introduction sets, this functionality is handled by interfacing with Lokinet. With the appropriate introduction sets Alice and Bob can create a path and using onion routing pass messages through the Loki network without giving away personally identifiable information like their IP address.

**Offline messages**

Offline messaging uses Swarms, given any users public key the user can resolve a public key to a specific grouping of Service Nodes (AKA Swarm) each user in Loki Messenger belongs to a Swarm. When routing a message offline the user selects a Service node in the destination users Swarm, when the user comes online they query any node in their Swarm, if the Swarm is holding any messages for the user they disseminate those messages to the user.

![Swarm Messaging](https://i.imgur.com/o13Knds.png)

Spam protections for Loki Messenger are based on a Proof of Work which is attached to any message that exceeds a default size or Time To Live, this process is discussed further in the [Loki whitepaper](https://loki.network/wp-content/uploads/2018/08/LokiWhitepaperV3_1.pdf).

## Want to Contribute? Found a Bug or Have a feature request? 

Please search for any [existing issues](https://github.com/loki-project/loki-messenger/issues) that describe your bugs in order to avoid duplicate submissions. Submissions can be made by making a pull request to our development branch, if you don't know where to start contributing , try reading the Github issues page for ideas.

## License

Copyright 2018- Current, Loki Foundation
Copyright 2014-2018, Open Whisper Systems
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
