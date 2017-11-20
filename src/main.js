#!/usr/bin/env node

/* eslint-disable no-console */

/*!
 * docker-mailserver-management <https://github.com/nknapp/docker-mailserver-management>
 *
 * Copyright (c) 2017 Nils Knappmeier.
 * Released under the MIT license.
 *
 */

// This is the main entrypoint for CLI calls

const express = require('express')
const app = express()
const {createRouter} = require('./router')
const {PostfixAccounts} = require('./postfix-accounts')
const {AutoSaveLoad} = require('./autoSaveLoad')
const path = require('path')
const morgan = require('morgan')
// require('trace-and-clarify-if-possible')

const argv = require('yargs')
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
  .argv

const accountsFile = path.join(argv['config-dir'], 'postfix-accounts.cf')

async function run () {
  let postfixAccounts = await PostfixAccounts.load(accountsFile)
  let autoSaveLoad = new AutoSaveLoad(postfixAccounts)

  app.use(morgan('tiny'))
  app.use(createRouter(postfixAccounts))
  var server = app.listen(argv.port, () => {
    let packageName = require('../package.json').name
    return console.log(`${packageName} listening on port ${argv.port}`)
  })

  return new Promise((resolve, reject) => {
    function shutdown () {
      console.log('Shutting down server')
      autoSaveLoad.close()
      server.close((err) => err ? reject(err) : resolve())

      setTimeout(() => {
        console.log('Forcing shutdown')
        process.exit(0)
      }, 10 * 1000)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
  })
}

run().then(
  () => {
    console.log('Shutdown complete')
    process.exit(0)
  },
  (err) => console.error('Error', err.stack)
)
