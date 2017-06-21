Contributor Guidelines
======================

## Advice for new contributors

Start small. The PRs most likely to be merged are the ones that make small,
easily reviewed changes with clear, and specific intentions. See below for more
[guidelines on pull requests](#pull-requests).

Stick to issues that are
[on the roadmap](https://github.com/WhisperSystems/Signal-Desktop/issues?q=is%3Aopen+is%3Aissue+milestone%3A%22On+the+roadmap%22).
Issues that are not included in this milestone may be not yet triaged,
unplanned, or not actionable for one reason or another.

If you start working on an issue, leave a comment to let others know. It is
also a good idea to outline your approach to the problem in order to get
feedback.

## Developer Setup
```
git clone https://github.com/WhisperSystems/Signal-Desktop.git
cd Signal-Desktop
npm install            # install dependencies
npm start              # run
```

Some features, such as native notifications, will not work locally until you
package for your platform:

```
npm run pack-staging   # build a packaged app dir in ./dist
```
```
npm run dist-staging   # build installer (.dmg, .exe, or .deb)
```

For development, you should always be using the staging server.
Registrations on the staging server are completely partitioned from the
production server that the mobile apps use. A production app from the Play
store or iTunes is hard-coded to connect to the production server. If you wish
to pair your phone and computer, or test sending between the browser and
mobile, **you must build a mobile client that targets the staging server**
(see below, under [Linking](#linking)).

## Linking


0. Build Signal for Android or iOS from source, and point its TextSecure service URL to `textsecure-service-staging.whispersystems.org`:
  - **on Android:** Replace the `SIGNAL_URL` value in [build.gradle](https://github.com/WhisperSystems/Signal-Android/blob/master/build.gradle)
  - **on iOS:** Replace the `textSecureServerURL` value in `TSConstants.h`(located in the SignalServiceKit pod)
    This task is 1% search and replace, 99% setting up your build environment. Instructions are available for both
   the [Android](https://github.com/WhisperSystems/Signal-Android/blob/master/BUILDING.md)
   and [iOS](https://github.com/WhisperSystems/Signal-iOS/blob/master/BUILDING.md) projects.
1. Upon installing the extension you will be presented with a qr code.
2. On your phone, open Signal and navigate to Settings > Devices. Tap the "+"
   button and scan the qr code.
3. Click through the confirmation dialog on the phone.
4. The browser will display your phone number and device name. Edit the device
   name if desired. Click ok and wait for setup to complete. Key generation can
   take up to a minute.

## Standalone Registration
**NOTE:** This is only for developers and will not be presented to users.

* Open the background page and run the following command in the console: `extension.install("standalone")`.
* Enter a real phone number (Google Voice numbers work too) and country
  combination and choose to send an SMS. You will receive a real SMS.
* Enter the verification code you received by SMS.
* Wait for key generation to complete.

You should now be able to use the extension.

## Storage profiles

To facilitate registration of multiple clients from one machine/user for
development purposes, you can configure multiple storage profiles and switch
between them using the NODE_APP_INSTANCE environment variable.

```
// config/local-alice.json
{
  "storageProfile": "aliceProfile"
}

> NODE_APP_INSTANCE=alice npm start
```

This changes the [userData](https://electron.atom.io/docs/all/#appgetpathname)
directory from `%appData%/Signal` to `%appData%/Signal-aliceProfile`.

Each profile can be independently linked or registered as standalone.
Each one will need its own Google account and Google Voice number.
Each one will have to repeat the setup process documented above, including
re-accepting the staging server cert under each profile. This is a tedious
process, but once you are done you will be able to send messages back and forth
between different profiles, allowing you to observe both endpoints of a
conversation.

## Pull requests

So you wanna make a pull request? Please observe the following guidelines.

 * Please do not submit pull requests for translation fixes. Anyone can update
   the translations in
   [Transifex](https://www.transifex.com/projects/p/signal-desktop).
 * Always localize your strings. Signal Desktop uses the
   [chrome.i18n infrastructure](https://developer.chrome.com/extensions/i18n)
   for localization. You **only** need to modify the default locale
   [`_locales/en/messages.json`](_locales/en/messages.json). Other locales are
   generated automatically based on that file and then periodically uploaded to
   Transifex for translation.
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

To run tests, use `grunt dev` or `grunt connect watch` to spin up a local
webserver, then point your browser to localhost:9999/test/index.html and
localhost:9999/libtextsecure/test/index.html
