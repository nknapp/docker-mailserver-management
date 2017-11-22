const pify = require('pify')
const crypt = require('crypt3')
const cpr = pify(require('cpr'))

// Constant salt used for hashes in these test cases
const SALT = '$6$V5oMyA+u8Q2U/g=='

// Original contents of the fixture "postfix-accounts.cf"
const fixture = {
  'mailtest@test.knappi.org': hashFor('abc', '$6$UeXF8rxTS/a7bHrp'),
  'railtest@test.knappi.org': hashFor('abcd', '$6$y628bqC.aK2m.ncq')
}

const testTmp = 'test-tmp/fixtures'


/**
 * Compute expected hash for a password
 * @param {string} password the password
 * @param {string=} salt the salt. Default is the mock SALT used in most tests
 */
function hashFor (password, salt) {
  return `{SHA512-CRYPT}${crypt(password, salt || SALT)}`
}

let originalSHA512Salter

/**
 * Setup the mock salt to ensure deterministic hashes
 * Setup the tmp-directory before each test
 */
async function beforeTest () {
  await cpr('test/fixtures', testTmp, {deleteFirst: true})

  // mock "createSalt" to get deterministic hashes
  originalSHA512Salter = crypt.createSalt.salters['sha512']
  crypt.createSalt.salters['sha512'] = () => SALT
}

/**
 * Restore the original salt function after each test
 */
async function afterTest () {
  crypt.createSalt.salters['sha512'] = originalSHA512Salter
}

module.exports = {
  fixture,
  hashFor,
  beforeTest,
  afterTest,
  testTmp
}
