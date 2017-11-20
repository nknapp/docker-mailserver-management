const chokidar = require('chokidar')
const debug = require('debug')('docker-mailserver-management:autoSaveLoad')

class AutoSaveLoad {
  constructor (postfixAccounts) {
    this.listeners = {
      'modified': this.onModify.bind(this),
      'saved': this.onSave.bind(this),
      'loaded': this.onLoaded.bind(this)
    }

    // Listener for postfix-accounts
    this.postfixAccounts = postfixAccounts
    Object.keys(this.listeners).forEach((eventName) => {
      this.postfixAccounts.on(eventName, this.listeners[eventName])
    })

    // Listener for file changes
    this.watcher = chokidar.watch(postfixAccounts.filename)
    this.watcher.on('change', this.onChange.bind(this))

    this.postfixAccounts.save()
  }

  onModify () {
    this.postfixAccounts.save()
  }

  onLoaded (filename) {
    debug(`Configuration loaded from "${filename}"`)
    debug('Configuration is now\n', this.postfixAccounts.accounts)
  }

  onSave (filename) {
    debug(`Configuration saved to "${filename}"`)
  }

  onChange () {
    this.postfixAccounts.reload()
  }

  /**
   * Deregister all listeners from the filesystem and the postfixAccounts-object
   */
  close () {
    this.watcher.close()
    Object.keys(this.listeners).forEach((eventName) => {
      this.postfixAccounts.removeListener(eventName, this.listeners[eventName])
    })
  }
}

module.exports = {AutoSaveLoad}
