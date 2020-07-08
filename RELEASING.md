# Releasing

Creating a new Session Desktop release is very simple.

1.  Bump up the version in `package.json`.
2.  Merge all changes required into the `master` branch.
    * This will trigger github actions to start building a draft release
3.  After github actions has finished building. Go to Release page in the repository.
4.  Click on the draft release and change the tag target to `master`.
5.  Add in release notes.
6.  Generate gpg signatures.
7.  Click publish release.

## Notes

Artifacts attached in the release shouldn't be deleted! These include the yml files (latest, latest-mac, latest-linux). These are all necessary to get auto updating to work correctly.

### Mac

Mac currently uses 2 formats `dmg` and `zip`.
We need the `zip` format for auto updating to work correctly.
We also need the `dmg` because on MacOS Catalina, there is a system bug where extracting the artifact `zip` using the default _Archive Utility_ will make it so the extracted application is invalid and it will fail to open. A work around for this is to extract the `zip` using an alternate program such as _The Unarchiver_.

Once this bug is fixed we can go back to using the `zip` format by itself.

## Linux Flatpak

Flatpak generation is different from the normal build process and thus must be done once we have the final build binaries.

1. Clone https://github.com/flathub/network.loki.Session
2. Update `network.loki.Session.metainfo.xml` with the release information
    - `<release version="[version]" date="[date]"/>`
3. Update `network.loki.Session.json`
    - Under `sources`, change the `url` so it points to the latest `deb` and update the `sha256` signature.
4. Create a pull request with the changes

Once that is done, a developer will go in a review them before merging them in which will trigger a build and release into the flathub repo.
