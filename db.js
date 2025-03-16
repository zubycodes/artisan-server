const sqlite3 = require('sqlite3').verbose();

let logger;

const dbProxy = {
  get: function(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return function (...args) {
        logger.debug({ method: prop, args }, `Calling db.${prop}`);
        const result = value.apply(target, args);
        return result;
      };
    } else {
      return value;
    }
  },
  set: function(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver);
  }
};

const db = new sqlite3.Database('./artisan_db.db', (err) => {
  if (err) {
    console.error(err.message);
    throw err; // Propagate the error
  }
  console.log('Connected to the artisan_db.db database.');
});

const proxiedDb = new Proxy(db, dbProxy);

const connect = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Add any initialization queries here, e.g., creating tables
      // Example:
      // db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)");

      resolve();
    });
  });
};

const disconnect = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        console.log('Closed the database connection.');
        resolve();
      }
    });
  });
};

module.exports = {
  db: proxiedDb,
  setLogger: (newLogger) => {
    logger = newLogger;
  },
  connect,
  disconnect,
  ping: () => Promise.resolve(true)
};