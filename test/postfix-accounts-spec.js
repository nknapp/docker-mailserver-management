/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const {PostfixAccounts} = require('../src/postfix-accounts')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

describe('postfix-accounts:', function () {
  let originalSHA512Salter

  // mock "createSalt" to get deterministic hashes
  before(() => {
    originalSHA512Salter = require('crypt3').createSalt.salters['sha512']
    require('crypt3').createSalt.salters['sha512'] = () => '$6$V5oMyA+u8Q2U/g=='
  })

  after(() => {
    require('crypt3').createSalt.salters['sha512'] = originalSHA512Salter
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
      expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': '{SHA512-CRYPT}$6$UeXF8rxTS/a7bHrp$yQaj.9fgyDckIP3pgspd6YKUsyN8K54Am3n5kSpYwFG3C1gHKAM4MlfCcBkJsd5vB/UNAPfUlA6ShOIQa4Vmr/',
        'railtest@test.knappi.org': '{SHA512-CRYPT}$6$y628bqC.aK2m.ncq$/f9ARypMSviNXMD1ZqdFO6B9Vl8O6X.7ZIauNm34bpUCWnDg91C9OgcnQ/7XZh7rCt1JPQfc/g/vpRdWTqbp0/'
      })
    })
  })

  describe('the # addUser function', function () {
    it('should add a new account', async function () {
      let postfixAccounts = await PostfixAccounts.load('test/fixtures/postfix-accounts.cf')
      await postfixAccounts.addUser('sailtest@test.knappi.org', 'abc')
      expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': '{SHA512-CRYPT}$6$UeXF8rxTS/a7bHrp$yQaj.9fgyDckIP3pgspd6YKUsyN8K54Am3n5kSpYwFG3C1gHKAM4MlfCcBkJsd5vB/UNAPfUlA6ShOIQa4Vmr/',
        'railtest@test.knappi.org': '{SHA512-CRYPT}$6$y628bqC.aK2m.ncq$/f9ARypMSviNXMD1ZqdFO6B9Vl8O6X.7ZIauNm34bpUCWnDg91C9OgcnQ/7XZh7rCt1JPQfc/g/vpRdWTqbp0/',
        'sailtest@test.knappi.org': '{SHA512-CRYPT}$6$V5oMyA+u8Q2U/g==$QslJkfEwrcJ0eT1Vl.XFF/lWbFyztE7P8T6z43lm7D3oTZFqaZHvOgytU2GXTIV7whyCpMguibuXeX5OZN3mG1'
      })
    })
  })
})
