# Building

This document alongside [Releasing.md](RELEASING.md) primarily cover our internal build process for release builds, if you are an external contributor please refer to [Contributing.md](CONTRIBUTING.md) for building instructions. 

## Automated

Automatic building of session binaries is done using github actions. Windows and linux binaries will build right out of the box but there are some extra steps needed for Mac OS

### Mac OS

The build script for Mac OS requires you to have a valid `Developer ID Application` certificate. Without this the build script cannot sign and notarize the mac binary which is needed for Catalina 10.15 and above.
If you would like to disable this then comment out `"afterSign": "build/notarize.js",` in package.json.

You will also need an [App-specific password](https://support.apple.com/en-al/HT204397) for the apple account you wish to notarize with

#### Setup

Once you have your `Developer ID Application` you need to export it into a `.p12` file. Keep a note of the password used to encrypt this file as it will be needed later.

We need to Base64 encode this file, so run the following command:

```
base64 -i certificate.p12 -o encoded.txt
```

#### On GitHub:

1.  Navigate to the main page of the repository.
2.  Under your repository name, click **Settings**.
3.  In the left sidebar, click **Secrets**.
4.  Add the following secrets:
    1.  Certificate
        - Name: `MAC_CERTIFICATE`
        - Value: The encoded Base64 certificate
    2.  Certificate password
        - Name: `MAC_CERTIFICATE_PASSWORD`
        - Value: The password that was set when the certificate was exported.
    3.  Apple ID
        - Name: `SIGNING_APPLE_ID`
        - Value: The apple id (email) to use for signing
    4.  Apple Password
        - Name: `SIGNING_APP_PASSWORD`
        - Value: The app-specific password that was generated for the apple id
    5.  Team ID (Optional)
        - Name: `SIGNING_TEAM_ID`
        - Value: The apple team id if you're sigining the application for a team

## Manual

### Node version

You will need node `18.15.0`.
This can be done by using [nvm](https://github.com/nvm-sh/nvm) and running `nvm use` or you can install it manually.
Once nvm is installed, just run `nvm install` to install the version from the `.nvmrc` file and then `nvm use` to use it.

### Prerequisites

<details>
<summary>Linux</summary>

Here are the steps to build the app for Linux:

```
sudo apt-get install python2 git-lfs
git lfs install
# install nvm by following their github README
nvm install # install the current node version used in this project
nvm use # use the current node version used in this project
npm install -g yarn # install yarn globally for this node version
yarn install --frozen-lockfile # install all dependencies of this project
yarn build-everything # transpile and assemble files
yarn start-prod # start the app on production mode (currently this is the only one supported)
```

</details>
<details>
<summary>Windows</summary>

Building on windows should work straight out of the box, but if it fails then you will need to run the following:

```
npm install --global --production windows-build-tools@4.0.0
npm install --global node-gyp@latest
npm config set python python2.7
npm config set msvs_version 2015
```

</details>

<details>
<summary>Mac</summary>

If you are going (and only if) to distribute the binary then make sure you have a `Developer ID Application` certificate in your keychain.

You will also need to generate an [app specific password](https://support.apple.com/HT204397) for your Apple ID.

Then run the following to export the variables

```
export SIGNING_APPLE_ID=<your apple id>
export SIGNING_APP_PASSWORD=<your app specific password>
export SIGNING_TEAM_ID=<your team id if applicable>
```

Then, to just generate the files and build the app do

```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash # install nvm


# the script above prints  at the end a few lines you have to run in your terminal

https://git-lfs.github.com/ # visit this page, download and install git-lfs

git lfs install # once git lfs is installed, you have to run this command too

nvm install # install the current node version used in this project
nvm use # use the current node version used in this project
npm install -g yarn # install yarn globally for this node version
yarn install --frozen-lockfile # install all dependencies of this project
yarn build-everything # transpile and assemble files
yarn start-prod # start the app on production mode (currently this is the only one supported)
```

</details>

### Commands

The `rpm` package is required for running the build-release script. Run the appropriate command to install the `rpm` package:

```sh
sudo pacman -S rpm    # Arch
```

```sh
sudo apt install rpm  # Ubuntu/Debian
```

Run the following to build the binaries for your specific system OS.

```
npm install yarn --no-save
yarn install --frozen-lockfile
yarn build-everything
yarn build-release
```

The binaries will be placed inside the `release/` folder.
