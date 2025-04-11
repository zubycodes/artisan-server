const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");
import nodemailer from "nodemailer";

/**
 * Email subscription operations
 */
const subscriptionOps = {
  getAll() {
    return dbAsync.all(`
      SELECT * FROM email_subscriptions ORDER BY subscription_date DESC
    `);
  },

  getActive() {
    return dbAsync.all(`
      SELECT * FROM email_subscriptions WHERE is_active = 1 ORDER BY subscription_date DESC
    `);
  },

  getByEmail(email) {
    return dbAsync.get(
      `
      SELECT * FROM email_subscriptions WHERE email_address = ?
    `,
      [email]
    );
  },

  create(subscription) {
    const { email_address } = subscription;

    return dbAsync.run(
      `INSERT INTO email_subscriptions (email_address) VALUES (?)`,
      [email_address]
    );
  },

  update(id, subscription) {
    const { email_address, is_active } = subscription;

    return dbAsync.run(
      `UPDATE email_subscriptions 
       SET email_address = ?,
           is_active = ?,
           last_updated = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [email_address, is_active, id]
    );
  },

  updateStatus(email, status) {
    return dbAsync.run(
      `UPDATE email_subscriptions
       SET is_active = ?,
           last_updated = CURRENT_TIMESTAMP
       WHERE email_address = ?`,
      [status ? 1 : 0, email]
    );
  },

  delete(id) {
    return dbAsync.run("DELETE FROM email_subscriptions WHERE id = ?", [id]);
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
        route: "subscriptions",
        handler: "getAll",
      });
      routeLogger.info("Received get all subscriptions request");
      try {
        const subscriptions = await subscriptionOps.getAll();
        res.json(subscriptions);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching subscriptions");
        res.status(500).json({ error: error.message });
      }
    }),

    getActive: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "subscriptions",
        handler: "getActive",
      });
      routeLogger.info("Received get active subscriptions request");
      try {
        const subscriptions = await subscriptionOps.getActive();
        res.json(subscriptions);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching active subscriptions");
        res.status(500).json({ error: error.message });
      }
    }),

    subscribe: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "subscriptions",
        handler: "subscribe",
      });
      routeLogger.info(
        { email: req.body.email_address },
        "Received subscription request"
      );

      // Validate email
      if (!req.body.email_address) {
        return res.status(400).json({ error: "Email address is required" });
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(req.body.email_address)) {
        return res.status(400).json({ error: "Invalid email address format" });
      }

      try {
        // Check if email already exists
        const existingSubscription = await subscriptionOps.getByEmail(
          req.body.email_address
        );

        if (existingSubscription) {
          // If already exists but not active, reactivate it
          if (!existingSubscription.is_active) {
            await subscriptionOps.updateStatus(req.body.email_address, true);
            return res.json({
              status: "success",
              message: "Your subscription has been reactivated",
            });
          }
          // Already subscribed and active
          return res.status(409).json({
            status: "info",
            message: "This email is already subscribed",
          });
        }

        // Create new subscription
        const { lastID } = await subscriptionOps.create(req.body);
        // Configure your SMTP transport
        const transporter = nodemailer.createTransport({
          host: "smtp.hostinger.com",
          port: 465, // Typically 587 for TLS
          secure: true, // true for 465, false for other ports
          auth: {
            user: "dev@tierceledconsulting.com",
            pass: "justNumbers@1123", // Use environment variables in production
          },
        });
        try {
          // Send the email
          await transporter.sendMail({
            from: '"Your Company" <noreply@tierceledconsulting.com>',
            to: req.body.email_address,
            subject: subject || "Thank You for Subscribing!",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0047AB;">Thank You for Subscribing!</h2>
                <p>We're thrilled that you've joined our community! Your Study Abroad Checklist is attached to this email.</p>
                <p>Here are some quick tips to get you started:</p>
                <ul>
                  <li>Download and save your checklist</li>
                  <li>Check your inbox weekly for our latest tips</li>
                  <li>Join our community forum for peer support</li>
                </ul>
                <p>If you have any questions, feel free to reply to this email.</p>
                <p>Best regards,<br>The Study Abroad Team</p>
              </div>
            `,
            // You could also attach the checklist PDF here
            attachments: [
              {
                filename: "Study-Abroad-Checklist.pdf",
                path: "./path/to/your/checklist.pdf",
              },
            ],
          });
        } catch (error) {
          console.error("Error sending thank you email:", error);
          res.status(500).json({ error: error.message });
        }

        res.status(201).json({
          status: "success",
          message: "You have been successfully subscribed to email alerts",
          id: lastID,
        });
      } catch (error) {
        logger.error({ error }, "Error processing subscription");
        res.status(500).json({ error: error.message });
      }
    }),

    unsubscribe: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "subscriptions",
        handler: "unsubscribe",
      });
      const email = req.params.email || req.query.email;

      routeLogger.info({ email }, "Received unsubscribe request");

      if (!email) {
        return res.status(400).json({ error: "Email address is required" });
      }

      try {
        const existingSubscription = await subscriptionOps.getByEmail(email);

        if (!existingSubscription) {
          return res.status(404).json({
            status: "info",
            message: "No subscription found for this email address",
          });
        }

        // Deactivate subscription
        await subscriptionOps.updateStatus(email, false);

        res.json({
          status: "success",
          message: "You have been successfully unsubscribed from email alerts",
        });
      } catch (error) {
        logger.error({ error }, "Error processing unsubscribe request");
        res.status(500).json({ error: error.message });
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "subscriptions",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete subscription request"
      );

      try {
        const { changes } = await subscriptionOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Subscription not found");
          return res.status(404).json({ error: "Subscription not found" });
        }

        res.json({
          status: "success",
          message: "Subscription deleted successfully",
        });
      } catch (error) {
        logger.error(
          { error, id: req.params.id },
          "Error deleting subscription"
        );
        res.status(500).json({ error: error.message });
      }
    }),
  };

  // Route definitions

  /**
   * @swagger
   * /subscriptions:
   *   get:
   *     summary: Get all email subscriptions
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/subscriptions", handlers.getAll);

  /**
   * @swagger
   * /subscriptions/active:
   *   get:
   *     summary: Get active email subscriptions
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/subscriptions/active", handlers.getActive);

  /**
   * @swagger
   * /subscriptions:
   *   post:
   *     summary: Subscribe to email alerts
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email_address:
   *                 type: string
   *                 format: email
   *     responses:
   *       201:
   *         description: Successfully subscribed
   *       400:
   *         description: Invalid email or missing required fields
   *       409:
   *         description: Email already subscribed
   */
  router.post("/subscriptions", handlers.subscribe);

  /**
   * @swagger
   * /subscriptions/unsubscribe/{email}:
   *   get:
   *     summary: Unsubscribe from email alerts
   *     parameters:
   *       - in: path
   *         name: email
   *         required: true
   *         description: Email address to unsubscribe
   *         schema:
   *           type: string
   *           format: email
   *     responses:
   *       200:
   *         description: Successfully unsubscribed
   *       404:
   *         description: Subscription not found
   */
  router.get("/subscriptions/unsubscribe/:email", handlers.unsubscribe);

  /**
   * @swagger
   * /subscriptions/unsubscribe:
   *   get:
   *     summary: Unsubscribe from email alerts (query parameter version)
   *     parameters:
   *       - in: query
   *         name: email
   *         required: true
   *         description: Email address to unsubscribe
   *         schema:
   *           type: string
   *           format: email
   *     responses:
   *       200:
   *         description: Successfully unsubscribed
   *       404:
   *         description: Subscription not found
   */
  router.get("/subscriptions/unsubscribe", handlers.unsubscribe);

  /**
   * @swagger
   * /subscriptions/{id}:
   *   delete:
   *     summary: Delete a subscription (admin operation)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the subscription to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Subscription deleted successfully
   *       404:
   *         description: Subscription not found
   */
  router.delete("/subscriptions/:id", handlers.delete);

  return router;
};
