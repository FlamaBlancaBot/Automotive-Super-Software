'use strict'

function getDbClient() {
  return 'mysql'
}

async function createDb() {
  const { createMysqlDb } = require('./mysql')
  return createMysqlDb()
}

module.exports = {
  getDbClient,
  createDb,
}
