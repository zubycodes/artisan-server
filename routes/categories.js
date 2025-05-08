const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");

/**
 * Category entity operations
 */
const categoryOps = {
  getAll() {
    return dbAsync.all(`
          SELECT 
            c.*,
            COUNT(DISTINCT t.id) AS numberOfTechniques,
            COUNT(DISTINCT a.id) AS numberOfArtisans
          FROM categoriesView c
          LEFT JOIN techniquesView t ON t.category_Id = c.id and t.isActive = 1
          LEFT JOIN artisans a ON a.skill_id = t.id and a.isActive = 1
          WHERE c.isActive = 1
          GROUP BY c.id, c.name
          order by c.craft_name ASC
      `);
  },

  create(category) {
    const { name, craft_Id, isActive, color } = category;
    return dbAsync.run(
      "INSERT INTO categories (name, craft_Id, color, isActive) VALUES (?, ?, ?, ?)",
      [name, craft_Id, color, isActive]
    );
  },

  update(id, category) {
    const { name, craft_Id, color, isActive } = category;
    return dbAsync.run(
      "UPDATE categories SET name = ?, craft_Id = ?, color = ?, isActive = ? WHERE id = ?",
      [name, craft_Id, color, isActive, id]
    );
  },

  delete(id) {
    return dbAsync.run("UPDATE categories SET isActive = 0 WHERE id = ?", [id]);
  },
};

/**
 * Route handlers
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    getAll: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "categories",
        handler: "getAll",
      });
      routeLogger.info("Received get all categories request");
      try {
        const categories = await categoryOps.getAll();
        res.json(categories);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching categories");
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "categories",
        handler: "create",
      });
      routeLogger.info({ body: req.body }, "Received create category request");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { lastID } = await categoryOps.create(req.body);
        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: lastID,
            message: "Category created successfully",
          })}\n\n`
        );
        res.status(201).end();
      } catch (error) {
        logger.error({ error }, "Error creating category");
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            error: error.message,
          })}\n\n`
        );
        res.status(500).end();
      }
    }),

    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "categories",
        handler: "update",
      });
      routeLogger.info(
        { id: req.params.id, body: req.body },
        "Received update category request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { changes } = await categoryOps.update(req.params.id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Category not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Category not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: parseInt(req.params.id),
            message: "Category updated successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error updating category");
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            error: error.message,
          })}\n\n`
        );
        res.status(500).end();
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "categories",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete category request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { changes } = await categoryOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Category not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Category not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            message: "Category deleted successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error deleting category");
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            error: error.message,
          })}\n\n`
        );
        res.status(500).end();
      }
    }),
  };

  // Route definitions with REST compliant responses
  /**
   * @swagger
   * /categories:
   *   get:
   *     summary: Get all categories
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/categories", handlers.getAll);
  /**
   * @swagger
   * /categories:
   *   post:
   *     summary: Create a new category
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               craft_Id:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Category created successfully
   */
  router.post("/categories", handlers.create);
  /**
   * @swagger
   * /categories/{id}:
   *   put:
   *     summary: Update an existing category
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the category to update
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
   *               craft_Id:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Category updated successfully
   *       404:
   *         description: Category not found
   */
  router.put("/categories/:id", handlers.update);
  /**
   * @swagger
   * /categories/{id}:
   *   delete:
   *     summary: Delete a category
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the category to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Category deleted successfully
   *       404:
   *         description: Category not found
   */
  router.delete("/categories/:id", handlers.delete);

  return router;
};
