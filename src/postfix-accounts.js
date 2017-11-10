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
      throw new UserExistsError(username)
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
      throw new NoUserError(username)
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
      throw new NoUserError(username)
    }
    this.accounts[username] = await PostfixAccounts.createPasswordHash(password)
    return this
  }

  /**
   * Make sure that a user exists and that the password belongs to her.
   * If either of those is not the case, an AuthenticationError will be thrown.
   * @param {string} username the username
   * @param {string} password the password to check for the user
   * @returns {Promise.<boolean>} true, if user and password are correct. Never false
   */
  async assertUserPassword (username, password) {
    if (!this.accounts[username]) {
      throw new AuthenticationError(`User "${username}" does not exist`)
    }
    if (!await PostfixAccounts.verifyPassword(password, this.accounts[username])) {
      throw new AuthenticationError('Password does not match.')
    }
  }

  /**
   * Updates the password of a user, if the "oldPassword" corresponds to the currently stored hash
   * @param {string} username the username
   * @param {string} oldPassword the current password of the user
   * @param {string} newPassword the updated password of the user
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async verifyAndUpdateUserPassword (username, oldPassword, newPassword) {
    await this.assertUserPassword(username, oldPassword)
    return this.updateUser(username, newPassword)
  }

  /**
   * Save the postfix-accounts file
   * @returns {Promise.<PostfixAccounts>} the current instance
   */
  async save () {
    let contents = Object.keys(this.accounts)
      .map((username) => `${username}|${this.accounts[username]}\n`)
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
      /* istanbul ignore else */
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

/**
 * Thrown if #verifyAndUpdateUserPassword is called with wrong user or oldPassword
 */
class AuthenticationError extends Error {
  constructor (msg) {
    super(msg)
    this.code = 'DM_ACCESS_DENIED'
  }
}

/**
 * Thrown for most functions if a user is expected to exist, but doesn't
 */
class NoUserError extends Error {
  constructor (user) {
    super(`User ${user} does not exist`)
    this.code = 'DM_NO_USER'
  }
}

/**
 * Thrown for most functions if a user is expected not to exist, but does
 */
class UserExistsError extends Error {
  constructor (user) {
    super(`User ${user} already exists`)
    this.code = 'DM_USER_EXISTS'
  }
}

module.exports = {
  PostfixAccounts,
  AuthenticationError,
  NoUserError,
  UserExistsError
}
