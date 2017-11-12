/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const {PostfixAccounts} = require('../src/postfix-accounts')

const express = require('express')
const {createRouter} = require('../src/router')
const http = require('http')
const popsicle = require('popsicle')

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-as-promised'))
const expect = chai.expect
const {mochaSetup, hashFor, fixture} = require('./_utils')

describe('the router:', function () {
  var server
  var baseUrl
  var postfixAccounts
  before(async () => {
    postfixAccounts = await PostfixAccounts.load('test-tmp/fixtures/postfix-accounts.cf')

    var app = express()
    app.use(createRouter(postfixAccounts))
    server = http.createServer(app)
    return new Promise((resolve, reject) => {
      server.listen(function (err) {
        baseUrl = `http://localhost:${server.address().port}`
        return err ? reject(err) : resolve()
      })
    })
  })

  after(() => {
    return new Promise((resolve, reject) => {
      server.close((err) => err ? reject(err) : resolve())
    })
  })

  // Setup tmp directory and salt
  mochaSetup()

  beforeEach(() => postfixAccounts.reload())

  // invoke the rest-resource
  function verifyAndUpdate (username, oldPassword, newPassword) {
    return popsicle
      .post({url: `${baseUrl}/user/${encodeURIComponent(username)}`, body: {oldPassword, newPassword}})
      .use(popsicle.plugins.parse(['json']))
  }

  describe('The /user/:username resource', function () {
    it('should write the new password if the old password is correct', async function () {
      const response = await verifyAndUpdate('mailtest@test.knappi.org', 'abc', 'ab')

      // Checking response
      expect(response.status).to.equal(200)
      expect(response.body).to.deep.equal({'success': true, 'username': 'mailtest@test.knappi.org'})
      // Checking modification of accounts object
      expect(postfixAccounts.accounts).to.deep.equal({
        'mailtest@test.knappi.org': hashFor('ab'),
        'railtest@test.knappi.org': fixture['railtest@test.knappi.org']
      })
    })

    it('should return 403 if the old password is incorrect', async function () {
      const response = await verifyAndUpdate('mailtest@test.knappi.org', 'badPassword', 'ab')

      // Checking response
      expect(response.status).to.equal(403)
      expect(response.body).to.deep.equal({
        'success': false,
        'code': 403,
        'message': 'Bad username or password'
      })
      // Checking non-modification of accounts object
      expect(postfixAccounts.accounts).to.deep.equal(fixture)
    })

    it('should return 400 if now old password is specified', async function () {
      const response = await verifyAndUpdate('mailtest@test.knappi.org')

      // Checking response
      expect(response.status).to.equal(400)
      expect(response.body).to.deep.equal({
        'success': false,
        'code': 400,
        'message': 'Request must contain username, oldPassword and newPassword'
      })
      // Checking non-modification of accounts object
      expect(postfixAccounts.accounts).to.deep.equal(fixture)
    })
  })
})
