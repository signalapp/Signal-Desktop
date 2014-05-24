TextSecure Chromium Implementation
==================================

This is very early stuff and exists primarily to get the crypto in place.
It is currently chromium-only as it uses NaCL for Curve25519 stuff, but I'd be
glad to accept a pull that abstracts out the NaCL-specific stuff to optionally
use a JS implementation for FF.
Note that the code is currently quite messy (its all in one file!), but it
needs to work first, then it can be heavily cleaned up later.

Developing
===========

* Clone the repo
* Open Chrome
* Go to chrome://extensions/
* Enable developer mode (checkbox on the top right)
* Click "Load unpacked extension..."
* Point to the repo's directory
