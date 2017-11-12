const express = require('express')
const bodyParser = require('body-parser')
const {AuthenticationError} = require('./postfix-accounts')

/**
 * Creates an API router that exposes functions from postfixAccounts to the interface
 * @param {PostfixAccounts} postfixAccounts
 */
function createRouter (postfixAccounts) {
  const router = express.Router()

  router.use(bodyParser.json())

  /**
   * Change the password of a user given the old password and the new password
   */
  router.post('/user/:username', async function (req, res, next) {
    try {
      const username = req.params.username
      const {oldPassword, newPassword} = req.body
      if (oldPassword == null || newPassword == null) {
        throw new BadRequestError('Request must contain username, oldPassword and newPassword')
      }
      await postfixAccounts.verifyAndUpdateUserPassword(username, oldPassword, newPassword)
      res.contentType('application/json')
      res.send(JSON.stringify({
        success: true,
        username
      }))
    } catch (err) {
      next(err)
    }
  })

  /**
   * Error handler
   */
  router.use(function (err, req, res, next) {
    // eslint-disable-next-line no-console
    console.error('Error', err.message, err.stack)
    if (err instanceof AuthenticationError) {
      return sendError(res, 403, 'Bad username or password')
    }
    /* istanbul ignore else */
    if (err instanceof BadRequestError) {
      return sendError(res, 400, err.message)
    }
    /* istanbul ignore next */
    return sendError(res, 500, 'Internal server error')
  })

  return router
}

class BadRequestError extends Error {
}

function sendError (response, responseCode, message) {
  response
    .status(responseCode)
    .contentType('application/json')
    .send(JSON.stringify({
      success: false,
      code: responseCode,
      message: message
    }))
}

module.exports = {createRouter}
