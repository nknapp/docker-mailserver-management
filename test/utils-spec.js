/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 */

/* eslint-env mocha */

const chai = require('chai')
chai.use(require('dirty-chai'))
chai.use(require('chai-as-promised'))
const expect = chai.expect
const {unwrap} = require('./_utils')

describe('the _utils-module:', function () {
  describe('ths unwrap function', function () {
    it('should remove -----lines from the string, preserving their indent', function () {
      expect(unwrap`
        ------------------
        abc
        abc
        ------------------
      `).to.equal('abc\nabc')
    })

    it('keep "newline at end of the file"', function () {
      expect(unwrap`
        ------------------
        abc
        abc
        
        ------------------
      `).to.equal('abc\nabc\n')
    })

    it('keep work with dynamic pars', function () {
      expect(unwrap`
        ------------------
        abc${'123'}
        abc
        ------------------
      `).to.equal('abc123\nabc')
    })

    it('should work with newlines inside dynamic parts', function () {
      expect(unwrap`
        ------------------
        abc${'123\n345'}
        abc
        ------------------
      `).to.equal('abc123\n345\nabc')
    })

    it('should keep bounds that appear within the string', function () {
      expect(unwrap`
        ------------------
        abc
        ------------------
        abc
        ------------------
      `).to.equal('abc\n------------------\nabc')
    })
  })
})
