Contributor Guidelines
=====================

## Installation and setup

* Clone the repo
* Open Chrome
* Go to chrome://extensions/
* Enable developer mode (checkbox on the top right)
* Click "Load unpacked extension..."
* Point to the repo's directory

Note that for development, you should always be using the staging server, which
uses a [self-signed ssl
certificate](https://github.com/WhisperSystems/TextSecure-Browser/issues/110).
By default, your browser will reject this certificate as insecure. Therefore,
in order to register or send and receive messages of any kind, you must first
visit <https://textsecure-service-staging.whispersystems.org/> in a new tab and
click through the warnings to allow the certificate. If at any time you notice
a console error about an "INSECURE RESPONSE" or "Handshake was canceled",
repeat this step.

Once that's done, you can register for TextSecure using the instructions below:

**NOTE:** This is only for developers and will not be presented to users.

* Navigate to chrome-extension://.../register.html
* Enter a real phone number (Google Voice numbers work too) and country
  combination and choose to send an SMS. You will receive a real SMS.
* Enter the verification code you received by SMS.

You should now be able to use the extension. If you need to re-register, open a
browser console within the extension options page (or inspect
`background.html`) and execute `localStorage.clear()` to delete your account
information.

## Chrome profiles

Don't have any friends to help you test the extension? Make a couple of Chrome
profiles. Each one will need its own Google account and Google Voice number.
Each one will have to repeat the setup process documented above, including
re-accepting the staging server cert under each profile. This is a tedious
process, but once you are done you will be able to send messages back and forth
between different profiles, allowing you to observe both endpoints of a
conversation.

## Pull requests

So you wanna make a pull request? Please observe the following guidelines.

 * Rebase your changes on the latest master branch, resolving any conflicts
   that may arise. This ensures that your changes will merge cleanly when you
   open your PR.
 * Run the tests locally by opening the test page in your browser. A
   test-breaking change will not be merged.
 * Make sure the diff between our master and your branch contains only the
   minimal set of changes needed to implement your feature or bugfix. This will
   make it easier for the person reviewing your code to approve the changes.
   Please do not submit a PR with commented out code or unfinished features.
 * Don't have too many commits. If your branch contains spurious commits along
   the lines of "Oops, reverted this change" or "Just experiementing, will
   delete this later", please squash or rebase those changes out.
 * Don't have too few commits. If you have a complicated or long lived feature
   branch, it may make sense to break the changes up into logical atomic chunks
   to aid in the review process.
 * Provide a well written and nicely formatted commit message. See [this
   link](http://chris.beams.io/posts/git-commit/)
   for some tips on formatting. As far as content, try to include in your
   summary
     1. What you changed
     2. Why this change was made (including git issue # if appropriate)
     3. Any relevant technical details or motivations for your implementation
        choices that may be helpful to someone reviewing or auditing the commit
        history in the future. When in doubt, err on the side of a longer
        commit message.

## Dependencies

**Note**: Unless you need to make changes to dependencies, you can skip this
section and just use the checked in versions.

Dependencies are managed by [bower](http://bower.io) and built with
[grunt](http://gruntjs.com). To change them, you'll need to install node and
npm, then run `npm install` to install bower, grunt, and related plugins.

### Adding a bower component

Add the package name and version to bower.json under 'dependencies' or `bower
install package-name --save`

Next update the "preen" config in bower.json with the list of files we will
actually use from the new package, e.g.:
```
  "preen": {
    "package-name": [
      "path/to/main.js",
      "directory/**/*.js"
    ],
    ...
  }
```
If you'd like to add the new dependency to js/components.js to be included on
all html pages, simply append the package name to the concat.app list in
`bower.json`. Take care to insert it in the order you would like it
concatenated.

Now, run `grunt` to delete unused package files and build `js/components.js`.

Finally, stage and commit changes to bower.json, `js/components.js`,
and `components/`. The latter should be limited to files we actually use.

## Tests
Please write tests! Our testing framework is
[mocha](http://mochajs.org/) and our assertion library is
[chai](http://chaijs.com/api/assert/).

To run tests, open `test/index.html` in your browser. Note that

 * Some tests depend on the native client module. These will fail unless you
   load the test page from the `chrome-extension://` namespace (as opposed to
   the `file://` namespace or via a local webserver.
 * Some tests may read, write or clear localStorage. It is recommended that you
   create a Chrome user profile just for running tests to avoid clobbering any
   existing account and message data.
