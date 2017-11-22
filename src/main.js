/* eslint-disable no-console */

/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 *
 */

const express = require('express')
const {createRouter} = require('./router')
const {PostfixAccounts} = require('./postfix-accounts')
const {AutoSaveLoad} = require('./autoSaveLoad')
const path = require('path')
const morgan = require('morgan')
const yargs = require('yargs')

// require('trace-and-clarify-if-possible')

/**
 * This is the main entry-point for CLI calls. It is called in a one-liner from bin/docker-mailserver-management,
 * but it is a function to allow testing this file without spawning another process
 *
 * Run the main server
 *
 * @param {Process|MockProcess} process the global process object
 * @param {Console} console the global console object
 * @param {function(port: number)=} ready a callback that is called when the server is ready
 */
class Main {
  constructor (process, console) {
    this.process = process
    this.console = console
  }

  async start () {
    const argv = yargs
      .usage('Usage: $0 -p [port] -c [config-dir]')
      // port
      .alias('p', 'port')
      .describe('p', 'The listening port for the http-server')
      .number('p')
      .default('p', 3000)
      // config directory
      .alias('c', 'config-dir')
      .describe('c', 'The directory containing the docker-mailserver configuration (must be writable)')
      .demandOption(['c'])
      .exitProcess(false)
      .parse(this.process.argv)

    const accountsFile = path.join(argv['config-dir'], 'postfix-accounts.cf')

    let postfixAccounts = await PostfixAccounts.load(accountsFile)
    this.autoSaveLoad = await AutoSaveLoad.for(postfixAccounts)

    const app = express()
    app.use(morgan('tiny'))
    app.use(createRouter(postfixAccounts))

    return new Promise((resolve, reject) => {
      this.server = app
        .listen(argv.port, () => {
          let packageName = require('../package.json').name
          console.log(`${packageName} listening on port ${argv.port}`)
          resolve(this)
        })
        .on('error', (err) => reject(err))
    })
  }

  /**
   * Returns a promise that is resolve when the process receives a SIGINT or SIGTERM
   * @returns {Promise}
   */
  async waitForInterupt () {
    return new Promise((resolve, reject) => {
      let resolved = false

      // Resolve once at max
      function done () {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }

      this.process.on('SIGINT', done)
      this.process.on('SIGTERM', done)
    })
  }

  async stop () {
    return new Promise((resolve, reject) => {
      this.autoSaveLoad.close()
      this.server.close((err) => {
        return err ? reject(err) : resolve()
      })
    })
  }
}

module.exports = {Main}
