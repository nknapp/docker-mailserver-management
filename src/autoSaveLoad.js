// Listener for saving and reloading accounts automatically

const chokidar = require('chokidar')

/**
 *
 * @param {PostfixAccounts} postfixAccounts
 */
function autoSaveLoad (postfixAccounts) {
  postfixAccounts.on('modified', () => postfixAccounts.save())
  postfixAccounts.on('saved', (filename) => console.log(`Configuration saved to "${filename}"`))
  postfixAccounts.on('loaded', (filename) => {
    console.log(`Configuration loaded from "${filename}"`)
    console.log('Configuration is now\n', postfixAccounts.accounts)
  })
  postfixAccounts.save()

  const watcher = chokidar.watch(postfixAccounts.filename, {usePolling: true})

  watcher.on('change', () => postfixAccounts.reload())
}

module.exports = {autoSaveLoad}
