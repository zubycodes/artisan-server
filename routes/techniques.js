const express = require("express");
const router = express.Router();
const { db } = require("../db");
const { dbAsync, createHandler } = require("./base_route.js");
/**
 * Technique entity operations
 */
const techniqueOps = {
  getAll() {
    return dbAsync.all(`
        SELECT 
         c.*,
         COUNT(DISTINCT a.id) AS numberOfArtisans
        FROM techniquesView c
        LEFT JOIN artisans a ON a.skill_id = c.id
        WHERE c.isActive = 1
        GROUP BY c.id, c.name
        order by c.craft_name ASC, c.category_name ASC
      `);
  },

  create(technique) {
    const { name, category_Id, isActive, color } = technique;
    return dbAsync.run(
      "INSERT INTO techniques (name, category_Id, color, isActive) VALUES (?, ?, ?, ?)",
      [name, category_Id, color, isActive]
    );
  },

  update(id, technique) {
    const { name, category_Id, color, isActive } = technique;
    return dbAsync.run(
      "UPDATE techniques SET name = ?, category_Id = ?, color = ?, isActive = ? WHERE id = ?",
      [name, category_Id, color, isActive, id]
    );
  },

  delete(id) {
    return dbAsync.run("UPDATE techniques SET isActive = 0 WHERE id = ?", [id]);
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
        route: "techniques",
        handler: "getAll",
      });
      routeLogger.info("Received get all techniques request");
      try {
        const techniques = await techniqueOps.getAll();
        res.json(techniques);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching techniques");
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "techniques",
        handler: "create",
      });
      routeLogger.info({ body: req.body }, "Received create technique request");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { lastID } = await techniqueOps.create(req.body);
        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: lastID,
            message: "Technique created successfully",
          })}\n\n`
        );
        res.status(201).end();
      } catch (error) {
        logger.error({ error }, "Error creating technique");
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
        route: "techniques",
        handler: "update",
      });
      routeLogger.info(
        { id: req.params.id, body: req.body },
        "Received update technique request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { changes } = await techniqueOps.update(req.params.id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Technique not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Technique not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: parseInt(req.params.id),
            message: "Technique updated successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error updating technique");
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
        route: "techniques",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete technique request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { changes } = await techniqueOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Technique not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Technique not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            message: "Technique deleted successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error deleting technique");
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
   * /techniques:
   *   get:
   *     summary: Get all techniques
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/techniques", handlers.getAll);
  /**
   * @swagger
   * /techniques:
   *   post:
   *     summary: Create a new technique
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               category_Id:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       201:
   *         description: Technique created successfully
   */
  router.post("/techniques", handlers.create);
  /**
   * @swagger
   * /techniques/{id}:
   *   put:
   *     summary: Update an existing technique
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the technique to update
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
   *               category_Id:
   *                 type: integer
   *               isActive:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Technique updated successfully
   *       404:
   *         description: Technique not found
   */
  router.put("/techniques/:id", handlers.update);
  /**
   * @swagger
   * /techniques/{id}:
   *   delete:
   *     summary: Delete a technique
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the technique to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Technique deleted successfully
   *       404:
   *         description: Technique not found
   */
  router.delete("/techniques/:id", handlers.delete);

  return router;
};
