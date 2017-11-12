#!/usr/bin/env node

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
const {autoSaveLoad} = require('./autoSaveLoad')
const path = require('path')
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
  autoSaveLoad(postfixAccounts)

  app.use(function (req, res, next) {
    console.log(req.params)
    return next()
  })
  app.use(createRouter(postfixAccounts))
  app.listen(argv.port, () => {
    // eslint-disable-next-line no-console
    return console.log(require('../package.json').name + 'listening on port ' + argv.port)
  })
}

run().catch((err) => console.error('Error', err.stack))
