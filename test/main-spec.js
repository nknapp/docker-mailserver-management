/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const dockerMailserverManagement = require('../')
const chai = require('chai')
chai.use(require('dirty-chai'))
const expect = chai.expect

describe('docker-mailserver-management:', function () {
  it("should be executed", function () {
    expect(dockerMailserverManagement()).to.equal('dockerMailserverManagement')
  })
})
