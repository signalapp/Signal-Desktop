FROM ubuntu:focal-20240530@sha256:fa17826afb526a9fc7250e0fbcbfd18d03fe7a54849472f86879d8bf562c629e

# Allows package builders like FPM (used for creating the .deb package
# on linux) to make their build timestamps determistic. Otherwise, a fresh
# UNIX timestamp will be generated at the time of the build, and is non-deterministic.
#
# Read https://reproducible-builds.org/specs/source-date-epoch/ for more info
ENV SOURCE_DATE_EPOCH=1

# Due to some issues with NVM reading .nvmrc, we define the version
# as an environment variable and use that instead.
ARG NODE_VERSION

ENV SIGNAL_ENV=production

# ---
# This portion of the code is identical to the Signal Android's
# reproducible build system. https://github.com/signalapp/Signal-Android/blob/main/reproducible-builds/Dockerfile

# APT source files
COPY docker/ docker/
COPY docker/apt.conf docker/sources.list /etc/apt/

# Ubuntu needs the ca-certificates package before it'll trust our mirror.
# But we can't install it because it doesn't trust our mirror!
# Temporarily disables APT's certificate signature checking
# to download the certificates.
RUN apt update -oAcquire::https::Verify-Peer=false
RUN apt install -oAcquire::https::Verify-Peer=false -y ca-certificates

# Back to normal, verification back on
RUN apt update
RUN apt install -y git curl g++ g++-10 gcc gcc-10 make python3 tar

# On Ubuntu 20 GCC 9 is the default but we need 10 to build
RUN update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-10 100 \
    --slave /usr/bin/g++ g++ /usr/bin/g++-10
# ---

# Install nvm
ENV NVM_VERSION=0.40.0
ENV NVM_DIR=/usr/local/nvm
RUN mkdir $NVM_DIR

RUN curl -o- "https://raw.githubusercontent.com/nvm-sh/nvm/v${NVM_VERSION}/install.sh" | bash \
    && . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias $NODE_VERSION \
    && nvm use $NODE_VERSION

ENV NODE_PATH=$NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Install pnpm
RUN npm install -g pnpm@10.3.0

RUN git config --global --add safe.directory /project

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# For electron builder cache.
# It's tricky to synchronize user/group permissions between the host and container without creating
# host-specific users at container build time, which would break reproducibility.
# Instead of doing that we will fix permissions on required directories.
RUN mkdir /.cache && chmod -R 777 /.cache

ENTRYPOINT ["docker-entrypoint.sh"]

# Specify build type using CMD, which affects the app version and name of the resulting package.
# For more information see build.sh and docker-entrypoint.sh
CMD ["dev"]
