# -*- mode: ruby -*-
# vi: set ft=ruby :
# Copyright 2021 Signal Messenger, LLC
# SPDX-License-Identifier: AGPL-3.0-only

Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-20.04"
  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  #
  # Disabling the default mount, since it doesn't work in Ubuntu:
  # https://github.com/hashicorp/vagrant/issues/11506
  config.vm.synced_folder ".", "/vagrant", disabled: true
  config.vm.synced_folder ".", "/home/vagrant/Signal-Desktop"

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  config.vm.provider "virtualbox" do |vb|
    # Display the VirtualBox GUI when booting the machine
    vb.gui = true
    # Enough RAM to run "yarn ready" with minimal swapping
    vb.memory = "3072"
    # Without this configuration, interacting with the UI will be very slow
    vb.customize ['modifyvm', :id, "--graphicscontroller", "vmsvga"]
    vb.customize ['modifyvm', :id, "--accelerate3d", "on"]
    vb.customize ["modifyvm", :id, "--vram", "64"]
  end

  # Perform these steps as root.
  # The reboot is an easy way to start the window manager.
  config.vm.provision "shell", reboot: true, inline: <<-SHELL
    apt update
    # Signal dependencies, based on the contribution guide
    DEBIAN_FRONTEND=noninteractive apt install -y \
      python3 \
      build-essential \
      curl \
      git-lfs

    # Configure window manager and VirtualBox integration, based on:
    # https://stackoverflow.com/a/33138627/3043071
    DEBIAN_FRONTEND=noninteractive apt install -y \
      xfce4 \
      virtualbox-guest-dkms \
      virtualbox-guest-utils \
      virtualbox-guest-x11
    sed -i 's/allowed_users=.*$/allowed_users=anybody/' /etc/X11/Xwrapper.config
    sed -i 's/#  AutomaticLoginEnable =.*$/AutomaticLoginEnable = true/' /etc/gdm3/custom.conf
    sed -i 's/#  AutomaticLogin =.*$/AutomaticLogin = vagrant/' /etc/gdm3/custom.conf
  SHELL

  # Perform these steps as vagrant, a non-privileged user
  config.vm.provision "shell", privileged: false, inline: <<-SHELL
    # Signal dependencies, based on the contribution guide
    cd /home/vagrant/Signal-Desktop
    git lfs install
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
    source ~/.nvm/nvm.sh
    nvm install `cat .nvmrc`
    npm install --global yarn
    yarn install --frozen-lockfile

    # Configure the window manager
    gsettings set org.gnome.desktop.session idle-delay 0
  SHELL
end
