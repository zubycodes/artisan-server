const express = require('express');
const fs = require('fs');
const router = express.Router();
const {
  upload,
  dbAsync,
  executeTransaction,
  body,
  validationResult
} = require('./artisans_base_route.js');

// Validation middleware for create
const validateArtisanData = [
  // Artisan validations
  body('artisan.name').notEmpty().withMessage('Name is required'),
  body('artisan.father_name').notEmpty().withMessage('Father\'s name is required'),
  body('artisan.cnic').isLength({ min: 13, max: 13 }).withMessage('CNIC must be 13 digits'),
  body('artisan.gender').isIn(['Male', 'Female', 'Trangender']).withMessage('Invalid gender'),
  body('artisan.date_of_birth').isISO8601().withMessage('Invalid date of birth'),
  body('artisan.contact_no').isLength({ min: 11, max: 11 }).withMessage('Invalid phone number! Must be 11 digits'),
  /* body('artisan.skill_id').notEmpty().withMessage('Skill ID is required'),
  body('artisan.major_product').notEmpty().withMessage('Major product is required'),
  body('artisan.experience').optional().isInt({ min: 0 }).withMessage('Experience must be a non-negative integer'),
  body('artisan.avg_monthly_income').optional().isInt({ min: 0 }).withMessage('Average monthly income must be a non-negative integer'),
  body('artisan.employment_type_id').notEmpty().withMessage('Employment type ID is required'),
  body('artisan.raw_material').optional().isString().withMessage('Raw material must be a string'),
  body('artisan.loan_status').optional().isBoolean().withMessage('Loan status must be a boolean'),
  body('artisan.has_machinery').optional().isBoolean().withMessage('Has machinery must be a boolean'),
  body('artisan.has_training').optional().isBoolean().withMessage('Has training must be a boolean'),
  body('artisan.inherited_skills').optional().isBoolean().withMessage('Inherited skills must be a boolean'),
  body('artisan.comments').optional().isString().withMessage('Comments must be a string'), */
  body('artisan.latitude').optional().isFloat().withMessage('Latitude must be a number'),
  body('artisan.longitude').optional().isFloat().withMessage('Longitude must be a number'),
];

// Validation middleware for update
const validateUpdateArtisanData = [
  // Artisan validations (optional fields)
  body('artisan.name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('artisan.father_name').optional().notEmpty().withMessage('Father\'s name cannot be empty'),
  body('artisan.cnic').optional().isLength({ min: 13, max: 13 }).withMessage('CNIC must be 13 digits'),
  body('artisan.gender').optional().isIn(['Male', 'Female', 'Other']).withMessage('Invalid gender'),
  body('artisan.date_of_birth').optional().isISO8601().withMessage('Invalid date of birth'),
  body('artisan.contact_no').optional().isMobilePhone().withMessage('Invalid phone number'),
  body('artisan.dependents_count').optional().isInt({ min: 0 }).withMessage('Dependents count must be a non-negative integer'),
  body('artisan.skill_id').optional().notEmpty().withMessage('Skill ID is required'),
  body('artisan.major_product').optional().notEmpty().withMessage('Major product is required'),
  body('artisan.experience').optional().isInt({ min: 0 }).withMessage('Experience must be a non-negative integer'),
  body('artisan.avg_monthly_income').optional().isInt({ min: 0 }).withMessage('Average monthly income must be a non-negative integer'),
  body('artisan.employment_type_id').optional().notEmpty().withMessage('Employment type ID is required'),
  body('artisan.raw_material').optional().isString().withMessage('Raw material must be a string'),
  body('artisan.loan_status').optional().isBoolean().withMessage('Loan status must be a boolean'),
  body('artisan.has_machinery').optional().isBoolean().withMessage('Has machinery must be a boolean'),
  body('artisan.has_training').optional().isBoolean().withMessage('Has training must be a boolean'),
  body('artisan.inherited_skills').optional().isBoolean().withMessage('Inherited skills must be a boolean'),
  body('artisan.comments').optional().isString().withMessage('Comments must be a string'),
  body('artisan.latitude').optional().isFloat().withMessage('Latitude must be a number'),
  body('artisan.longitude').optional().isFloat().withMessage('Longitude must be a number'),
];

// Entity operations
const entityOps = {
  async createArtisan(artisan, profilePicturePath) {
    const sql = `
      INSERT INTO artisans (
        name, father_name, cnic, gender, date_of_birth, contact_no, email, address,
        tehsil_id, education_level_id, dependents_count, profile_picture, ntn, skill_id,
        major_product, experience, avg_monthly_income, employment_type_id, raw_material,
        loan_status, has_machinery, has_training, inherited_skills, financial_assistance, technical_assistance, comments, latitude,
        longitude, user_Id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      artisan.name, artisan.father_name, artisan.cnic, artisan.gender, artisan.date_of_birth,
      artisan.contact_no, artisan.email || null, artisan.address || null, artisan.tehsil_id || null,
      artisan.education_level_id || null, artisan.dependents_count, profilePicturePath, artisan.ntn || null,
      artisan.skill_id, artisan.major_product, artisan.experience || null, artisan.avg_monthly_income || null,
      artisan.employment_type_id, artisan.raw_material || null, artisan.loan_status || null,
      artisan.has_machinery || null, artisan.has_training || null, artisan.inherited_skills || null,
      artisan.financial_assistance || null, artisan.technical_assistance || null, artisan.comments || null, artisan.latitude || null, artisan.longitude || null, artisan.user_Id || null
    ];

    const { lastID } = await dbAsync.run(sql, params);
    return lastID;
  },

  createProductImages(artisanId, files) {
    if (!files || files.length === 0) {
      return Promise.resolve([]);
    }

    const productImagesDir = 'uploads/product_images';
    // Ensure the directory exists
    if (!fs.existsSync(productImagesDir)) {
      fs.mkdirSync(productImagesDir, { recursive: true });
    }

    const imagePaths = files.map(file => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      const filename = `product_image-${uniqueSuffix}${path.extname(file.originalname)}`;
      const filePath = path.join(productImagesDir, filename);

      // Move the file to the destination directory
      fs.renameSync(file.path, filePath);
      return filePath;
    });

    const ops = imagePaths.map(imagePath => {
      const sql = `
        INSERT INTO product_images (artisan_id, image_path)
        VALUES (?, ?)
      `;
      return dbAsync.run(sql, [artisanId, imagePath]);
    });

    return Promise.all(ops).then(() => imagePaths);
  },

  createTrainings(artisanId, trainings = []) {
    if (!trainings.length) return Promise.resolve();

    const ops = trainings.map(training => {
      const sql = `
        INSERT INTO trainings (artisan_id, title, duration, organization, user_Id)
        VALUES (?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId, training.title, training.duration, training.organization, training.user_Id || null
      ]);
    });

    return Promise.all(ops);
  },

  createLoans(artisanId, loans = []) {
    if (!loans.length) return Promise.resolve();

    const ops = loans.map(loan => {
      const sql = `
        INSERT INTO loans (artisan_id, amount, date, loan_type, name, user_Id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId, loan.amount, loan.date, loan.loan_type || null, loan.name || null, loan.user_Id || null
      ]);
    });

    return Promise.all(ops);
  },

  createMachines(artisanId, machines = []) {
    if (!machines.length) return Promise.resolve();

    const ops = machines.map(machine => {
      const sql = `
        INSERT INTO machines (artisan_id, title, size, number_of_machines, user_Id)
        VALUES (?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId, machine.title, machine.size, machine.number_of_machines, machine.user_Id || null
      ]);
    });

    return Promise.all(ops);
  },

  updateArtisan(id, artisan) {
    const sql = `
      UPDATE artisans SET
        name = ?, father_name = ?, cnic = ?, gender = ?, date_of_birth = ?, contact_no = ?, email = ?, address = ?,
        tehsil_id = ?, education_level_id = ?, dependents_count = ?, profile_picture = ?, ntn = ?, skill_id = ?,
        major_product = ?, experience = ?, avg_monthly_income = ?, employment_type_id = ?, raw_material = ?,
        loan_status = ?, has_machinery = ?, has_training = ?, inherited_skills = ?, comments = ?, latitude = ?,
        longitude = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND isActive = 1
    `;

    return dbAsync.run(sql, [
      artisan.name, artisan.father_name, artisan.cnic, artisan.gender, artisan.date_of_birth, artisan.contact_no,
      artisan.email || null, artisan.address || null, artisan.tehsil_id || null, artisan.education_level_id || null,
      artisan.dependents_count, artisan.profile_picture, artisan.ntn || null, artisan.skill_id,
      artisan.major_product, artisan.experience || null, artisan.avg_monthly_income || null,
      artisan.employment_type_id, artisan.raw_material || null, artisan.loan_status || null,
      artisan.has_machinery || null, artisan.has_training || null, artisan.inherited_skills || null,
      artisan.comments || null, artisan.latitude || null, artisan.longitude || null, artisan.user_Id || null, id
    ]);
  },

  softDeleteArtisan(id) {
    return dbAsync.run(
      'UPDATE artisans SET isActive = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
  },

  getAllArtisans() {
    return dbAsync.all('SELECT * FROM artisans WHERE isActive = 1');
  },

  getArtisanById(id) {
    return dbAsync.get('SELECT * FROM artisans WHERE id = ? AND isActive = 1', [id]);
  },

  // New methods for updating related data
  updateBusiness(artisanId, business) {
    const sql = `
      UPDATE businesses SET
        employment_type = ?, raw_material = ?, has_machinery = ?, inherited_skills = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      business.employment_type, business.raw_material || null, business.has_machinery,
      business.inherited_skills || null, business.user_Id || null, artisanId
    ]);
  },

  updateCraft(artisanId, craft) {
    const sql = `
      UPDATE artisan_crafts SET
        craft_type = ?, category = ?, sub_category = ?, major_product = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      craft.craft_type, craft.category, craft.sub_category || null,
      craft.major_product, craft.user_Id || null, artisanId
    ]);
  },

  updateAssistance(artisanId, assistance) {
    const sql = `
      UPDATE assistance SET
        financial_assistance = ?, technical_assistance = ?, comments = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      assistance.financial_assistance || null, assistance.technical_assistance || null,
      assistance.comments || null, assistance.user_Id || null, artisanId
    ]);
  },

  deleteTrainings(artisanId) {
    return dbAsync.run('DELETE FROM trainings WHERE artisan_id = ?', [artisanId]);
  },

  deleteLoans(artisanId) {
    return dbAsync.run('DELETE FROM loans WHERE artisan_id = ?', [artisanId]);
  },

  deleteMachines(artisanId) {
    return dbAsync.run('DELETE FROM machines WHERE artisan_id = ?', [artisanId]);
  }
};

module.exports = (dependencies) => {
  const { logger } = dependencies;

  // Route handlers
  const handlers = {
    // Create a new artisan with related data
    create: [
      upload.fields([
        { name: 'artisan[profile_picture]', maxCount: 1 },
        { name: 'product_images', maxCount: 5 } // Adjust maxCount as needed
      ]),
      validateArtisanData,
      async (req, res) => {
        const routeLogger = logger.child({ route: 'artisans', handler: 'create' });
        routeLogger.info({ body: req.body, files: req.files }, 'Received create artisan request');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.write(`data: ${JSON.stringify({ status: 'error', statusCode: 400, errors: errors.array() })}\n\n`);
          return res.end();
        }
        try {
          const { artisan, trainings, loans, machines } = req.body;
          const profilePicturePath = req.files ? req.files['artisan[profile_picture]'] ? req.files['artisan[profile_picture]'][0].path : null : null;

          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating artisan...' })}\n\n`);
          routeLogger.info('Creating artisan...');
          const artisanId = await entityOps.createArtisan(artisan, profilePicturePath ?? artisan.profile_picture);
          routeLogger.info({ artisanId }, 'Artisan created successfully');

          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating trainings...' })}\n\n`);
          routeLogger.info('Creating trainings...');
          await entityOps.createTrainings(artisanId, trainings);
          routeLogger.info('Trainings created successfully');

          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating loans...' })}\n\n`);
          routeLogger.info('Creating loans...');
          await entityOps.createLoans(artisanId, loans);
          routeLogger.info('Loans created successfully');

          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating machines...' })}\n\n`);
          routeLogger.info('Creating machines...');
          await entityOps.createMachines(artisanId, machines);
          routeLogger.info('Machines created successfully');


          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating product images...' })}\n\n`);
          routeLogger.info('Creating product images...');
          const productImages = req.files ? req.files['product_images'] : [];
          const imagePaths = await entityOps.createProductImages(artisanId, productImages);
          routeLogger.info('Product images created successfully');

          res.write(`data: ${JSON.stringify({ status: 'complete', statusCode: 201, id: artisanId, message: 'Artisan and related data created successfully', imagePaths })}\n\n`);
          res.status(200).end();
        } catch (err) {
          const routeLogger = logger.child({ route: 'artisans', handler: 'create' });
          routeLogger.error({ error: err }, 'Error creating artisan');
          res.write(`data: ${JSON.stringify({ status: 'error', statusCode: 500, error: err.message })}\n\n`);
          res.status(200).end();
        }
      }
    ],

    // Get all active artisans
    async getAll(req, res) {
      const routeLogger = logger.child({ route: 'artisans', handler: 'getAll' });
      routeLogger.info('Received get all artisans request');
      try {
        const artisans = await entityOps.getAllArtisans();
        res.json(artisans);
      } catch (err) {
        routeLogger.error({ error: err }, 'Error fetching artisans');
        res.status(500).json({ error: err.message });
      }
    },

    // Get a single artisan by ID
    async getOne(req, res) {
      const routeLogger = logger.child({ route: 'artisans', handler: 'getOne' });
      routeLogger.info({ id: req.params.id }, 'Received get artisan by id request');
      try {
        const artisan = await entityOps.getArtisanById(req.params.id);
        if (!artisan) {
          routeLogger.warn({ id: req.params.id }, 'Artisan not found');
          return res.status(404).json({ message: 'Artisan not found' });
        }
        res.json(artisan);
      } catch (err) {
        routeLogger.error({ error: err, id: req.params.id }, 'Error fetching artisan');
        res.status(500).json({ error: err.message });
      }
    },

    // Update an artisan and related data
    update: [
      validateUpdateArtisanData,
      async (req, res) => {
        const routeLogger = logger.child({ route: 'artisans', handler: 'update' });
        routeLogger.info({ id: req.params.id, body: req.body }, 'Received update artisan request');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.write(`data: ${JSON.stringify({ status: 'error', error: errors.array() })}\n\n`);
          return res.status(400).end();
        }

        try {
          const artisanId = req.params.id;
          const { artisan, business, craft, trainings, loans, machines, assistance } = req.body;

          res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating artisan...' })}\n\n`);

          // Start transaction
          await dbAsync.run('BEGIN TRANSACTION');

          // Update artisan if provided
          if (artisan) {
            const { changes } = await entityOps.updateArtisan(artisanId, artisan);
            if (changes === 0) {
              throw new Error('Artisan not found');
            }
          }

          // Update related data if provided
          const operations = [];

          if (business) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating business...' })}\n\n`);
            operations.push(entityOps.updateBusiness(artisanId, business));
          }

          if (craft) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating craft...' })}\n\n`);
            operations.push(entityOps.updateCraft(artisanId, craft));
          }

          if (trainings) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating trainings...' })}\n\n`);
            operations.push(entityOps.deleteTrainings(artisanId));
            operations.push(entityOps.createTrainings(artisanId, trainings));
          }

          if (loans) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating loans...' })}\n\n`);
            operations.push(entityOps.deleteLoans(artisanId));
            operations.push(entityOps.createLoans(artisanId, loans));
          }

          if (machines) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating machines...' })}\n\n`);
            operations.push(entityOps.deleteMachines(artisanId));
            operations.push(entityOps.createMachines(artisanId, machines));
          }

          if (assistance) {
            res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Updating assistance...' })}\n\n`);
            operations.push(entityOps.updateAssistance(artisanId, assistance));
          }

          if (operations.length > 0) {
            await executeTransaction(operations);
          }

          // Commit transaction
          await dbAsync.run('COMMIT');
          res.write(`data: ${JSON.stringify({ status: 'complete', message: 'Artisan and related data updated successfully' })}\n\n`);
          res.status(200).end();
        } catch (err) {
          await dbAsync.run('ROLLBACK');
          const routeLogger = logger.child({ route: 'artisans', handler: 'update' });
          routeLogger.error({ error: err, id: req.params.id }, 'Error updating artisan');
          res.write(`data: ${JSON.stringify({ status: 'error', error: err.message })}\n\n`);
          res.status(500).end();
        }
      }
    ],

    // Soft delete an artisan
    async remove(req, res) {
      const routeLogger = logger.child({ route: 'artisans', handler: 'remove' });
      routeLogger.info({ id: req.params.id }, 'Received delete artisan request');
      try {
        const { changes } = await entityOps.softDeleteArtisan(req.params.id);

        if (changes === 0) {
          routeLogger.warn({ id: req.params.id }, 'Artisan not found');
          return res.status(404).json({ message: 'Artisan not found' });
        }

        res.json({ message: 'Artisan deleted successfully' });
      } catch (err) {
        routeLogger.error({ error: err, id: req.params.id }, 'Error deleting artisan');
        res.status(500).json({ error: err.message });
      }
    }
  };

  // Routes
  /**
   * @swagger
   * /artisans:
   *   post:
   *     summary: Create a new artisan
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             properties:
   *               artisan[name]:
   *                 type: string
   *               artisan[father_name]:
   *                 type: string
   *               artisan[cnic]:
   *                 type: string
   *               artisan[gender]:
   *                 type: string
   *               artisan[date_of_birth]:
   *                 type: string
   *               artisan[contact_no]:
   *                 type: string
   *               artisan[dependents_count]:
   *                 type: integer
   *               artisan[has_training]:
   *                 type: boolean
   *               artisan[profile_picture]:
   *                 type: string
   *                 format: binary
   *               business[employment_type]:
   *                 type: string
   *               business[has_machinery]:
   *                 type: boolean
   *               craft[craft_type]:
   *                 type: string
   *               craft[category]:
   *                 type: string
   *               craft[major_product]:
   *                 type: string
   *               trainings:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     duration:
   *                       type: string
   *                     organization:
   *                       type: string
   *               loans:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     amount:
   *                       type: number
   *                     date:
   *                       type: string
   *                     donor:
   *                       type: string
   *                     bank:
   *                       type: string
   *               machines:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     size:
   *                       type: string
   *                     number_of_machines:
   *                       type: integer
   *               assistance[financial_assistance]:
   *                 type: string
   *               assistance[technical_assistance]:
   *                 type: string
   *               assistance[comments]:
   *                 type: string
   *               productImages:
   *                 type: array
   *                 items:
   *                   type: string
   *                   format: binary
   *                   description: Product images
   *     responses:
   *       201:
   *         description: Artisan created successfully
   *       400:
   *         description: Invalid request data
   *       500:
   *         description: Internal server error
   */
  router.post('/artisans', handlers.create);
  /**
   * @swagger
   * /artisans:
   *   get:
   *     summary: Get all artisans
   *     responses:
   *       200:
   *         description: Successful operation
   *       500:
   *         description: Internal server error
   */
  router.get('/artisans', handlers.getAll);
  /**
   * @swagger
   * /artisans/{id}:
   *   get:
   *     summary: Get an artisan by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the artisan to retrieve
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Successful operation
   *       404:
   *         description: Artisan not found
   *       500:
   *         description: Internal server error
   */
  router.get('/artisans/:id', handlers.getOne);
  /**
   * @swagger
   * /artisans/{id}:
   *   put:
   *     summary: Update an existing artisan
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the artisan to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               artisan[name]:
   *                 type: string
   *               artisan[father_name]:
   *                 type: string
   *               artisan[cnic]:
   *                 type: string
   *               artisan[gender]:
   *                 type: string
   *               artisan[date_of_birth]:
   *                 type: string
   *               artisan[contact_no]:
   *                 type: string
   *               artisan[dependents_count]:
   *                 type: integer
   *               artisan[has_training]:
   *                 type: boolean
   *               business[employment_type]:
   *                 type: string
   *               business[has_machinery]:
   *                 type: boolean
   *               craft[craft_type]:
   *                 type: string
   *               craft[category]:
   *                 type: string
   *               craft[major_product]:
   *                 type: string
   *               trainings:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     duration:
   *                       type: string
   *                     organization:
   *                       type: string
   *               loans:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     amount:
   *                       type: number
   *                     date:
   *                       type: string
   *                     donor:
   *                       type: string
   *                     bank:
   *                       type: string
   *               machines:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     size:
   *                       type: string
   *                     number_of_machines:
   *                       type: integer
   *               assistance[financial_assistance]:
   *                 type: string
   *               assistance[technical_assistance]:
   *                 type: string
   *               assistance[comments]:
   *                 type: string
   *     responses:
   *       200:
   *         description: Artisan updated successfully
   *       400:
   *         description: Invalid request data
   *       404:
   *         description: Artisan not found
   *       500:
   *         description: Internal server error
   */
  router.put('/artisans/:id', handlers.update);
  /**
   * @swagger
   * /artisans/{id}:
   *   delete:
   *     summary: Delete an artisan
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the artisan to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Artisan deleted successfully
   *       404:
   *         description: Artisan not found
   *       500:
   *         description: Internal server error
   */
  router.delete('/artisans/:id', handlers.remove);

  return router;
};