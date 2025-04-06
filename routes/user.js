const express = require('express');
const router = express.Router();
const { db } = require('../db');
const bcrypt = require('bcrypt');
const { dbAsync, createHandler } = require('./base_route');

const saltRounds = 10;

/**
 * User entity operations
 */
const userOps = {
  getAll() {
    return dbAsync.all(`
      SELECT  c.*, g.name as region, COUNT(DISTINCT a.id) AS numberOfArtisans
      FROM user c
      LEFT JOIN artisans a ON a.user_Id = c.id
      LEFT JOIN geo_level g ON g.code = c.geoLevel_Code
      GROUP BY c.id, c.username;
      `);
  },

  create(user) {
    const { username, roles, passwordnoty, geoLevel_Code, isMobileUser, user_Id, password } = user;
    return dbAsync.run(
      'INSERT INTO user (username, roles, password, hashynoty, geoLevel_Code, isMobileUser, user_Id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, roles, password, passwordnoty, geoLevel_Code, isMobileUser, user_Id]
    );
  },

  update(id, user) {
    const { username, roles, geoLevel_Code, isMobileUser, isActive, user_Id } = user;
    return dbAsync.run(
      'UPDATE user SET username = ?, roles = ?, geoLevel_Code = ?, isMobileUser = ?, isActive = ?, user_Id = ? WHERE id = ?',
      [username, roles, geoLevel_Code, isMobileUser, isActive, user_Id, id]
    );
  },

  delete(id) {
    return dbAsync.run('DELETE FROM user WHERE id = ?', [id]);
  },

  getByUsername(username) {
    return dbAsync.get('SELECT * FROM user WHERE username = ?', [username]);
  }
};

/**
 * Route handlers
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    getAll: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'getAll' });
      routeLogger.info('Received get all users request');
      try {
        const users = await userOps.getAll();
        res.json(users);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching users');
        res.status(500).json({ error: error.message });
      }
    }),

    register: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'register' });
      routeLogger.info({ body: req.body }, 'Received register user request');
      const { username, roles, geoLevel_Code, isMobileUser, user_Id } = req.body;

      // Generate random password
      let password = '';
      const consonants = 'bcdfghjklmnpqrstvwxyz';
      for (let i = 0; i < 6; i++) {
        password += consonants.charAt(Math.floor(Math.random() * consonants.length));
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      const { lastID } = await userOps.create({
        username,
        roles,
        geoLevel_Code,
        isMobileUser,
        user_Id,
        password: hashedPassword
      });

      res.status(201).json({
        id: lastID,
        message: 'User registered successfully'
      });
    }),

    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'update' });
      routeLogger.info({ id: req.params.id, body: req.body }, 'Received update user request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { changes } = await userOps.update(req.params.id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, 'User not found');
          res.write(`data: ${JSON.stringify({ status: 'error', message: 'User not found' })}\n\n`);
          return res.status(404).end();
        }

        res.write(`data: ${JSON.stringify({ status: 'complete', id: parseInt(req.params.id), message: 'User updated successfully' })}\n\n`);
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, 'Error updating user');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'delete' });
      routeLogger.info({ id: req.params.id }, 'Received delete user request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { changes } = await userOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, 'User not found');
          res.write(`data: ${JSON.stringify({ status: 'error', message: 'User not found' })}\n\n`);
          return res.status(404).end();
        }

        res.write(`data: ${JSON.stringify({ status: 'complete', message: 'User deleted successfully' })}\n\n`);
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, 'Error deleting user');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    }),

    login: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'login' });
      routeLogger.info({ body: req.body }, 'Received login user request');
      const { username, password } = req.body;

      const user = await userOps.getByUsername(username);

      if (!user) {
        logger.warn({ username }, 'User not found');
        return res.status(400).send('Cannot find user');
      }

      try {
        if (await bcrypt.compare(password, user.password)) {
          res.json(user);
        } else {
          logger.warn({ username }, 'Incorrect password');
          res.send('Not Allowed');
        }
      } catch (error) {
        logger.error({ error, username }, 'Error during login');
        res.status(500).send();
      }
    }),

    register: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'user', handler: 'register' });
      routeLogger.info({ body: req.body }, 'Received register user request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { username, roles, geoLevel_Code, isMobileUser, user_Id } = req.body;

        // Generate random password
        let password = '';
        const consonants = 'bcdfghjklmnpqrstvwxyz';
        for (let i = 0; i < 6; i++) {
          password += consonants.charAt(Math.floor(Math.random() * consonants.length));
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const { lastID } = await userOps.create({
          username,
          roles,
          geoLevel_Code,
          isMobileUser,
          user_Id,
          password: hashedPassword,
          passwordnoty: password
        });

        res.write(`data: ${JSON.stringify({ status: 'complete', id: lastID, message: 'User registered successfully' })}\n\n`);
        res.status(201).end();
      } catch (error) {
        logger.error({ error }, 'Error registering user');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    })
  };

  // Route definitions with REST compliant responses
  /**
   * @swagger
   * /users:
   *   get:
   *     summary: Get all users
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get('/users', handlers.getAll);
  /**
   * @swagger
   * /register:
   *   post:
   *     summary: Register a new user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               roles:
   *                 type: string
   *               geoLevel_Code:
   *                 type: string
   *               isMobileUser:
   *                 type: boolean
   *               user_Id:
   *                 type: string
   *     responses:
   *       201:
   *         description: User registered successfully
   */
  router.post('/user/register', handlers.register);
  /**
   * @swagger
   * /{id}:
   *   put:
   *     summary: Update an existing user
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the user to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               roles:
   *                 type: string
   *               geoLevel_Code:
   *                 type: string
   *               isMobileUser:
   *                 type: boolean
   *               isActive:
   *                 type: boolean
   *               user_Id:
   *                 type: string
   *     responses:
   *       200:
   *         description: User updated successfully
   *       404:
   *         description: User not found
   */
  router.put('/user/:id', handlers.update);
  /**
   * @swagger
   * /{id}:
   *   delete:
   *     summary: Delete an existing user
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the user to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: User deleted successfully
   *       404:
   *         description: User not found
   */
  router.delete('/user/:id', handlers.delete);
  /**
   * @swagger
   * /user/login:
   *   post:
   *     summary: Login an existing user
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200: 
   *         description: Successful login
   *       400:
   *         description: Invalid username or password
   */
  router.post('/user/login', handlers.login);

  return router;
};