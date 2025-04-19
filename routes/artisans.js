const path = require("path");
const express = require("express");
const fs = require("fs");
const router = express.Router();
const {
  upload,
  dbAsync,
  executeTransaction,
  body,
  validationResult,
} = require("./artisans_base_route.js");
const parseJsonFields = require('../config/parseJsonFields.js'); // Adjust path

// Validation middleware for create
const validateArtisanData = [
  // Artisan validations
  body("artisan.name").notEmpty().withMessage("Name is required"),
  body("artisan.father_name")
    .notEmpty()
    .withMessage("Father's name is required"),
  body("artisan.cnic")
    .isLength({ min: 15, max: 15 })
    .withMessage("CNIC must be 15 digits with dashes"),
  body("artisan.gender")
    .isIn(["Male", "Female", "Trangender"])
    .withMessage("Invalid gender"),
  body("artisan.date_of_birth")
    .isISO8601()
    .withMessage("Invalid date of birth"),
  body("artisan.contact_no")
    .isLength({ min: 12, max: 12 })
    .withMessage("Invalid phone number! Must be 12 digits with dashes"),
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
  body("artisan.latitude")
    .optional()
    .isFloat()
    .withMessage("Latitude must be a number"),
  body("artisan.longitude")
    .optional()
    .isFloat()
    .withMessage("Longitude must be a number"),
];

// Validation middleware for update
const validateUpdateArtisanData = [
  // Artisan validations
  body("artisan.name").notEmpty().withMessage("Name is required"),
  body("artisan.father_name")
    .notEmpty()
    .withMessage("Father's name is required"),
  body("artisan.cnic")
    .isLength({ min: 15, max: 15 })
    .withMessage("CNIC must be 15 digits with dashes"),
  body("artisan.gender")
    .isIn(["Male", "Female", "Trangender"])
    .withMessage("Invalid gender"),
  body("artisan.date_of_birth")
    .isISO8601()
    .withMessage("Invalid date of birth"),
  body("artisan.contact_no")
    .isLength({ min: 12, max: 12 })
    .withMessage("Invalid phone number! Must be 12 digits with dashes"),
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
  body("artisan.latitude")
    .optional()
    .isFloat()
    .withMessage("Latitude must be a number"),
  body("artisan.longitude")
    .optional()
    .isFloat()
    .withMessage("Longitude must be a number"),
];

// Entity operations
const entityOps = {
  async createArtisan(artisan, profilePicturePath) {
    const sql = `
      INSERT INTO artisans (
        name, father_name, cnic, gender, date_of_birth, contact_no, email, address,
        tehsil_id, education_level_id, dependents_count, profile_picture, ntn, skill_id, uc,
        major_product, experience, avg_monthly_income, employment_type_id, raw_material,
        loan_status, has_machinery, has_training, inherited_skills, financial_assistance, technical_assistance, comments, latitude,
        longitude, user_Id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      artisan.name,
      artisan.father_name,
      artisan.cnic,
      artisan.gender,
      artisan.date_of_birth,
      artisan.contact_no,
      artisan.email || null,
      artisan.address || null,
      artisan.tehsil_id || null,
      artisan.education_level_id || null,
      artisan.dependents_count,
      profilePicturePath,
      artisan.ntn || null,
      artisan.skill_id,
      artisan.uc,
      artisan.major_product,
      artisan.experience || null,
      artisan.avg_monthly_income || null,
      artisan.employment_type_id,
      artisan.raw_material || null,
      artisan.loan_status || null,
      artisan.has_machinery || null,
      artisan.has_training || null,
      artisan.inherited_skills || null,
      artisan.financial_assistance || null,
      artisan.technical_assistance || null,
      artisan.comments || null,
      artisan.latitude || null,
      artisan.longitude || null,
      artisan.user_Id || null,
    ];

    const { lastID } = await dbAsync.run(sql, params);
    return lastID;
  },

  createProductImages(artisanId, files) {
    if (!files || files.length === 0) {
      return Promise.resolve([]);
    }

    const productImagesDir = "uploads/product_images";
    // Ensure the directory exists
    if (!fs.existsSync(productImagesDir)) {
      fs.mkdirSync(productImagesDir, { recursive: true });
    }

    const imagePaths = files.map((file) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `product_image-${uniqueSuffix}${path.extname(
        file.originalname
      )}`;
      const filePath = path.join(productImagesDir, filename);

      // Move the file to the destination directory
      fs.renameSync(file.path, filePath);
      return filePath;
    });

    const ops = imagePaths.map((imagePath) => {
      const sql = `
        INSERT INTO product_images (artisan_id, image_path)
        VALUES (?, ?)
      `;
      return dbAsync.run(sql, [artisanId, imagePath]);
    });

    return Promise.all(ops).then(() => imagePaths);
  },
  createShopImages(artisanId, files) {
    if (!files || files.length === 0) {
      return Promise.resolve([]);
    }

    const shopImagesDir = "uploads/shop_images";
    // Ensure the directory exists
    if (!fs.existsSync(shopImagesDir)) {
      fs.mkdirSync(shopImagesDir, { recursive: true });
    }

    const imagePaths = files.map((file) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `shop_image-${uniqueSuffix}${path.extname(
        file.originalname
      )}`;
      const filePath = path.join(shopImagesDir, filename);

      // Move the file to the destination directory
      fs.renameSync(file.path, filePath);
      return filePath;
    });

    const ops = imagePaths.map((imagePath) => {
      const sql = `
        INSERT INTO shop_images (artisan_id, image_path)
        VALUES (?, ?)
      `;
      return dbAsync.run(sql, [artisanId, imagePath]);
    });

    return Promise.all(ops).then(() => imagePaths);
  },

  createTrainings(artisanId, trainings = []) {
    if (!trainings.length) return Promise.resolve();

    const ops = trainings.map((training) => {
      const sql = `
        INSERT INTO trainings (artisan_id, title, duration, organization, date, user_Id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId,
        training.title,
        training.duration,
        training.organization,
        training.date,
        training.user_Id || null,
      ]);
    });

    return Promise.all(ops);
  },

  createLoans(artisanId, loans = []) {
    if (!loans.length) return Promise.resolve();

    const ops = loans.map((loan) => {
      const sql = `
        INSERT INTO loans (artisan_id, amount, date, loan_type, name, subName, user_Id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId,
        loan.amount,
        loan.date,
        loan.loan_type || null,
        loan.name || null,
        loan.subName || null,
        loan.user_Id || null,
      ]);
    });

    return Promise.all(ops);
  },

  createMachines(artisanId, machines = []) {
    if (!machines.length) return Promise.resolve();

    const ops = machines.map((machine) => {
      const sql = `
        INSERT INTO machines (artisan_id, title, size, number_of_machines, user_Id)
        VALUES (?, ?, ?, ?, ?)
      `;

      return dbAsync.run(sql, [
        artisanId,
        machine.title,
        machine.size,
        machine.number_of_machines,
        machine.user_Id || null,
      ]);
    });

    return Promise.all(ops);
  },

  // Updated function signature to accept newProfilePicturePath
  async updateArtisan(id, artisan, newProfilePicturePath) {
    // Base fields from the artisan object (excluding profile_picture)
    const fieldsToUpdate = [
      "name",
      "father_name",
      "cnic",
      "gender",
      "date_of_birth",
      "contact_no",
      "email",
      "address",
      "tehsil_id",
      "education_level_id",
      "dependents_count",
      "ntn",
      "skill_id",
      "uc",
      "major_product",
      "experience",
      "avg_monthly_income",
      "employment_type_id",
      "raw_material",
      "loan_status",
      "has_machinery",
      "has_training",
      "inherited_skills",
      "financial_assistance",
      "technical_assistance",
      "comments",
      "latitude",
      "longitude",
      "user_Id",
    ];

    const setClauses = [];
    const params = [];

    // Build SET clauses and params for fields coming from the artisan object
    fieldsToUpdate.forEach((field) => {
      // Check if the field exists in the input 'artisan' object
      // This allows for partial updates if the 'artisan' object only contains changed fields.
      // If you expect 'artisan' to always contain *all* fields, you can skip the 'hasOwnProperty' check.
      if (artisan && Object.prototype.hasOwnProperty.call(artisan, field)) {
        setClauses.push(`${field} = ?`);
        // Use null if the value is explicitly undefined or null, otherwise use the value
        params.push(
          artisan[field] !== undefined && artisan[field] !== null
            ? artisan[field]
            : null
        );
      }
    });

    // Conditionally add profile_picture update if a new path is provided
    // Use 'undefined' check because null might be a valid value to *clear* the picture
    if (newProfilePicturePath !== undefined) {
      setClauses.push("profile_picture = ?");
      params.push(newProfilePicturePath); // Pass the new path (could be null to clear it)
    }

    // Only proceed if there's something to update
    if (setClauses.length === 0) {
      // Nothing to update (no fields in artisan object and no new profile picture)
      // Return a result indicating no changes were needed or made
      return { changes: 0 };
    }

    // Add updated_at timestamp
    setClauses.push("updated_at = CURRENT_TIMESTAMP");

    // Add the ID for the WHERE clause
    params.push(id);

    // Construct the final SQL query
    const sql = `
      UPDATE artisans
      SET ${setClauses.join(", ")}
      WHERE id = ?
    `;

    // Execute the query and return the result (contains 'changes')
    return dbAsync.run(sql, params);
  },

  softDeleteArtisan(id) {
    return dbAsync.run(
      "UPDATE artisans SET isActive = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id]
    );
  },

  getAllArtisans(filters = {}) {
    const {
      user_Id,
      division,
      district,
      tehsil,
      gender,
      craft,
      category,
      skill,
    } = filters;

    let query = "SELECT * FROM artisansView WHERE isActive = 1";
    const params = [];

    if (user_Id) {
      query += " AND user_Id = ?";
      params.push(user_Id);
    }

    if (division) {
      query += " AND division_name = ?";
      params.push(division);
    }

    if (district) {
      query += " AND district_name = ?";
      params.push(district);
    }

    if (tehsil) {
      query += " AND tehsil_name = ?";
      params.push(tehsil);
    }

    if (gender) {
      query += " AND gender = ?";
      params.push(gender);
    }

    if (craft) {
      query += " AND craft_name = ?";
      params.push(craft);
    }

    if (category) {
      query += " AND category_name = ?";
      params.push(category);
    }

    if (skill) {
      query += " AND skill_name = ?";
      params.push(skill);
    }

    return dbAsync.all(query, params);
  },

  /* async getArtisanById(id) {
    const sql = `
       SELECT
        artisans.id,
        artisans.name,
        artisans.father_name,
        artisans.cnic,
        artisans.gender,
        artisans.date_of_birth,
        artisans.contact_no,
        artisans.email,
        artisans.address,
        artisans.tehsil_id,
        artisans.profile_picture,
        concat('https://artisan-psic.com/', artisans.profile_picture) AS profile_picture,
        division.name as division_name,
        district.name as district_name,
        tehsil.name as tehsil_name,
        artisans.education_level_id,
        artisans.dependents_count,
        artisans.ntn,
        artisans.uc,
        artisans.skill_id,
        crafts.name as craft_name,
        crafts.color as craft_color,
        categories.name as category_name,
        categories.color as category_color,
        techniques.name as skill_name,
        techniques.color as skill_color,
        education.name as education_name,
        artisans.major_product,
        artisans.experience,
        artisans.avg_monthly_income,
        artisans.employment_type_id,
        artisans.raw_material,
        artisans.loan_status,
        artisans.has_machinery,
        artisans.has_training,
        artisans.inherited_skills,
        artisans.financial_assistance,
        artisans.technical_assistance,
        artisans.comments,
        artisans.latitude,
        artisans.longitude,
        artisans.created_at,
        artisans.updated_at,
        artisans.isActive,
        artisans.user_Id,
        user.username,
        trainings.title AS training_title,
        trainings.duration AS training_duration,
        trainings.organization AS training_organization,
        loans.amount AS loan_amount,
        loans.date AS loan_date,
        loans.loan_type AS loan_type,
        loans.name AS loan_name,
        machines.title AS machine_title,
        machines.size AS machine_size,
        machines.number_of_machines AS machine_number_of_machines,
        concat('https://artisan-psic.com/', product_images.image_path) AS product_image_path,
        concat('https://artisan-psic.com/', shop_images.image_path) AS shop_image_path
      FROM artisans
      LEFT JOIN techniques ON artisans.skill_id = techniques.id
      LEFT JOIN categories ON categories.id = techniques.category_Id
      LEFT JOIN crafts ON crafts.id = categories.craft_Id
      LEFT JOIN education ON artisans.education_level_id = education.id
      LEFT JOIN geo_level as tehsil ON artisans.tehsil_id = tehsil.id
      LEFT JOIN geo_level as district ON substr( tehsil.code, 1, 6 ) = district.code
      LEFT JOIN geo_level as division ON substr( district.code, 1, 3 ) = division.code
      LEFT JOIN user ON artisans.user_Id = user.id
      LEFT JOIN trainings ON artisans.id = trainings.artisan_id
      LEFT JOIN loans ON artisans.id = loans.artisan_id
      LEFT JOIN machines ON artisans.id = machines.artisan_id
      LEFT JOIN product_images ON artisans.id = product_images.artisan_id
      LEFT JOIN shop_images ON artisans.id = shop_images.artisan_id
      WHERE artisans.id = ? AND artisans.isActive = 1
  `;

    const rows = await dbAsync.all(sql, [id]);

    if (!rows || rows.length === 0) {
      return null;
    }

    const artisan = {
      ...rows[0],
      trainings: [],
      loans: [],
      machines: [],
      product_images: [],
      shop_images: [],
    };

    rows.forEach((row) => {
      if (row.training_title) {
        artisan.trainings.push({
          title: row.training_title,
          duration: row.training_duration,
          organization: row.training_organization,
        });
      }
      if (row.loan_amount) {
        artisan.loans.push({
          amount: row.loan_amount,
          date: row.loan_date,
          loan_type: row.loan_type,
          name: row.loan_name,
        });
      }
      if (row.machine_title) {
        artisan.machines.push({
          title: row.machine_title,
          size: row.machine_size,
          number_of_machines: row.machine_number_of_machines,
        });
      }
      if (row.product_image_path) {
        artisan.product_images.push(row.product_image_path);
      }
      if (row.shop_image_path) {
        artisan.shop_images.push(row.shop_image_path);
      }
    });

    // Remove null values if no data exists
    if (artisan.trainings.length === 0) {
      delete artisan.trainings;
    }
    if (artisan.loans.length === 0) {
      delete artisan.loans;
    }
    if (artisan.machines.length === 0) {
      delete artisan.machines;
    }
    if (artisan.product_images.length === 0) {
      delete artisan.product_images;
    }
    if (artisan.shop_images.length === 0) {
      delete artisan.shop_images;
    }

    return artisan;
  }, */

  async getArtisanById(id) {
    // Step 1: Query the main artisan information
    const mainSql = `
        SELECT
            artisans.id,
            artisans.name,
            artisans.father_name,
            artisans.cnic,
            artisans.gender,
            artisans.date_of_birth,
            artisans.contact_no,
            artisans.email,
            artisans.address,
            artisans.tehsil_id,
            artisans.profile_picture,
            concat('https://artisan-psic.com/', artisans.profile_picture) AS profile_picture,
            division.name AS division_name,
            district.name AS district_name,
            tehsil.name AS tehsil_name,
            artisans.education_level_id,
            artisans.dependents_count,
            artisans.ntn,
            artisans.uc,
            artisans.skill_id,
            crafts.id AS craft_id,
            crafts.name AS craft_name,
            crafts.color AS craft_color,
            categories.id AS category_id,
            categories.name AS category_name,
            categories.color AS category_color,
            techniques.name AS skill_name,
            techniques.color AS skill_color,
            education.name AS education_name,
            artisans.major_product,
            artisans.experience,
            artisans.avg_monthly_income,
            artisans.employment_type_id,
            artisans.raw_material,
            artisans.loan_status,
            artisans.has_machinery,
            artisans.has_training,
            artisans.inherited_skills,
            artisans.financial_assistance,
            artisans.technical_assistance,
            artisans.comments,
            artisans.latitude,
            artisans.longitude,
            artisans.created_at,
            artisans.updated_at,
            artisans.isActive,
            artisans.user_Id,
            user.username
        FROM artisans
        LEFT JOIN techniques ON artisans.skill_id = techniques.id
        LEFT JOIN categories ON techniques.category_Id = categories.id
        LEFT JOIN crafts ON categories.craft_Id = crafts.id
        LEFT JOIN education ON artisans.education_level_id = education.id
        LEFT JOIN geo_level AS tehsil ON artisans.tehsil_id = tehsil.id
        LEFT JOIN geo_level AS district ON substr(tehsil.code, 1, 6) = district.code
        LEFT JOIN geo_level AS division ON substr(district.code, 1, 3) = division.code
        LEFT JOIN user ON artisans.user_Id = user.id
        WHERE artisans.id = ? AND artisans.isActive = 1
    `;

    const artisanRow = await dbAsync.get(mainSql, [id]);

    if (!artisanRow) {
      return null;
    }

    // Initialize the artisan object with main data
    const artisan = { ...artisanRow };

    // Step 2: Query one-to-many related data concurrently
    const trainingsSql = `
        SELECT
            title AS title,
            duration AS duration,
            organization AS organization,
            date
        FROM trainings
        WHERE artisan_id = ?
    `;

    const loansSql = `
        SELECT
            amount AS amount,
            date AS date,
            loan_type,
            name AS name,
            subName
        FROM loans
        WHERE artisan_id = ?
    `;

    const machinesSql = `
        SELECT
            title AS title,
            size AS size,
            number_of_machines AS number_of_machines
        FROM machines
        WHERE artisan_id = ?
    `;

    const productImagesSql = `
        SELECT
            concat('https://artisan-psic.com/', image_path) AS product_image_path
        FROM product_images
        WHERE artisan_id = ?
    `;

    const shopImagesSql = `
        SELECT
            concat('https://artisan-psic.com/', image_path) AS shop_image_path
        FROM shop_images
        WHERE artisan_id = ?
    `;

    // Execute all related queries concurrently for efficiency
    const [trainings, loans, machines, productImages, shopImages] =
      await Promise.all([
        dbAsync.all(trainingsSql, [id]),
        dbAsync.all(loansSql, [id]),
        dbAsync.all(machinesSql, [id]),
        dbAsync.all(productImagesSql, [id]),
        dbAsync.all(shopImagesSql, [id]),
      ]);

    // Step 3: Attach related data to the artisan object
    if (trainings.length > 0) {
      artisan.trainings = trainings;
    }
    if (loans.length > 0) {
      artisan.loans = loans;
    }
    if (machines.length > 0) {
      artisan.machines = machines;
    }
    if (productImages.length > 0) {
      artisan.product_images = productImages.map(
        (row) => row.product_image_path
      );
    }
    if (shopImages.length > 0) {
      artisan.shop_images = shopImages.map((row) => row.shop_image_path);
    }

    return artisan;
  },

  // New methods for updating related data
  updateBusiness(artisanId, business) {
    const sql = `
      UPDATE businesses SET
        employment_type = ?, raw_material = ?, has_machinery = ?, inherited_skills = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      business.employment_type,
      business.raw_material || null,
      business.has_machinery,
      business.inherited_skills || null,
      business.user_Id || null,
      artisanId,
    ]);
  },

  updateCraft(artisanId, craft) {
    const sql = `
      UPDATE artisan_crafts SET
        craft_type = ?, category = ?, sub_category = ?, major_product = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      craft.craft_type,
      craft.category,
      craft.sub_category || null,
      craft.major_product,
      craft.user_Id || null,
      artisanId,
    ]);
  },

  updateAssistance(artisanId, assistance) {
    const sql = `
      UPDATE assistance SET
        financial_assistance = ?, technical_assistance = ?, comments = ?, user_Id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE artisan_id = ?
    `;
    return dbAsync.run(sql, [
      assistance.financial_assistance || null,
      assistance.technical_assistance || null,
      assistance.comments || null,
      assistance.user_Id || null,
      artisanId,
    ]);
  },

  deleteTrainings(artisanId) {
    return dbAsync.run("DELETE FROM trainings WHERE artisan_id = ?", [
      artisanId,
    ]);
  },

  deleteLoans(artisanId) {
    return dbAsync.run("DELETE FROM loans WHERE artisan_id = ?", [artisanId]);
  },

  deleteMachines(artisanId) {
    return dbAsync.run("DELETE FROM machines WHERE artisan_id = ?", [
      artisanId,
    ]);
  },
};

module.exports = (dependencies) => {
  const { logger } = dependencies;

  // Route handlers
  const handlers = {
    // Create a new artisan with related data
    create: [
      upload.fields([
        { name: "profile_picture", maxCount: 1 },
        { name: "product_images", maxCount: 5 }, // Adjust maxCount as needed
        { name: "shop_images", maxCount: 5 }, // Adjust maxCount as needed
      ]),
      validateArtisanData,
      async (req, res) => {
        const routeLogger = logger.child({
          route: "artisans",
          handler: "create",
        });
        routeLogger.info(
          { body: req.body, files: req.files },
          "Received create artisan request"
        );
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              statusCode: 400,
              message: errors
                .array()
                .map((error) => error.msg)
                .join(", "),
              errors: errors.array(),
            })}\n\n`
          );
          return res.status(500).end();
        }
        try {
          const { artisan, trainings, loans, machines } = req.body;
          const profilePicturePath = req.files
            ? req.files["profile_picture"]
              ? req.files["profile_picture"][0].path
              : null
            : "test";

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating artisan...' })}\n\n`);
          routeLogger.info("Creating artisan...");
          routeLogger.info({ artisan, trainings, loans, machines }, "artisan");
          routeLogger.info(
            { profilePicturePath: profilePicturePath },
            "profilePicturePath"
          );
          const artisanId = await entityOps.createArtisan(
            artisan,
            profilePicturePath
          );
          routeLogger.info({ artisanId }, "Artisan created successfully");

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating trainings...' })}\n\n`);
          routeLogger.info("Creating trainings...");
          await entityOps.createTrainings(artisanId, trainings);
          routeLogger.info("Trainings created successfully");

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating loans...' })}\n\n`);
          routeLogger.info("Creating loans...");
          await entityOps.createLoans(artisanId, loans);
          routeLogger.info("Loans created successfully");

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating machines...' })}\n\n`);
          routeLogger.info("Creating machines...");
          await entityOps.createMachines(artisanId, machines);
          routeLogger.info("Machines created successfully");

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating product images...' })}\n\n`);
          routeLogger.info("Creating product images...");
          const productImages = req.files ? req.files["product_images"] : [];
          const productImagesPaths = await entityOps.createProductImages(
            artisanId,
            productImages
          );
          routeLogger.info("Product images created successfully");

          //res.write(`data: ${JSON.stringify({ status: 'progress', message: 'Creating shop images...' })}\n\n`);
          routeLogger.info("Creating shop images...");
          const shopImages = req.files ? req.files["shop_images"] : [];
          const shopImagesPaths = await entityOps.createShopImages(
            artisanId,
            shopImages
          );
          routeLogger.info("Shop images created successfully");

          res.write(
            `data: ${JSON.stringify({
              status: "complete",
              statusCode: 201,
              id: artisanId,
              message: "Artisan and related data created successfully",
              profilePicturePath,
              productImagesPaths,
              shopImagesPaths,
            })}\n\n`
          );
          return res.status(201).end();
        } catch (err) {
          const routeLogger = logger.child({
            route: "artisans",
            handler: "create",
          });
          routeLogger.error({ error: err }, "Error creating artisan");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              statusCode: 500,
              message: err.message,
              error: err,
            })}\n\n`
          );
          return res.status(500).end();
        }
      },
    ],

    // Get all active artisans
    async getAll(req, res) {
      const routeLogger = logger.child({
        route: "artisans",
        handler: "getAll",
      });
      routeLogger.info("Received get all artisans request");
      try {
        const artisans = await entityOps.getAllArtisans(req.query);
        res.json(artisans);
      } catch (err) {
        routeLogger.error({ error: err }, "Error fetching artisans");
        res.status(500).json({ error: err.message });
      }
    },

    // Get a single artisan by ID
    async getOne(req, res) {
      const routeLogger = logger.child({
        route: "artisans",
        handler: "getOne",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received get artisan by id request"
      );
      try {
        const artisan = await entityOps.getArtisanById(req.params.id);
        if (!artisan) {
          routeLogger.warn({ id: req.params.id }, "Artisan not found");
          return res.status(404).json({ message: "Artisan not found" });
        }
        res.json(artisan);
      } catch (err) {
        routeLogger.error(
          { error: err, id: req.params.id },
          "Error fetching artisan"
        );
        res.status(500).json({ error: err.message });
      }
    },

    // Update an artisan and related data
    update: [
      // 1. Middleware for handling file uploads
      upload.fields([
        { name: "profile_picture", maxCount: 1 },
        { name: "product_images", maxCount: 5 }, // Adjust maxCount as needed
        { name: "shop_images", maxCount: 5 }, // Adjust maxCount as needed
      ]),
      // 2. Parse the specific stringified fields into objects/arrays
      parseJsonFields(['artisan', 'trainings', 'loans', 'machines']),

      // 3. Validation middleware
      validateUpdateArtisanData,

      // 4. Main Handler Function
      async (req, res) => {
        const artisanId = req.params.id; // Get ID from route parameters
        const routeLogger = logger.child({
          route: "artisans",
          handler: "update",
          artisanId: artisanId,
        });

        routeLogger.info(
          { body: req.body, files: req.files },
          "Received update artisan request (post-parsing)" // Log after parsing
        );

        // --- SSE Headers Removed ---

        // Validation check performed by middleware, but double check here
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          routeLogger.warn({ errors: errors.array() }, "Validation failed");
          // Standard JSON error response for validation
          return res.status(400).json({
            status: "error",
            statusCode: 400,
            message: errors.array().map((error) => error.msg).join(", "),
            errors: errors.array(),
          });
        }

        // Start transaction
        let transactionStarted = false;
        try {
          await dbAsync.run("BEGIN TRANSACTION");
          transactionStarted = true;
          routeLogger.info("Database transaction started.");

          // Now artisan, trainings etc are objects/arrays due to parseJsonFields middleware
          const { artisan, trainings, loans, machines } = req.body;
          let profilePicturePath = undefined;
          let productImagesPaths = [];
          let shopImagesPaths = [];

          // Check if a new profile picture was uploaded
          if (req.files?.["profile_picture"]?.[0]) {
            profilePicturePath = req.files["profile_picture"][0].path;
            routeLogger.info({ profilePicturePath }, "New profile picture uploaded.");
            // Optional: Add logic here to delete the old profile picture file if needed
          }

          // Update Artisan Core Data
          // Check if artisan object exists (post-parsing) or if profile pic changed
          if ((artisan && Object.keys(artisan).length > 0) || profilePicturePath !== undefined) {
            routeLogger.info("Updating artisan core data...");
            const updateResult = await entityOps.updateArtisan(
              artisanId,
              artisan, // Pass the parsed artisan object
              profilePicturePath // Pass the new path or undefined
            );
            if (!updateResult || updateResult.changes === 0) {
              throw Object.assign(new Error("Artisan not found or no changes made to core data"), {
                statusCode: 404, // Or 400 if no changes is considered a client error
              });
            }
            routeLogger.info("Artisan core data updated successfully.");
          } else {
            routeLogger.info("No core artisan data or profile picture provided for update.");
          }

          // Update Trainings (Delete old, Create new if provided in body)
          // Check if trainings array exists post-parsing
          if (trainings !== undefined && trainings !== null) { // Check presence, even if empty array []
            routeLogger.info(`Updating trainings (Received: ${Array.isArray(trainings) ? trainings.length : 'Not an array'})`);
            await entityOps.deleteTrainings(artisanId);
            if (Array.isArray(trainings) && trainings.length > 0) {
              await entityOps.createTrainings(artisanId, trainings); // Pass parsed array
              routeLogger.info("New trainings created successfully.");
            } else {
              routeLogger.info("No new trainings to create (received empty or non-array).");
            }
          }

          // Update Loans (Delete old, Create new if provided)
          if (loans !== undefined && loans !== null) {
            routeLogger.info(`Updating loans (Received: ${Array.isArray(loans) ? loans.length : 'Not an array'})`);
            await entityOps.deleteLoans(artisanId);
            if (Array.isArray(loans) && loans.length > 0) {
              await entityOps.createLoans(artisanId, loans); // Pass parsed array
              routeLogger.info("New loans created successfully.");
            } else {
              routeLogger.info("No new loans to create.");
            }
          }

          // Update Machines (Delete old, Create new if provided)
          if (machines !== undefined && machines !== null) {
            routeLogger.info(`Updating machines (Received: ${Array.isArray(machines) ? machines.length : 'Not an array'})`);
            await entityOps.deleteMachines(artisanId);
            if (Array.isArray(machines) && machines.length > 0) {
              await entityOps.createMachines(artisanId, machines); // Pass parsed array
              routeLogger.info("New machines created successfully.");
            } else {
              routeLogger.info("No new machines to create.");
            }
          }

          /*  // Update Product Images (Delete old, Create new if files provided)
           const productImages = req.files?.["product_images"] || []; // Use optional chaining
           if (productImages.length > 0) {
             routeLogger.info(`Updating product images (Received: ${productImages.length} files)`);
             await entityOps.deleteProductImages(artisanId); // Optional: Delete old files from storage here
             productImagesPaths = await entityOps.createProductImages(artisanId, productImages);
             routeLogger.info("New product images created successfully.");
           } else {
             routeLogger.info("No new product image files provided for update.");
           }
 
 
           // Update Shop Images (Delete old, Create new if files provided)
           const shopImages = req.files?.["shop_images"] || []; // Use optional chaining
           if (shopImages.length > 0) {
             routeLogger.info(`Updating shop images (Received: ${shopImages.length} files)`);
             await entityOps.deleteShopImages(artisanId); // Optional: Delete old files from storage here
             shopImagesPaths = await entityOps.createShopImages(artisanId, shopImages);
             routeLogger.info("New shop images created successfully.");
           } else {
             routeLogger.info("No new shop image files provided for update.");
           }
  */
          // Commit transaction
          await dbAsync.run("COMMIT");
          routeLogger.info("Database transaction committed.");

          // --- Removed res.write ---

          // Standard JSON success response
          return res.status(200).json({
            status: "complete",
            statusCode: 200,
            id: artisanId,
            message: "Artisan and related data updated successfully",
            profilePicturePath: profilePicturePath, // Path of the *new* profile picture if uploaded
            productImagesPaths: productImagesPaths, // Paths of *newly created* product images
            shopImagesPaths: shopImagesPaths,       // Paths of *newly created* shop images
          });

          // --- Removed res.status(200).end() ---

        } catch (err) {
          // Rollback transaction if it was started
          if (transactionStarted) {
            try {
              await dbAsync.run("ROLLBACK");
              routeLogger.info("Database transaction rolled back due to error.");
            } catch (rollbackErr) {
              routeLogger.error({ error: rollbackErr }, "Failed to rollback transaction.");
            }
          }

          const statusCode = err.statusCode || 500;
          // Log the detailed error
          routeLogger.error({
            message: err.message, // Main error message
            statusCode: statusCode,
            stack: err.stack, // Include stack trace for debugging
            originalError: err // Include the full error object if needed
          }, "Error updating artisan");


          // --- Removed res.write for error ---

          // Standard JSON error response
          return res.status(statusCode).json({
            status: "error",
            statusCode: statusCode,
            message: err.message || "An internal server error occurred during update.",
            // Avoid sending detailed stack in production JSON response for security
            error: process.env.NODE_ENV === "development" ? { message: err.message } : { message: "An internal server error occurred." },
          });
          // --- Removed res.status(statusCode).end() ---
        }
      },
    ],

    // Soft delete an artisan
    async remove(req, res) {
      const routeLogger = logger.child({
        route: "artisans",
        handler: "remove",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete artisan request"
      );
      try {
        const { changes } = await entityOps.softDeleteArtisan(req.params.id);

        if (changes === 0) {
          routeLogger.warn({ id: req.params.id }, "Artisan not found");
          return res.status(404).json({ message: "Artisan not found" });
        }

        res.json({ message: "Artisan deleted successfully" });
      } catch (err) {
        routeLogger.error(
          { error: err, id: req.params.id },
          "Error deleting artisan"
        );
        res.status(500).json({ error: err.message });
      }
    },
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
   *                 description: Artisan's name
   *                 example: John Doe
   *               artisan[father_name]:
   *                 type: string
   *                 description: Artisan's father's name
   *                 example: James Doe
   *               artisan[cnic]:
   *                 type: string
   *                 description: Artisan's CNIC number
   *                 example: "1124262292216"
   *               artisan[gender]:
   *                 type: string
   *                 description: Artisan's gender
   *                 example: Male
   *               artisan[date_of_birth]:
   *                 type: string
   *                 description: Artisan's date of birth
   *                 example: "1990-01-01"
   *               artisan[contact_no]:
   *                 type: string
   *                 description: Artisan's contact number
   *                 example: "12345678901"
   *               artisan[email]:
   *                 type: string
   *                 description: Artisan's email
   *                 example: john@example.com
   *               artisan[address]:
   *                 type: string
   *                 description: Artisan's address
   *                 example: "123 Street"
   *               artisan[tehsil_id]:
   *                 type: integer
   *                 description: Artisan's tehsil ID
   *                 example: 134
   *               artisan[education_level_id]:
   *                 type: integer
   *                 description: Artisan's education level ID
   *                 example: 1
   *               artisan[dependents_count]:
   *                 type: integer
   *                 description: Number of dependents
   *                 example: 2
   *               artisan[has_training]:
   *                 type: boolean
   *                 description: Whether the artisan has had training
   *                 example: true
   *               artisan[profile_picture]:
   *                 type: string
   *                 format: binary
   *                 description: Artisan's profile picture
   *                 example: "pic.jpg"
   *               artisan[ntn]:
   *                 type: string
   *                 description: Artisan's NTN
   *                 example: "NTN123"
   *               artisan[skill_id]:
   *                 type: integer
   *                 description: Artisan's skill ID
   *                 example: 1
   *               artisan[major_product]:
   *                 type: integer
   *                 description: Artisan's major product
   *                 example: 1
   *               artisan[experience]:
   *                 type: integer
   *                 description: Artisan's experience
   *                 example: 2
   *               artisan[avg_monthly_income]:
   *                 type: integer
   *                 description: Artisan's average monthly income
   *                 example: 111
   *               artisan[employment_type_id]:
   *                 type: integer
   *                 description: Artisan's employment type ID
   *                 example: 1
   *               artisan[raw_material]:
   *                 type: string
   *                 description: Artisan's raw material
   *                 example: "Local"
   *               artisan[loan_status]:
   *                 type: boolean
   *                 description: Artisan's loan status
   *                 example: true
   *               artisan[has_machinery]:
   *                 type: boolean
   *                 description: Whether the artisan has machinery
   *                 example: true
   *               artisan[inherited_skills]:
   *                 type: boolean
   *                 description: Whether the artisan has inherited skills
   *                 example: true
   *               artisan[financial_assistance]:
   *                 type: boolean
   *                 description: Whether the artisan has financial assistance
   *                 example: true
   *               artisan[technical_assistance]:
   *                 type: boolean
   *                 description: Whether the artisan has technical assistance
   *                 example: true
   *               artisan[comments]:
   *                 type: string
   *                 description: Artisan's comments
   *                 example: "ASD"
   *               artisan[latitude]:
   *                 type: number
   *                 description: Artisan's latitude
   *                 example: 33.22
   *               artisan[longitude]:
   *                 type: number
   *                 description: Artisan's longitude
   *                 example: 33.21
   *               trainings:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                       description: Training title
   *                       example: "Advanced Metalworking"
   *                     duration:
   *                       type: string
   *                       description: Training duration
   *                       example: "3 months"
   *                     organization:
   *                       type: string
   *                       description: Training organization
   *                       example: "Craft Institute"
   *                     user_Id:
   *                       type: integer
   *                       description: Training user ID
   *                       example: 1
   *               loans:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     amount:
   *                       type: number
   *                       description: Loan amount
   *                       example: 10000
   *                     date:
   *                       type: string
   *                       description: Loan date
   *                       example: "2023-01-01"
   *                     loan_type:
   *                       type: string
   *                       description: Loan type
   *                       example: "Bank"
   *                     name:
   *                       type: string
   *                       description: Loan name
   *                       example: "Bank Name"
   *                     user_Id:
   *                       type: integer
   *                       description: Loan user ID
   *                       example: 1
   *               machines:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                       description: Machine title
   *                       example: "Lathe"
   *                     size:
   *                       type: string
   *                       description: Machine size
   *                       example: "5x10 ft"
   *                     number_of_machines:
   *                       type: integer
   *                       description: Number of machines
   *                       example: 2
   *                     user_Id:
   *                       type: integer
   *                       description: Machine user ID
   *                       example: 1
   *               product_images:
   *                 type: array
   *                 items:
   *                   type: binary
   *                   format: binary
   *                   properties:
   *                     image_path:
   *                       type: string
   *                       format: binary
   *                       description: Product image path
   *                       example: "pic.jpg"
   *               assistance[financial_assistance]:
   *                 type: string
   *                 description: Financial assistance details
   *               assistance[technical_assistance]:
   *                 type: string
   *                 description: Technical assistance details
   *               assistance[comments]:
   *                 type: string
   *                 description: Assistance comments
   *     responses:
   *       201:
   *         description: Artisan created successfully
   *       400:
   *         description: Invalid request data
   *       500:
   *         description: Internal server error
   */
  router.post("/artisans", handlers.create);
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
  router.get("/artisans", handlers.getAll);
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
  router.get("/artisans/:id", handlers.getOne);
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
  router.put("/artisans/:id", handlers.update);
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
  router.delete("/artisans/:id", handlers.remove);

  return router;
};
