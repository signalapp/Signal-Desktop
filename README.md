TextSecure Chromium Implementation
==================================

This is very early stuff and exists primarily to get the crypto in place.
Note that the code is currently quite messy (its all in one file!), but it
needs to work first, then it can be heavily cleaned up later.

Getting Started with Development
================================

* Clone the repo
* Open Chrome
* Go to chrome://extensions/
* Enable developer mode (checkbox on the top right)
* Click "Load unpacked extension..."
* Point to the repo's directory

Tests
=====
Please write tests! Our testing framework is mocha and our assertion library is
chai:

  * http://visionmedia.github.io/mocha/
  * http://chaijs.com/api/assert/

Tips/Tricks
===========

* For Dev purposes, the test server always uses code 111111
* Loading the `test.html` page may read, write or clear localStorage. To avoid
  having to choose between running tests and preserving your existing messages,
  keys, and other extension data, much of the test suite can be run by starting
  a local webserver in the repository root, e.g. `python -m SimpleHTTPServer`.
  You can then access the test page at `http://0.0.0.0:8000/test.html`.
