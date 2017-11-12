/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const {PostfixAccounts, UserExistsError, NoUserError, AuthenticationError} = require('../src/postfix-accounts')
const crypt = require('crypt3')
const fs = require('fs')
const pify = require('pify')
const cpr = pify(require('cpr'))

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-as-promised'))
const expect = chai.expect

// Constant salt used for hashes in these test cases
const SALT = '$6$V5oMyA+u8Q2U/g=='

// Original contents of the fixture "postfix-accounts.cf"
const fixture = {
  'mailtest@test.knappi.org': '{SHA512-CRYPT}$6$UeXF8rxTS/a7bHrp$yQaj.9fgyDckIP3pgspd6YKUsyN8K54Am3n5kSpYwFG3C1gHKAM4MlfCcBkJsd5vB/UNAPfUlA6ShOIQa4Vmr/',
  'railtest@test.knappi.org': '{SHA512-CRYPT}$6$y628bqC.aK2m.ncq$/f9ARypMSviNXMD1ZqdFO6B9Vl8O6X.7ZIauNm34bpUCWnDg91C9OgcnQ/7XZh7rCt1JPQfc/g/vpRdWTqbp0/'
}

const fixtureOnlyRailtest = {
  'railtest@test.knappi.org': '{SHA512-CRYPT}$6$y628bqC.aK2m.ncq$/f9ARypMSviNXMD1ZqdFO6B9Vl8O6X.7ZIauNm34bpUCWnDg91C9OgcnQ/7XZh7rCt1JPQfc/g/vpRdWTqbp0/'
}

// Compute expected hash for a password
function hashFor (password) {
  return `{SHA512-CRYPT}${crypt(password, SALT)}`
}

/**
 * Returns an object that will be filled with event-counts from the PostfixAccounts object
 * @param {PostfixAccounts} postfixAccounts
 * @return {object<number>} an object with a counter for each event
 */
function eventCounter (postfixAccounts) {
  const eventLog = {}
  ;['modified', 'saved', 'loaded', 'authFailed'].forEach((eventName) => {
    eventLog[eventName] = []
    postfixAccounts.on(eventName, function () {
      return eventLog[eventName].push(Array.prototype.slice.apply(arguments))
    })
  })
  return eventLog
}

describe('postfix-accounts:', function () {
  let originalSHA512Salter

  // mock "createSalt" to get deterministic hashes
  beforeEach(async () => {
    await cpr('test/fixtures', 'test-tmp/fixtures', {deleteFirst: true})
    originalSHA512Salter = crypt.createSalt.salters['sha512']
    crypt.createSalt.salters['sha512'] = () => SALT
  })

  afterEach(() => {
    crypt.createSalt.salters['sha512'] = originalSHA512Salter
  })

  describe('the static method #createPasswordHash and #verifyPassword', function () {
    it('should create a password hash from a password in the dovecot form ({SHA-512}$6$...', async function () {
      const hash = await PostfixAccounts.createPasswordHash('abc')
      expect(hash).to.match(/^\{SHA512-CRYPT\}\$6\$.*\$.*/)
    })

    it('should verify a password hash created from a password against the given password', async function () {
      const hash = await PostfixAccounts.createPasswordHash('abc')
      expect(await PostfixAccounts.verifyPassword('abc', hash)).to.be.true()
    })

    it('should not verify a password hash created from a password against a different password', async function () {
      const hash = await PostfixAccounts.createPasswordHash('abcd')
      expect(await PostfixAccounts.verifyPassword('abc', hash)).to.be.false()
    })

    it('should not verify a password hash created by doveadm', async function () {
      let doveHash = '{SHA512-CRYPT}$6$fIGcYDOu6Acq361c$Xj/DuVClJrKEFWWu4irr8So6GwqwGdSbiMU3tG.RlM/4hoQMIIsqHry21zqmd/McsAVeH5/meBL1kc8wWBfwJ.'
      expect(await PostfixAccounts.verifyPassword('abc', doveHash)).to.be.true()
    })
  })

  describe('the static #load function', function () {
    it('should load a given accounts file', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      await expect(postfixAccounts.accounts).to.deep.equal(fixture)
    })

    it('should create an empty accounts file if the specified filed does not exist', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts-missing.cf')
      await expect(postfixAccounts.accounts).to.deep.equal({})
    })
  })

  describe('the #reload function', function () {
    it('should reload the loaded accounts file', async function () {
      let postfixAccounts = await PostfixAccounts.load('test-tmp/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      fs.writeFileSync('test-tmp/fixtures/postfix-accounts.cf', fs.readFileSync('test/fixtures/postfix-accounts-only-railtest.cf'))
      await postfixAccounts.reload()
      await expect(postfixAccounts.accounts).to.deep.equal(fixtureOnlyRailtest)
      expect(events.loaded, 'Checking "loaded" events').to.deep.equal([['test-tmp/fixtures/postfix-accounts.cf']])
    })
  })

  describe('the #addUser function', function () {
    it('should add a new account', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await postfixAccounts.addUser('sailtest@test.knappi.org', 'abc')
      expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': fixture['mailtest@test.knappi.org'],
        'railtest@test.knappi.org': fixture['railtest@test.knappi.org'],
        'sailtest@test.knappi.org': hashFor('abc')
      })
      expect(events.modified.length, 'Checking count for "modified" events').to.deep.equal(1)
    })

    it('should throw an exception if the user already exists', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      return expect(postfixAccounts.addUser('mailtest@test.knappi.org', 'abc')).to.be.rejectedWith(UserExistsError)
    })
  })

  describe('the #removeUser function', function () {
    it('should remove an account', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await postfixAccounts.removeUser('mailtest@test.knappi.org')
      expect(postfixAccounts.accounts).to.deep.equal({
        'railtest@test.knappi.org': fixture['railtest@test.knappi.org']
      })
      expect(events.modified.length, 'Checking count for "modified" events').to.equal(1)
    })

    it('should throw an exception if the user does not exist', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      return expect(postfixAccounts.removeUser('missing@test.knappi.org', 'abc')).to.be.rejectedWith(NoUserError)
    })
  })

  describe('the #updateUser function', function () {
    it('should update the password of an account', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await postfixAccounts.updateUser('mailtest@test.knappi.org', 'xyz')
      await expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': hashFor('xyz'),
        'railtest@test.knappi.org': fixture['railtest@test.knappi.org']
      })
      expect(events.modified.length, 'Checking count for "modified" events').to.equal(1)
    })

    it('should throw an exception if the user does not exist', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      await expect(postfixAccounts.updateUser('missing@test.knappi.org', 'abc')).to.be.rejectedWith(NoUserError)
    })
  })

  describe('the #assertUserPassword function', function () {
    it('should throw an exception if the user does not exist', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await expect(postfixAccounts.assertUserPassword('missing@test.knappi.org', 'abc')).to.be.rejectedWith(AuthenticationError)
      expect(events.authFailed, 'Checking "authFailed" events').to.deep.equal([['missing@test.knappi.org']])
    })

    it('should throw an exception if the password does not match the users password', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await expect(postfixAccounts.assertUserPassword('mailtest@test.knappi.org', 'def')).to.be.rejectedWith(AuthenticationError)
      expect(events.authFailed, 'Checking "authFailed" events').to.deep.equal([['mailtest@test.knappi.org']])
    })
  })

  describe('the #verifyAndUpdateUserPassword function', function () {
    it('should throw an exception if the user does not exist', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await expect(postfixAccounts.verifyAndUpdateUserPassword('missing@test.knappi.org', 'abc', 'bcd')).to.be.rejectedWith(AuthenticationError)
      expect(events.authFailed, 'Checking "authFailed" events').to.deep.equal([['missing@test.knappi.org']])
    })

    it('should throw an exception if the password does not match the users password', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await expect(postfixAccounts.verifyAndUpdateUserPassword('mailtest@test.knappi.org', 'def', 'efg')).to.be.rejectedWith(AuthenticationError)
      await expect(postfixAccounts.accounts['mailtest@test.knappi.org'], 'Password may not have changed')
        .to.equal(fixture['mailtest@test.knappi.org'])
      expect(events.authFailed, 'Checking "authFailed" events').to.deep.equal([['mailtest@test.knappi.org']])
    })

    it('should update the password of an account if user and oldPassword are is valid', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await postfixAccounts.verifyAndUpdateUserPassword('mailtest@test.knappi.org', 'abc', 'efg')
      await expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': hashFor('efg'),
        'railtest@test.knappi.org': fixture['railtest@test.knappi.org']
      })
      expect(events.modified.length, 'Checking count for "modified" events').to.equal(1)
    })
  })

  describe('the #save function', function () {
    it('should store the accounts into a file', async function () {
      let postfixAccounts = await PostfixAccounts.load('test-tmp/fixtures/postfix-accounts.cf')
      let events = eventCounter(postfixAccounts)
      await postfixAccounts.removeUser('mailtest@test.knappi.org')
      await postfixAccounts.save()
      await expect(fs.readFileSync('test-tmp/fixtures/postfix-accounts.cf', 'utf-8'))
        .to.equal(fs.readFileSync('test/fixtures/postfix-accounts-only-railtest.cf', 'utf-8'))
      expect(events.saved, 'Checking "saved" events').to.deep.equal([['test-tmp/fixtures/postfix-accounts.cf']])
    })
  })
})
