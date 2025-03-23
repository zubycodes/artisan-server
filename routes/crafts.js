const express = require('express');
const db = require('../db');
const router = express.Router();
const { dbAsync, createHandler } = require('./base_route.js');

/**
 * Craft-specific database operations
 */
const craftOps = {
  getAll() {
    return dbAsync.all(`
      SELECT 
        c.id,
        c.name AS craftName,
        COUNT(DISTINCT cat.id) AS numberOfCategories,
        COUNT(DISTINCT t.id) AS numberOfTechniques,
        COUNT(DISTINCT a.id) AS numberOfArtisans
      FROM crafts c
      LEFT JOIN categories cat ON cat.craft_Id = c.id
      LEFT JOIN techniquesView t ON t.category_Id = cat.id
      LEFT JOIN artisans a ON a.skill_id = t.id
      GROUP BY c.id, c.name
      `);
  },

  create(craft) {
    const { name, isActive } = craft;
    return dbAsync.run(
      'INSERT INTO crafts (name, isActive) VALUES (?, ?)',
      [name, isActive ?? 1] // Default to active if not specified
    );
  },

  update(id, craft) {
    const { name, isActive } = craft;
    return dbAsync.run(
      'UPDATE crafts SET name = ?, isActive = ? WHERE id = ?',
      [name, isActive, id]
    );
  },

  delete(id) {
    return dbAsync.run('DELETE FROM crafts WHERE id = ?', [id]);
  }
};

/**
 * Route handlers with REST-compliant responses
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    // Get all crafts
    getAll: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'crafts', handler: 'getAll' });
      routeLogger.info('Received get all crafts request');
      try {
        const crafts = await craftOps.getAll();
        res.json(crafts);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching crafts');
        res.status(500).json({ error: error.message });
      }
    }),

    // Create a new craft
    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'crafts', handler: 'create' });
      routeLogger.info({ body: req.body }, 'Received create craft request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { lastID } = await craftOps.create(req.body);
        res.write(`data: ${JSON.stringify({ status: 'complete', id: lastID, message: 'Craft created successfully' })}\n\n`);
        res.status(201).end();
      } catch (error) {
        routeLogger.error({ error }, 'Error creating craft');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    }),

    // Update an existing craft
    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'crafts', handler: 'update' });
      routeLogger.info({ id: req.params.id, body: req.body }, 'Received update craft request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { changes } = await craftOps.update(req.params.id, req.body);

        if (changes === 0) {
          routeLogger.warn({ id: req.params.id }, 'Craft not found');
          res.write(`data: ${JSON.stringify({ status: 'error', message: 'Craft not found' })}\n\n`);
          return res.status(404).end();
        }

        res.write(`data: ${JSON.stringify({ status: 'complete', id: parseInt(req.params.id), message: 'Craft updated successfully' })}\n\n`);
        res.status(200).end();
      } catch (error) {
        routeLogger.error({ error, id: req.params.id }, 'Error updating craft');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    }),

    // Delete a craft
    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'crafts', handler: 'delete' });
      routeLogger.info({ id: req.params.id }, 'Received delete craft request');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      try {
        const { changes } = await craftOps.delete(req.params.id);

        if (changes === 0) {
          routeLogger.warn({ id: req.params.id }, 'Craft not found');
          res.write(`data: ${JSON.stringify({ status: 'error', message: 'Craft not found' })}\n\n`);
          return res.status(404).end();
        }

        res.write(`data: ${JSON.stringify({ status: 'complete', message: 'Craft deleted successfully' })}\n\n`);
        res.status(200).end();
      } catch (error) {
        routeLogger.error({ error, id: req.params.id }, 'Error deleting craft');
        res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
        res.status(500).end();
      }
    })
  };
  /**
   * @swagger
   * /crafts:
   *   get:
   *     summary: Get all crafts
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get('/crafts', handlers.getAll);
  /**
   * @swagger
   * /crafts:
   *   post:
   *     summary: Create a new craft
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               isActive:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Craft created successfully
   */
  router.post('/crafts', handlers.create);
  /**
   * @swagger
   * /crafts/{id}:
   *   put:
   *     summary: Update an existing craft
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the craft to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Craft updated successfully
   *       404:
   *         description: Craft not found
   */
  router.put('/crafts/:id', handlers.update);
  /**
   * @swagger
   * /crafts/{id}:
   *   delete:
   *     summary: Delete a craft
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the craft to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Craft deleted successfully
   *       404:
   *         description: Craft not found
   */
  router.delete('/crafts/:id', handlers.delete);
  return router;
};