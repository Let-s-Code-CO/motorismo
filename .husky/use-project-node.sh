# Sourced by every hook. Git hooks inherit whatever Node the shell or Git GUI has by default,
# which may not be the project's (and may have no pnpm). With nvm installed, switch to .nvmrc.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh" --no-use
  nvm use --silent > /dev/null || echo "husky - Node from .nvmrc is not installed: run 'nvm install'"
fi
