#!/usr/bin/env node

/* eslint-disable no-console */
/* istanbul ignore next */
(async () => {
  const {Main} = require('../src/main')
  const main = new Main(process, console)
  try {
    console.log('Starting server')
    await main.start()
    console.log('Handling connections. Press Ctrl+C to shutdown server')
    await main.waitForInterupt()
    console.log('Shutting down')
    await main.stop()
    console.log('Shutdown finished')
    process.exit(0)
  } catch (err) {
    console.error('Error: ' + err.stack)
    process.exit(1)
  }
})()
