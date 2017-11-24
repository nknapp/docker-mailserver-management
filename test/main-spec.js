/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const {Main} = require('../src/main')
const fs = require('fs')
const path = require('path')

const got = require('got')
const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-as-promised'))
const expect = chai.expect
const assert = chai.assert
const {EventEmitter} = require('events')
const {beforeTest, afterTest, testTmp, hashFor, fixture, unwrap} = require('./_utils')

/**
 * Mock class for replacing the postfixAccounts class
 */
class MockProcess extends EventEmitter {
  constructor (...cmdArgs) {
    super()
    this.argv = [process.argv[0], 'bin/docker-mailserver-management.js'].concat(cmdArgs)
  }

  exit (code) {
    this.exitCode = code
  }
}

class MockConsole {
  constructor () {
    this.logOutput = []
    this.errorOutput = []
    this.traceOutput = []
  }

  log (...args) {
    this.logOutput.push(args)
  }

  error (...args) {
    this.errorOutput.push(args)
  }

  trace (...args) {
    this.traceOutput.push(args)
  }
}

describe('the main-module:', function () {
  this.timeout(5000)

  let mockConsole

  beforeEach(async () => {
    mockConsole = new MockConsole()
    return beforeTest()
  })

  afterEach(async () => {
    return afterTest()
  })

  it('should listen on the port specified by the "-p" option', async function () {
    const mockProcess = new MockProcess('-p', '3001', '-c', testTmp)
    const main = new Main(mockProcess, mockConsole)
    await main.start()
    try {
      const result = await got.post(`http://localhost:3001/users/${encodeURIComponent('mailtest@test.knappi.org')}`, {
        json: true,
        body: {oldPassword: 'abc', newPassword: 'abcd'}
      })
      await expect(result.body).to.deep.equal({success: true, username: 'mailtest@test.knappi.org'})

      let newConfig = fs.readFileSync(path.join(testTmp, 'postfix-accounts.cf'), 'utf-8')
      expect(newConfig, 'Checking config file').to.equal(unwrap`
        -----------------------------------------------
        railtest@test.knappi.org|${fixture['railtest@test.knappi.org']}
        mailtest@test.knappi.org|${hashFor('abcd')}

        -----------------------------------------------
      `)
    } finally {
      await main.stop()
    }
  })

  it('should resolve the #waitForInterrupt function when SIGINT is received', async function () {
    const mockProcess = new MockProcess('-p', '3001', '-c', testTmp)
    const main = new Main(mockProcess, mockConsole)
    const promise = main.waitForInterupt()
    mockProcess.emit('SIGINT')
    return promise
  })

  it('should resolve the #waitForInterrupt function when SIGTERM is received', async function () {
    const mockProcess = new MockProcess('-p', '3001', '-c', testTmp)
    const main = new Main(mockProcess, mockConsole)
    const promise = main.waitForInterupt()
    mockProcess.emit('SIGTERM')
    return promise
  })

  it('should resolve the #waitForInterrupt function only once', async function () {
    let counter = 0
    const mockProcess = new MockProcess('-p', '3001', '-c', testTmp)
    const main = new Main(mockProcess, mockConsole)
    const promise = main.waitForInterupt().then(() => counter++)
    mockProcess.emit('SIGTERM')
    mockProcess.emit('SIGTERM')
    await delay(500)
    expect(counter).to.equal(1)
    return promise
  })

  it('should reject result of the #start if the port cannot be bound', async function () {
    const mockProcess = new MockProcess('-p', '3002', '-c', testTmp)
    const main1 = new Main(mockProcess, mockConsole)
    const main2 = new Main(mockProcess, mockConsole)
    try {
      await main1.start()
      await main2.start()
      assert.fail('An exception must be thrown')
    } catch (err) {
      await main1.stop().catch(() => {})
      await main2.stop().catch(() => {})
    }
  })

  it('should reject result of the #stop if the server is not running', async function () {
    const mockProcess = new MockProcess('-p', '3002', '-c', testTmp)
    const main = new Main(mockProcess, mockConsole)
    try {
      await main.start()
      await main.stop()
      // Stop it again to see what happens if it is not running
      await main.stop()
      assert.fail('An exception must be thrown')
    } catch (err) {
    }
  })
})

async function delay (ms) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}
