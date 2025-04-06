const express = require("express");
const { db } = require("../db");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route");

/**
 * GeoLevel entity operations
 */
const geoLevelOps = {
  getAll(code_length) {
    if (code_length) {
      return dbAsync.all(
        "SELECT * FROM geo_level WHERE LEN(code) = ? order by name",
        [code_length]
      );
    } else {
      return dbAsync.all("SELECT * FROM geo_level order by name");
    }
  },

  create({ code, name }) {
    return dbAsync.run("INSERT INTO geo_level (code, name) VALUES (?, ?)", [
      code,
      name,
    ]);
  },

  update(id, { code, name }) {
    return dbAsync.run("UPDATE geo_level SET code = ?, name = ? WHERE id = ?", [
      code,
      name,
      id,
    ]);
  },

  delete(id) {
    return dbAsync.run("DELETE FROM geo_level WHERE id = ?", [id]);
  },
};

/**
 * Route handlers with improved response formats
 */
module.exports = (dependencies) => {
  const { logger } = dependencies;
  const handlers = {
    // Get all geo levels
    getAll: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "geo_level",
        handler: "getAll",
      });
      routeLogger.info("Received get all geo levels request");
      try {
        const code_length = req.query.code_length;
        const geoLevels = await geoLevelOps.getAll(code_length);
        res.json(geoLevels);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching geo levels");
        res.status(500).json({ error: error.message });
      }
    }),

    // Create a new geo level
    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "geo_level",
        handler: "create",
      });
      routeLogger.info({ body: req.body }, "Received create geo level request");
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { lastID } = await geoLevelOps.create(req.body);
        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: lastID,
            message: "Geo level created successfully",
          })}\n\n`
        );
        res.status(201).end();
      } catch (error) {
        logger.error({ error }, "Error creating geo level");
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            error: error.message,
          })}\n\n`
        );
        res.status(500).end();
      }
    }),

    // Update an existing geo level
    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "geo_level",
        handler: "update",
      });
      routeLogger.info(
        { id: req.params.id, body: req.body },
        "Received update geo level request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { id } = req.params;
        const { changes } = await geoLevelOps.update(id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Geo level not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Geo level not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            id: parseInt(id),
            message: "Geo level updated successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error updating geo level");
        res.write(
          `data: ${JSON.stringify({
            status: "error",
            error: error.message,
          })}\n\n`
        );
        res.status(500).end();
      }
    }),

    // Delete a geo level
    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "geo_level",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete geo level request"
      );
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const { id } = req.params;
        const { changes } = await geoLevelOps.delete(id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Geo level not found");
          res.write(
            `data: ${JSON.stringify({
              status: "error",
              message: "Geo level not found",
            })}\n\n`
          );
          return res.status(404).end();
        }

        res.write(
          `data: ${JSON.stringify({
            status: "complete",
            message: "Geo level deleted successfully",
          })}\n\n`
        );
        res.status(200).end();
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error deleting geo level");
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

  // REST API routes
  /**
   * @swagger
   * /geo_level:
   *   get:
   *     summary: Get all geo levels
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/geo_level", handlers.getAll);
  /**
   * @swagger
   * /geo_level:
   *   post:
   *     summary: Create a new geo level
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *               name:
   *                 type: string
   *     responses:
   *       201:
   *         description: Geo level created successfully
   */
  router.post("/geo_level", handlers.create);
  /**
   * @swagger
   * /geo_level/{id}:
   *   put:
   *     summary: Update an existing geo level
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the geo level to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *               name:
   *                 type: string
   *     responses:
   *       200:
   *         description: Geo level updated successfully
   *       404:
   *         description: Geo level not found
   */
  router.put("/geo_level/:id", handlers.update);
  /**
   * @swagger
   * /geo_level/{id}:
   *   delete:
   *     summary: Delete a geo level
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the geo level to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Geo level deleted successfully
   *       404:
   *         description: Geo level not found
   */
  router.delete("/geo_level/:id", handlers.delete);

  return router;
};
