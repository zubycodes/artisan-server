const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");

/**
 * Session operations
 */
const sessionOps = {
  getAll() {
    return dbAsync.all(`
      SELECT * FROM sessions ORDER BY created_at DESC
    `);
  },

  getBySessionId(session_id) {
    return dbAsync.get(
      `
      SELECT * FROM sessions WHERE session_id = ?
    `,
      [session_id]
    );
  },

  create(session) {
    const { session_id, chat_title, description, start_time, end_time, user_ip, user_agent, status, tags, notes } = session;

    return dbAsync.run(
      `INSERT INTO sessions (session_id, chat_title, description, start_time, end_time, user_ip, user_agent, status, tags, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session_id, chat_title, description, start_time, end_time, user_ip, user_agent, status, tags, notes]
    );
  },

  update(session_id, session) {
    const { chat_title, description, start_time, end_time, user_ip, user_agent, status, tags, notes } = session;

    return dbAsync.run(
      `UPDATE sessions
       SET chat_title = ?,
           description = ?,
           start_time = ?,
           end_time = ?,
           user_ip = ?,
           user_agent = ?,
           status = ?,
           tags = ?,
           notes = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ?`,
      [chat_title, description, start_time, end_time, user_ip, user_agent, status, tags, notes, session_id]
    );
  },

  delete(session_id) {
    return dbAsync.run("DELETE FROM sessions WHERE session_id = ?", [session_id]);
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
        route: "sessions",
        handler: "getAll",
      });
      routeLogger.info("Received get all sessions request");
      try {
        const sessions = await sessionOps.getAll();
        res.json(sessions);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching sessions");
        res.status(500).json({ error: error.message });
      }
    }),

    getBySessionId: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "sessions",
        handler: "getBySessionId",
      });
      const session_id = req.params.session_id;
      routeLogger.info({ session_id }, "Received get session by session ID request");

      if (!session_id) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      try {
        const session = await sessionOps.getBySessionId(session_id);
        if (!session) {
          return res.status(404).json({ error: "Session not found" });
        }
        res.json(session);
      } catch (error) {
        routeLogger.error({ error, session_id }, "Error fetching session by session ID");
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "sessions",
        handler: "create",
      });
      routeLogger.info({ body: req.body }, "Received create session request");

      // Validate required fields
      if (!req.body.session_id) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      try {
        await sessionOps.create(req.body);
        res.status(201).json({
          status: "success",
          message: "Session created successfully",
        });
      } catch (error) {
        logger.error({ error }, "Error processing session creation");
        res.status(500).json({ error: error.message });
      }
    }),

    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "sessions",
        handler: "update",
      });
      const session_id = req.params.session_id;
      routeLogger.info({ session_id, body: req.body }, "Received update session request");

      if (!session_id) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      try {
        await sessionOps.update(session_id, req.body);
        res.json({
          status: "success",
          message: "Session updated successfully",
        });
      } catch (error) {
        logger.error({ error, session_id }, "Error processing session update");
        res.status(500).json({ error: error.message });
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "sessions",
        handler: "delete",
      });
      const session_id = req.params.session_id;
      routeLogger.info(
        { session_id },
        "Received delete session request"
      );

      if (!session_id) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      try {
        const { changes } = await sessionOps.delete(session_id);

        if (changes === 0) {
          logger.warn({ session_id }, "Session not found");
          return res.status(404).json({ error: "Session not found" });
        }

        res.json({
          status: "success",
          message: "Session deleted successfully",
        });
      } catch (error) {
        logger.error(
          { error, session_id },
          "Error deleting session"
        );
        res.status(500).json({ error: error.message });
      }
    }),
  };

  // Route definitions

  /**
   * @swagger
   * /sessions:
   *   get:
   *     summary: Get all sessions
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/sessions", handlers.getAll);

  /**
   * @swagger
   * /sessions/{session_id}:
   *   get:
   *     summary: Get session by session ID
   *     parameters:
   *       - in: path
   *         name: session_id
   *         required: true
   *         description: Session ID to filter sessions
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successful operation
   *       400:
   *         description: Session ID is required
   *       404:
   *         description: Session not found
   *       500:
   *         description: Internal server error
   */
  router.get("/sessions/:session_id", handlers.getBySessionId);

  /**
   * @swagger
   * /sessions:
   *   post:
   *     summary: Create a new session
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               session_id:
   *                 type: string
   *                 required: true
   *                 description: Session ID
   *               chat_title:
   *                 type: string
   *                 description: Chat title
   *               description:
   *                 type: string
   *                 description: Description
   *               start_time:
   *                 type: string
   *                 format: date-time
   *                 description: Start time
   *               end_time:
   *                 type: string
   *                 format: date-time
   *                 description: End time
   *               user_ip:
   *                 type: string
   *                 description: User IP address
   *               user_agent:
   *                 type: string
   *                 description: User agent
   *               status:
   *                 type: string
   *                 description: Status
   *               tags:
   *                 type: string
   *                 description: Tags
   *               notes:
   *                 type: string
   *                 description: Notes
   *     responses:
   *       201:
   *         description: Successfully created
   *       400:
   *         description: Missing required fields
   *       500:
   *         description: Internal server error
   */
  router.post("/sessions", handlers.create);

  /**
   * @swagger
   * /sessions/{session_id}:
   *   put:
   *     summary: Update an existing session
   *     parameters:
   *       - in: path
   *         name: session_id
   *         required: true
   *         description: Session ID to update
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               chat_title:
   *                 type: string
   *                 description: Chat title
   *               description:
   *                 type: string
   *                 description: Description
   *               start_time:
   *                 type: string
   *                 format: date-time
   *                 description: Start time
   *               end_time:
   *                 type: string
   *                 format: date-time
   *                 description: End time
   *               user_ip:
   *                 type: string
   *                 description: User IP address
   *               user_agent:
   *                 type: string
   *                 description: User agent
   *               status:
   *                 type: string
   *                 description: Status
   *               tags:
   *                 type: string
   *                 description: Tags
   *               notes:
   *                 type: string
   *                 description: Notes
   *     responses:
   *       200:
   *         description: Successfully updated
   *       400:
   *         description: Missing required fields
   *       500:
   *         description: Internal server error
   */
  router.put("/sessions/:session_id", handlers.update);

  /**
   * @swagger
   * /sessions/{session_id}:
   *   delete:
   *     summary: Delete a session (admin operation)
   *     parameters:
   *       - in: path
   *         name: session_id
   *         required: true
   *         description: Session ID of the session to delete
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Session deleted successfully
   *       400:
   *         description: Session ID is required
   *       404:
   *         description: Session not found
   */
  router.delete("/sessions/:session_id", handlers.delete);

  return router;
};