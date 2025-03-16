/**
 * base_route.js
 */
const { db } = require('../db');

/**
 * Promisified database operations with improved error handling
 */
const dbAsync = {
  run: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),

  all: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    }),

  get: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    })
};

/**
 * Request handler factory with built-in error handling
 */
const createHandler = (operation) => async (req, res) => {
  try {
    const result = await operation(req, res);
    return result;
  } catch (error) {
    console.error(`Error in route: ${error.message}`);
    res.status(500).json({
      error: 'Internal Server Error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = { dbAsync, createHandler };