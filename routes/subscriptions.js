const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");
const nodemailer = require("nodemailer");

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
          const firstName = req.body.first_name || "there";
          const userEmail = req.body.email_address; // Use this for the 'to' field

          // --- Email Content ---
          await transporter.sendMail({
            from: '"Tiercel Education Consultant" <dev@tierceledconsulting.com>', // Keep your verified sender
            to: userEmail,
            subject: "🎉 Welcome! Your Study Abroad Checklist is Inside!", // More engaging subject
            // Preheader text (shows in inbox preview)
            text: `Hi ${firstName}, thanks for joining Tiercel Education! Your essential Study Abroad Checklist and first steps are here.`,
            html: `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <meta http-equiv="X-UA-Compatible" content="ie=edge">
              <title>Welcome to Tiercel Education!</title>
              <style>
                  /* Basic Reset */
                  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
                  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
                  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
                  table { border-collapse: collapse !important; }
                  body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f4f4f4; }
          
                  /* Main Styles */
                  .container {
                      max-width: 600px;
                      margin: 0 auto;
                      background-color: #ffffff;
                      border-radius: 8px;
                      overflow: hidden; /* Ensures border-radius clips content */
                      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                  }
                  .content {
                      padding: 30px 40px;
                      font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
                      font-size: 16px;
                      line-height: 1.6;
                      color: #333333;
                  }
                  .header {
                      padding: 20px 40px;
                      background-color: #ffffff; /* Or a subtle brand color */
                      text-align: center; /* Center logo */
                  }
                  .logo {
                      max-width: 180px; /* Adjust as needed */
                      height: auto;
                  }
                  .hero-image img {
                      width: 100%;
                      max-width: 600px;
                      height: auto;
                      display: block;
                  }
                  h1 {
                      font-size: 28px;
                      font-weight: bold;
                      color: #0047AB; /* Brand primary color */
                      margin-top: 20px;
                      margin-bottom: 15px;
                      line-height: 1.3;
                  }
                   h2 {
                      font-size: 22px;
                      font-weight: bold;
                      color: #00337C; /* Slightly darker shade */
                      margin-top: 30px;
                      margin-bottom: 10px;
                  }
                  p {
                      margin-bottom: 15px;
                  }
                  ul {
                      list-style: none;
                      padding: 0;
                      margin: 20px 0;
                  }
                  li {
                      margin-bottom: 15px;
                      padding-left: 30px; /* Space for icon */
                      position: relative; /* For icon positioning */
                      line-height: 1.5;
                  }
                  li::before { /* Using pseudo-elements for icons - better than images for simple shapes */
                      content: '✓'; /* Checkmark icon */
                      position: absolute;
                      left: 0;
                      top: 0;
                      color: #0047AB; /* Brand color */
                      font-weight: bold;
                      font-size: 18px;
                  }
                  .cta-button {
                      display: inline-block;
                      background-color: #0047AB; /* Brand primary color */
                      color: #ffffff !important; /* Ensure text is white */
                      padding: 15px 30px;
                      text-align: center;
                      text-decoration: none;
                      font-size: 18px;
                      font-weight: bold;
                      border-radius: 5px;
                      margin: 25px 0;
                      transition: background-color 0.3s ease;
                  }
                  .cta-button:hover {
                      background-color: #00337C; /* Darker shade on hover */
                  }
                  .footer {
                      padding: 20px 40px;
                      background-color: #eeeeee;
                      text-align: center;
                      font-size: 12px;
                      color: #777777;
                      border-top: 1px solid #dddddd;
                  }
                  .footer a {
                      color: #0047AB; /* Brand color */
                      text-decoration: none;
                  }
                  .footer a:hover {
                      text-decoration: underline;
                  }
                  .social-icons img {
                       width: 24px; /* Adjust icon size */
                       margin: 0 5px;
                  }
          
                  /* Mobile Specific Styles */
                  @media screen and (max-width: 600px) {
                      .container {
                          width: 100% !important;
                          border-radius: 0 !important;
                           box-shadow: none;
                      }
                      .content {
                          padding: 20px !important;
                      }
                       .header {
                          padding: 15px 20px !important;
                      }
                      h1 {
                          font-size: 24px !important;
                      }
                       h2 {
                          font-size: 20px !important;
                      }
                      .cta-button {
                           padding: 12px 25px !important;
                           font-size: 16px !important;
                      }
                       .footer {
                          padding: 15px 20px !important;
                      }
                  }
              </style>
          </head>
          <body style="margin: 0; padding: 0; background-color: #f4f4f4;">
              <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f4f4f4;">
                  Hi ${firstName}, thanks for joining Tiercel Education! Your essential Study Abroad Checklist and first steps are here.
              </div>
          
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                      <td align="center" style="background-color: #f4f4f4; padding: 20px 0;">
                          <div class="container">
                              <div class="header">
                                  <img src="https://your-domain.com/path/to/tiercel-logo.png" alt="Tiercel Education Consultant Logo" class="logo">
                                  </div>
          
                              <div class="hero-image">
                                   <img src="https://your-domain.com/path/to/study-abroad-hero.jpg" alt="Students studying abroad happily" style="width: 100%; max-width: 600px; height: auto; display: block;">
                                   </div>
          
                              <div class="content">
                                  <h1>Welcome Aboard, ${firstName}!</h1>
                                  <p>We're absolutely thrilled to have you join the Tiercel Education community! Your journey towards studying abroad just got a whole lot easier.</p>
                                  <p>As promised, your exclusive <strong>Study Abroad Checklist</strong> is ready for you. Grab it now to start planning your adventure:</p>
          
                                  <table border="0" cellspacing="0" cellpadding="0" style="margin: 25px 0;">
                                      <tr>
                                          <td align="center">
                                              <a href="#" target="_blank" class="cta-button" style="display: inline-block; background-color: #0047AB; color: #ffffff; padding: 15px 30px; text-align: center; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 5px; mso-hide:all;">Download Your Checklist</a>
                                               </td>
                                      </tr>
                                  </table>
                                  <p style="font-size: 14px; color: #555555; text-align: center;">(Your checklist is also attached to this email for easy access!)</p>
          
          
                                  <h2>Getting Started: Your Next Steps</h2>
                                  <ul>
                                      <li><strong>Save Your Checklist:</strong> Download the PDF and keep it handy throughout your planning process.</li>
                                      <li><strong>Watch Your Inbox:</strong> We'll share valuable tips, insights, and updates weekly to guide you.</li>
                                      <li><strong>Join the Conversation:</strong> Connect with fellow students and ask questions in our <a href="[Link to Your Forum]" target="_blank" style="color: #0047AB; text-decoration: none; font-weight: bold;">Community Forum</a>.</li>
                                     <li><strong>Explore Our Resources:</strong> Visit our <a href="[Link to Your Website]" target="_blank" style="color: #0047AB; text-decoration: none; font-weight: bold;">website</a> for more guides and services.</li>
                                  </ul>
          
                                  <p>Got questions already? Don't hesitate to hit reply – we're here to help!</p>
          
                                  <p>Best regards,<br><strong>The Tiercel Education Team</strong></p>
                              </div>
          
                              <div class="footer">
                                  <p>
                                      <a href="[Link to Facebook]" target="_blank" class="social-icons"><img src="https://your-domain.com/path/to/facebook-icon.png" alt="Facebook"></a>
                                     <a href="[Link to Instagram]" target="_blank" class="social-icons"><img src="https://your-domain.com/path/to/instagram-icon.png" alt="Instagram"></a>
                                     <a href="[Link to LinkedIn]" target="_blank" class="social-icons"><img src="https://your-domain.com/path/to/linkedin-icon.png" alt="LinkedIn"></a>
                                     </p>
                                  <p>Tiercel Education Consultant<br>
                                     [Your Company Address, if applicable]</p>
                                  <p>You received this email because you subscribed to our newsletter via our website.</p>
                                  <p><a href="[Unsubscribe Link Placeholder]" target="_blank">Unsubscribe</a> | <a href="[Privacy Policy Link]" target="_blank">Privacy Policy</a></p>
                                  <p>&copy; ${new Date().getFullYear()} Tiercel Education Consultant. All rights reserved.</p>
                              </div>
                          </div>
                          </td>
                  </tr>
              </table>
          </body>
          </html>
              `,
            // --- Attachment Section ---
            // UNCOMMENT and configure this section if you want to attach the PDF
            /*
              attachments: [
                {
                  filename: "Tiercel-Study-Abroad-Checklist.pdf", // Use a branded filename
                  // IMPORTANT: Use an absolute path or ensure relative path is correct from where your script runs
                  path: "/absolute/path/to/your/checklist.pdf", // Example: use path.join(__dirname, 'assets', 'checklist.pdf') in Node.js
                  contentType: 'application/pdf'
                },
              ],
              */
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
