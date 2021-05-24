# Session Desktop

## Summary

Session integrates directly with [Oxen Service Nodes](https://docs.oxen.io/about-the-oxen-blockchain/oxen-service-nodes), which are a set of distributed, decentralized and Sybil resistant nodes. Service Nodes act as servers which store messages offline, and a set of nodes which allow for onion routing functionality obfuscating users IP Addresses. For a full understanding of how Session works, read the [Session Whitepaper](https://getsession.org/whitepaper).
<br/><br/>
![DesktopSession](https://i.imgur.com/ZnHvYjo.jpg)

## Want to Contribute? Found a Bug or Have a feature request?

Please search for any [existing issues](https://github.com/oxen-io/session-desktop/issues) that describe your bugs in order to avoid duplicate submissions. <br><br>Submissions can be made by making a pull request to our development branch. If you don't know where to start contributing, try reading the Github issues page for ideas.

## Build instruction

Build instructions can be found in [BUILDING.md](BUILDING.md).


## Verifing signatures


Get Kee's key and import it:
```
wget https://raw.githubusercontent.com/oxen-io/oxen-core/master/utils/gpg_keys/KeeJef.asc
gpg --import KeeJef.asc
```

Get the signed hash for this release, the SESSION_VERSION needs to be updated for the release you want to verify
```
export SESSION_VERSION=1.6.1
wget https://github.com/oxen-io/session-desktop/releases/download/v$SESSION_VERSION/signatures.asc
```

Verify the signature of the hashes of the files

```
gpg --verify signatures.asc 2>&1 |grep "Good signature from"
```

The command above should print "`Good signature from "Kee Jefferys...`"
If it does, the hashes are valid but we still have to make the sure the signed hashes matches the downloaded files.

Make sure the two commands below returns the same hash.
If they do, files are valid
```
sha256sum session-desktop-linux-amd64-$SESSION_VERSION.deb
grep .deb signatures.asc
```


## Debian repository

Please visit https://deb.oxen.io/<br/>

## License

Copyright 2011 Whisper Systems<br/>
Copyright 2013-2017 Open Whisper Systems<br/>
Copyright 2019-2020 The Loki Project<br/>
Licensed under the GPLv3: http://www.gnu.org/licenses/gpl-3.0.html<br/>
