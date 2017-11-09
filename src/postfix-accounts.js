const crypt = require('crypt3/sync')
const pify = require('pify')
const fs = pify(require('fs'))

/**
 * Class for managing the postfix-accounts file
 */
class PostfixAccounts {
  constructor (filename, accounts) {
    this.filename = filename
    this.accounts = accounts
  }

  /**
   * Adds a new user to the database. This operation does NOT automatically save the file
   * @param {string} username the username
   * @param {string} password the password
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async addUser (username, password) {
    if (this.accounts[username]) {
      throw new Error(`User "${username}" already exists`)
    }
    this.accounts[username] = await PostfixAccounts.createPasswordHash(password)
    return this
  }

  /**
   * Removes a user from the database. This operation does NOT automatically save the file
   * @param {string} username the username
   * @param {string} password the password
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async removeUser (username) {
    if (!this.accounts[username]) {
      throw new Error(`User "${username}" does not exist`)
    }
    delete this.accounts[username]
    return this
  }

  /**
   * Updates the password of a given user. This operation does NOT automatically save the file
   * @param username
   * @param password
   * @returns {Promise.<PostfixAccounts>}
   */
  async updateUser (username, password) {
    if (!this.accounts[username]) {
      throw new Error(`User "${username}" does not exist`)
    }
    this.accounts[username] = await PostfixAccounts.createPasswordHash(password)
    return this
  }

  async verifyUserPassword (username, password) {
    if (!this.accounts[username]) {
      throw new Error(`User "${username}" does not exist`)
    }
    return PostfixAccounts.verifyPassword(password, this.accounts[username])
  }

  /**
   * Updates the password of a user, if the "oldPassword" corresponds to the currently stored hash
   * @param {string} username the username
   * @param {string} oldPassword the current password of the user
   * @param {string} newPassword the updated password of the user
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async verifyAndUpdateUserPassword (username, oldPassword, newPassword) {
    if (!this.accounts[username]) {
      throw new Error(`User "${username}" does not exist`)
    }
    if (!this.verifyUserPassword(username, oldPassword)) {
      throw new Error('Old password does not match')
    }
    return this.updateUser(username, newPassword)
  }

  /**
   * Save the postfix-accounts file
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async save () {
    let contents = Object.keys(this.accounts)
      .map((username) => `${username}|${this.account[username]}\n`)
      .join('')
    await fs.writeFile(this.filename, contents)
    return this
  }

  /**
   * Reload data from the postfix-accounts file
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async reload () {
    let contents = ''
    try {
      contents = await fs.readFile(this.filename, 'utf-8')
    } catch (e) {
      if (e.code === 'ENOENT') {
        // eslint-disable-next-line no-console
        console.error(`File "${this.filename}" could not be found, creating empty postfix-accounts`)
      } else {
        throw e
      }
    }

    // Create accounts array
    this.accounts = {}
    contents.split('\n').forEach((line) => {
      if (line.includes('|')) {
        const [username, hash] = line.split('|')
        this.accounts[username] = hash
      }
    })
    return this
  }

  /**
   * Parse a postfix-accounts.cf file and create a PostfixAccounts-instance
   * @param filename
   * @returns {Promise.<PostfixAccounts>}
   */
  static async load (filename) {
    return new PostfixAccounts(filename).reload()
  }

  static async createPasswordHash (password) {
    const hash = crypt(password, crypt.createSalt('sha512'))
    return `{SHA512-CRYPT}${hash}`
  }

  /**
   * Return true, if the provided password corresponds to the hash from the postfix-accounts file
   * @param {string} password
   * @param {string} hash
   * @returns {Promise.<boolean>}
   */
  static async verifyPassword (password, hash) {
    // hash = $6$salt$expectedHash
    const [, expectedHash, salt] = hash.match(/^\{SHA512-CRYPT\}((\$6\$.*?)\$.*)/)
    const actualHash = crypt(password, salt)
    return actualHash === expectedHash
  }
}

module.exports = {
  PostfixAccounts
}
