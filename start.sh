#!/bin/bash
# SAAD-IT // free to use, modify etc. just4dev
# vars
user="karim"; #$(whoami) or ="$USER";

# set nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
#source ~/.bashrc
nvm use 14.16.0 # please modify it to the needed version

# if a second param is set, do the yarn install and grunt
if [ ! -z "$1" ]; then
	echo "[== Starting Dev - Compiling ==]";
	yarn install
	yarn grunt
	echo "[=== Completed ===]";
fi

# if no additional parameters just do the yarn start --no-sandbox (if nvm as root)
echo "[ == [start.sh] Starting App == ]";
chown "$user":"$user" * -R
LANGUAGE=en SIGNAL_ENABLE_HTTP=1 yarn start --no-sandbox
echo "[ === [start.sh] App closed === ]";
chown "$user":"$user" * -R
