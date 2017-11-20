/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const {AutoSaveLoad} = require('../src/autoSaveLoad')
const fs = require('fs')
const path = require('path')
const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-as-promised'))
const expect = chai.expect
const {EventEmitter} = require('events')
const spy = require('spy')

const configFile = 'test-tmp/autoSaveLoadTest.txt'

/**
 * Mock class for replacing the postfixAccounts class
 */
class MockPostfixAccounts extends EventEmitter {
  constructor (filename) {
    super()
    this.filename = filename
  }

  save () {
    this.emit('saved', this.filename)
  }

  reload () {
    this.emit('loaded', this.filename)
  }
}

describe('the autoSaveLoad-module:', function () {
  this.timeout(20000)

  let postfixAccounts
  let autoSaveLoad

  beforeEach(function () {
    if (!fs.existsSync(path.dirname(configFile))) {
      fs.mkdirSync(path.dirname(configFile))
    }
    fs.writeFileSync(configFile, 'some contents', 'utf-8')
    postfixAccounts = new MockPostfixAccounts(configFile)
    autoSaveLoad = new AutoSaveLoad(postfixAccounts)
  })

  afterEach(function () {
    autoSaveLoad.close()
  })

  it('should call the save function when an account is added', async function () {
    var saveSpy = spy(postfixAccounts, 'save')
    postfixAccounts.emit('modified')
    expect(saveSpy.called).to.be.true()
  })

  it('should call the function when the account-file is changed', async function () {
    var reloadSpy = spy(postfixAccounts, 'reload')
    await new Promise((resolve) => setTimeout(resolve, 100))
    fs.writeFileSync(configFile, 'some new contents', 'utf-8')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(reloadSpy.called).to.be.true()
  })

})
