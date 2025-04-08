const express = require('express');
const router = express.Router();
const { dbAsync, createHandler } = require('./base_route.js');

/**
 * Inquiry operations
 */
const inquiryOps = {
  getAll() {
    return dbAsync.all(`
      SELECT * FROM inquiry_requests ORDER BY created_at DESC
    `);
  },

  getById(id) {
    return dbAsync.get(`
      SELECT * FROM inquiry_requests WHERE id = ?
    `, [id]);
  },

  create(inquiry) {
    const { 
      full_name, 
      email_address, 
      phone_number, 
      desired_country, 
      current_education_level, 
      message 
    } = inquiry;
    
    return dbAsync.run(
      `INSERT INTO inquiry_requests (
        full_name, 
        email_address, 
        phone_number, 
        desired_country, 
        current_education_level, 
        message
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name, 
        email_address, 
        phone_number, 
        desired_country, 
        current_education_level, 
        message
      ]
    );
  },

  update(id, inquiry) {
    const { 
      full_name, 
      email_address, 
      phone_number, 
      desired_country, 
      current_education_level, 
      message 
    } = inquiry;
    
    return dbAsync.run(
      `UPDATE inquiry_requests 
       SET full_name = ?, 
           email_address = ?, 
           phone_number = ?, 
           desired_country = ?, 
           current_education_level = ?, 
           message = ? 
       WHERE id = ?`,
      [
        full_name, 
        email_address, 
        phone_number, 
        desired_country, 
        current_education_level, 
        message, 
        id
      ]
    );
  },

  delete(id) {
    return dbAsync.run('DELETE FROM inquiry_requests WHERE id = ?', [id]);
  }
};

/**
 * Route handlers
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    getAll: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'inquiries', handler: 'getAll' });
      routeLogger.info('Received get all inquiries request');
      try {
        const inquiries = await inquiryOps.getAll();
        res.json(inquiries);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching inquiries');
        res.status(500).json({ error: error.message });
      }
    }),

    getById: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'inquiries', handler: 'getById' });
      routeLogger.info({ id: req.params.id }, 'Received get inquiry by id request');
      try {
        const inquiry = await inquiryOps.getById(req.params.id);
        
        if (!inquiry) {
          return res.status(404).json({ error: 'Inquiry not found' });
        }
        
        res.json(inquiry);
      } catch (error) {
        routeLogger.error({ error }, 'Error fetching inquiry');
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'inquiries', handler: 'create' });
      routeLogger.info({ body: req.body }, 'Received create inquiry request');
      
      // Validate required fields
      const requiredFields = ['full_name', 'email_address', 'desired_country'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        return res.status(400).json({ 
          error: `Missing required fields: ${missingFields.join(', ')}` 
        });
      }

      try {
        const { lastID } = await inquiryOps.create(req.body);
        res.status(201).json({ 
          status: 'success', 
          message: 'Inquiry submitted successfully', 
          id: lastID 
        });
      } catch (error) {
        logger.error({ error }, 'Error creating inquiry');
        res.status(500).json({ error: error.message });
      }
    }),

    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'inquiries', handler: 'update' });
      routeLogger.info({ id: req.params.id, body: req.body }, 'Received update inquiry request');
      
      try {
        const { changes } = await inquiryOps.update(req.params.id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, 'Inquiry not found');
          return res.status(404).json({ error: 'Inquiry not found' });
        }

        res.json({ 
          status: 'success', 
          message: 'Inquiry updated successfully',
          id: parseInt(req.params.id)
        });
      } catch (error) {
        logger.error({ error, id: req.params.id }, 'Error updating inquiry');
        res.status(500).json({ error: error.message });
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({ route: 'inquiries', handler: 'delete' });
      routeLogger.info({ id: req.params.id }, 'Received delete inquiry request');
      
      try {
        const { changes } = await inquiryOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, 'Inquiry not found');
          return res.status(404).json({ error: 'Inquiry not found' });
        }

        res.json({ 
          status: 'success', 
          message: 'Inquiry deleted successfully' 
        });
      } catch (error) {
        logger.error({ error, id: req.params.id }, 'Error deleting inquiry');
        res.status(500).json({ error: error.message });
      }
    })
  };

  // Route definitions
  
  /**
   * @swagger
   * /inquiries:
   *   get:
   *     summary: Get all inquiry requests
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get('/inquiries', handlers.getAll);
  
  /**
   * @swagger
   * /inquiries/{id}:
   *   get:
   *     summary: Get an inquiry request by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to fetch
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Successful operation
   *       404:
   *         description: Inquiry not found
   */
  router.get('/inquiries/:id', handlers.getById);
  
  /**
   * @swagger
   * /inquiries:
   *   post:
   *     summary: Submit a new inquiry request
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               full_name:
   *                 type: string
   *               email_address:
   *                 type: string
   *               phone_number:
   *                 type: string
   *               desired_country:
   *                 type: string
   *               current_education_level:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Inquiry submitted successfully
   *       400:
   *         description: Missing required fields
   */
  router.post('/inquiries', handlers.create);
  
  /**
   * @swagger
   * /inquiries/{id}:
   *   put:
   *     summary: Update an existing inquiry
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               full_name:
   *                 type: string
   *               email_address:
   *                 type: string
   *               phone_number:
   *                 type: string
   *               desired_country:
   *                 type: string
   *               current_education_level:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       200:
   *         description: Inquiry updated successfully
   *       404:
   *         description: Inquiry not found
   */
  router.put('/inquiries/:id', handlers.update);
  
  /**
   * @swagger
   * /inquiries/{id}:
   *   delete:
   *     summary: Delete an inquiry
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Inquiry deleted successfully
   *       404:
   *         description: Inquiry not found
   */
  router.delete('/inquiries/:id', handlers.delete);

  return router;
};