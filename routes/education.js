const express = require('express');
const db = require('../db');
const router = express.Router();
const { dbAsync, createHandler } = require('./base_route.js');

/**
 * Education-specific database operations
 */
const educationOps = {
    getAll() {
        return dbAsync.all('SELECT * FROM education');
    },

    create(education) {
        const { name, isActive } = education;
        return dbAsync.run(
            'INSERT INTO education (name, isActive) VALUES (?, ?)',
            [name, isActive ?? 1] // Default to active if not specified
        );
    },

    update(id, education) {
        const { name, isActive } = education;
        return dbAsync.run(
            'UPDATE education SET name = ?, isActive = ? WHERE id = ?',
            [name, isActive, id]
        );
    },

    delete(id) {
        return dbAsync.run('DELETE FROM education WHERE id = ?', [id]);
    }
};

/**
 * Route handlers with REST-compliant responses
 */
module.exports = (dependencies) => {
    const { logger } = dependencies;
    const handlers = {
        // Get all education levels
        getAll: createHandler(async (req, res) => {
            const routeLogger = logger.child({ route: 'education', handler: 'getAll' });
            routeLogger.info('Received get all education levels request');
            try {
                const educationLevels = await educationOps.getAll();
                res.json(educationLevels);
            } catch (error) {
                routeLogger.error({ error }, 'Error fetching education levels');
                res.status(500).json({ error: error.message });
            }
        }),

        // Create a new education level
        create: createHandler(async (req, res) => {
            const routeLogger = logger.child({ route: 'education', handler: 'create' });
            routeLogger.info({ body: req.body }, 'Received create education level request');
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            try {
                const { lastID } = await educationOps.create(req.body);
                res.write(`data: ${JSON.stringify({ status: 'complete', id: lastID, message: 'Education level created successfully' })}\n\n`);
                res.status(201).end();
            } catch (error) {
                routeLogger.error({ error }, 'Error creating education level');
                res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
                res.status(500).end();
            }
        }),

        // Update an existing education level
        update: createHandler(async (req, res) => {
            const routeLogger = logger.child({ route: 'education', handler: 'update' });
            routeLogger.info({ id: req.params.id, body: req.body }, 'Received update education level request');
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            try {
                const { changes } = await educationOps.update(req.params.id, req.body);

                if (changes === 0) {
                    routeLogger.warn({ id: req.params.id }, 'Education level not found');
                    res.write(`data: ${JSON.stringify({ status: 'error', message: 'Education level not found' })}\n\n`);
                    return res.status(404).end();
                }

                res.write(`data: ${JSON.stringify({ status: 'complete', id: parseInt(req.params.id), message: 'Education level updated successfully' })}\n\n`);
                res.status(200).end();
            } catch (error) {
                routeLogger.error({ error, id: req.params.id }, 'Error updating education level');
                res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
                res.status(500).end();
            }
        }),

        // Delete an education level
        delete: createHandler(async (req, res) => {
            const routeLogger = logger.child({ route: 'education', handler: 'delete' });
            routeLogger.info({ id: req.params.id }, 'Received delete education level request');
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders();

            try {
                const { changes } = await educationOps.delete(req.params.id);

                if (changes === 0) {
                    routeLogger.warn({ id: req.params.id }, 'Education level not found');
                    res.write(`data: ${JSON.stringify({ status: 'error', message: 'Education level not found' })}\n\n`);
                    return res.status(404).end();
                }

                res.write(`data: ${JSON.stringify({ status: 'complete', message: 'Education level deleted successfully' })}\n\n`);
                res.status(200).end();
            } catch (error) {
                routeLogger.error({ error, id: req.params.id }, 'Error deleting education level');
                res.write(`data: ${JSON.stringify({ status: 'error', error: error.message })}\n\n`);
                res.status(500).end();
            }
        })
    };

    /**
     * @swagger
     * /education:
     *   get:
     *     summary: Get all education levels
     *     responses:
     *       200:
     *         description: Successful operation
     */
    router.get('/education', handlers.getAll);

    /**
     * @swagger
     * /education:
     *   post:
     *     summary: Create a new education level
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
     *         description: Education level created successfully
     */
    router.post('/education', handlers.create);

    /**
     * @swagger
     * /education/{id}:
     *   put:
     *     summary: Update an existing education level
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: ID of the education level to update
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
     *         description: Education level updated successfully
     *       404:
     *         description: Education level not found
     */
    router.put('/education/:id', handlers.update);

    /**
     * @swagger
     * /education/{id}:
     *   delete:
     *     summary: Delete an education level
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         description: ID of the education level to delete
     *         schema:
     *           type: integer
     *     responses:
     *       200:
     *         description: Education level deleted successfully
     *       404:
     *         description: Education level not found
     */
    router.delete('/education/:id', handlers.delete);

    return router;
};