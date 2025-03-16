// artisans_base_route.js
const fs = require('fs');
const multer = require('multer');
const path = require('path');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}
const { body, validationResult } = require('express-validator');
const { db } = require('../db');

// Enhanced multer configuration with improved error handling
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, 'uploads/'),
  filename: (_, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500000 }, // 0.5MB limit
  fileFilter: (_, file, cb) =>
    file.mimetype.startsWith('image/')
      ? cb(null, true)
      : cb(new Error('Only image files are allowed!'), false)
});

// Database utility functions
const dbAsync = {
  run: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
      });
    }),

  all: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        err ? reject(err) : resolve(rows);
      });
    }),

  get: (sql, params = []) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        err ? reject(err) : resolve(row);
      });
    })
};

// Transaction helper
const executeTransaction = async (operations) => {
  await dbAsync.run('BEGIN TRANSACTION');
  try {
    const results = await Promise.all(operations);
    await dbAsync.run('COMMIT');
    return results;
  } catch (err) {
    await dbAsync.run('ROLLBACK');
    throw err;
  }
};

module.exports = {
  upload,
  dbAsync,
  executeTransaction,
  body,
  validationResult
};