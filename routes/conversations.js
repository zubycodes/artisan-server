const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");

/**
 * Conversation operations
 */
const conversationOps = {
  getAll() {
    return dbAsync.all(`
      SELECT * FROM chatbot_conversations ORDER BY timestamp
    `);
  },

  getBySessionId(session_id) {
    return dbAsync.all(
      `
      SELECT * FROM chatbot_conversations WHERE session_id = ? ORDER BY timestamp
    `,
      [session_id]
    );
  },

  create(conversation) {
    const { user_id, message_text, is_bot, session_id } = conversation;

    return dbAsync.run(
      `INSERT INTO chatbot_conversations (user_id, message_text, is_bot, session_id) VALUES (?, ?, ?, ?)`,
      [user_id, message_text, is_bot, session_id]
    );
  },

  update(id, conversation) {
    const { user_id, message_text, is_bot, session_id } = conversation;

    return dbAsync.run(
      `UPDATE chatbot_conversations
       SET user_id = ?,
           message_text = ?,
           is_bot = ?,
           session_id = ?,
           timestamp = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [user_id, message_text, is_bot, session_id, id]
    );
  },

  delete(id) {
    return dbAsync.run("DELETE FROM chatbot_conversations WHERE id = ?", [id]);
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
        route: "conversations",
        handler: "getAll",
      });
      routeLogger.info("Received get all conversations request");
      try {
        const conversations = await conversationOps.getAll();
        res.json(conversations);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching conversations");
        res.status(500).json({ error: error.message });
      }
    }),

    getBySessionId: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "conversations",
        handler: "getBySessionId",
      });
      const session_id = req.params.session_id || req.query.session_id;
      routeLogger.info(
        { session_id },
        "Received get conversations by session ID request"
      );

      if (!session_id) {
        return res.status(400).json({ error: "Session ID is required" });
      }

      try {
        const conversations = await conversationOps.getBySessionId(session_id);
        res.json(conversations);
      } catch (error) {
        routeLogger.error(
          { error, session_id },
          "Error fetching conversations by session ID"
        );
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "conversations",
        handler: "create",
      });
      routeLogger.info(
        { body: req.body },
        "Received create conversation request"
      );

      // Validate required fields
      if (!req.body.message_text) {
        return res.status(400).json({ error: "Message text is required" });
      }

      try {
        const { lastID } = await conversationOps.create(req.body);
        res.status(201).json({
          status: "success",
          message: "Conversation created successfully",
          id: lastID,
        });
      } catch (error) {
        logger.error({ error }, "Error processing conversation creation");
        res.status(500).json({ error: error.message });
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "conversations",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete conversation request"
      );

      try {
        const { changes } = await conversationOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Conversation not found");
          return res.status(404).json({ error: "Conversation not found" });
        }

        res.json({
          status: "success",
          message: "Conversation deleted successfully",
        });
      } catch (error) {
        logger.error(
          { error, id: req.params.id },
          "Error deleting conversation"
        );
        res.status(500).json({ error: error.message });
      }
    }),
  };

  // Route definitions

  /**
   * @swagger
   * /conversations:
   *   get:
   *     summary: Get all conversations
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/conversations", handlers.getAll);

  /**
   * @swagger
   * /conversations/{session_id}:
   *   get:
   *     summary: Get conversations by session ID
   *     parameters:
   *       - in: path
   *         name: session_id
   *         required: true
   *         description: Session ID to filter conversations
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Successful operation
   *       400:
   *         description: Session ID is required
   *       500:
   *         description: Internal server error
   */
  router.get("/conversations/:session_id", handlers.getBySessionId);

  /**
   * @swagger
   * /conversations:
   *   post:
   *     summary: Create a new conversation message
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               user_id:
   *                 type: string
   *                 description: User ID (optional)
   *               message_text:
   *                 type: string
   *                 required: true
   *                 description: Message content
   *               is_bot:
   *                 type: boolean
   *                 description: True if message is from bot, False if from user
   *               session_id:
   *                 type: string
   *                 description: Session ID to group messages (optional)
   *     responses:
   *       201:
   *         description: Successfully created
   *       400:
   *         description: Missing required fields
   *       500:
   *         description: Internal server error
   */
  router.post("/conversations", handlers.create);

  /**
   * @swagger
   * /conversations/{id}:
   *   delete:
   *     summary: Delete a conversation (admin operation)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the conversation to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Conversation deleted successfully
   *       404:
   *         description: Conversation not found
   */
  router.delete("/conversations/:id", handlers.delete);

  return router;
};
