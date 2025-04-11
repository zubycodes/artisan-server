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
  <title>Thank You for Subscribing</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      background-color: #f9f9f9;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 20px rgba(10, 35, 66, 0.15);
    }
    .header {
      background: linear-gradient(135deg, #e04448, #c02e32);
      padding: 40px 0;
      text-align: center;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .header:before {
      content: '';
      position: absolute;
      top: -50px;
      right: -50px;
      width: 150px;
      height: 150px;
      background-color: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
    }
    .header:after {
      content: '';
      position: absolute;
      bottom: -70px;
      left: -70px;
      width: 200px;
      height: 200px;
      background-color: rgba(10, 35, 66, 0.2);
      border-radius: 50%;
    }
    .header h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 2;
    }
    .header p {
      margin: 12px 0 0;
      font-size: 18px;
      opacity: 0.95;
      font-weight: 500;
      position: relative;
      z-index: 2;
    }
    .logo {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
      position: relative;
      z-index: 2;
    }
    .logo img {
      border-radius: 50%;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-message {
      margin-bottom: 30px;
      line-height: 1.7;
      font-size: 16px;
    }
    .checklist-container {
      background-color: #f5f8ff;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border-left: 5px solid #0a2342;
      box-shadow: 0 6px 12px rgba(10, 35, 66, 0.08);
      position: relative;
      overflow: hidden;
    }
    .checklist-container:after {
      content: '✈️';
      position: absolute;
      right: 20px;
      top: 20px;
      font-size: 24px;
      opacity: 0.2;
    }
    .checklist-container h3 {
      margin-top: 0;
      color: #0a2342;
      font-size: 20px;
      font-weight: 700;
    }
    .checklist {
      padding-left: 0;
      list-style-type: none;
    }
    .checklist li {
      position: relative;
      padding-left: 38px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .checklist li:before {
      content: '';
      position: absolute;
      left: 0;
      top: 2px;
      width: 24px;
      height: 24px;
      background-color: rgba(224, 68, 72, 0.15);
      border-radius: 50%;
    }
    .checklist li:after {
      content: '✓';
      position: absolute;
      left: 6px;
      top: 1px;
      color: #e04448;
      font-weight: bold;
    }
    .ii a[href] {
    color: white;
    }
    .download-button {
      display: block;
      background-color: #e04448;
      color: white !important;
      text-align: center;
      padding: 18px 20px;
      border-radius: 50px;
      text-decoration: none;
      font-weight: 700;
      margin: 35px 0;
      transition: all 0.3s;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-size: 16px;
      box-shadow: 0 6px 12px rgba(224, 68, 72, 0.3);
      position: relative;
      overflow: hidden;
    }
    .download-button:before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: all 0.6s;
    }
    .download-button:hover {
      background-color: #c02e32;
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(224, 68, 72, 0.4);
    }
    .download-button:hover:before {
      left: 100%;
    }
    .social-proof {
      background-color: #fff;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      margin-bottom: 30px;
      box-shadow: 0 6px 12px rgba(10, 35, 66, 0.08);
      border: 2px solid #f0f4f9;
      position: relative;
    }
    .social-proof:before {
      content: '"';
      position: absolute;
      top: 10px;
      left: 15px;
      font-size: 60px;
      color: #e04448;
      opacity: 0.2;
      font-family: Georgia, serif;
      line-height: 0.8;
    }
    .social-proof p {
      font-style: italic;
      margin: 0;
      color: #555;
      font-size: 16px;
      line-height: 1.6;
    }
    .social-proof strong {
      display: block;
      margin-top: 12px;
      color: #0a2342;
      font-weight: 700;
    }
    .social-proof img {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      margin-bottom: 15px;
      border: 3px solid #f0f4f9;
    }
    .next-steps {
      margin-bottom: 30px;
    }
    .next-steps h3 {
      color: #0a2342;
      font-size: 20px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 25px;
    }
    .next-steps-list {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding: 0;
      list-style-type: none;
    }
    .next-steps-list li {
      flex: 1 1 180px;
      background-color: white;
      border: 1px solid #e1e8f5;
      border-radius: 16px;
      padding: 25px 15px;
      text-align: center;
      transition: all 0.3s;
      position: relative;
      overflow: hidden;
      box-shadow: 0 5px 15px rgba(10, 35, 66, 0.05);
    }
    .next-steps-list li:hover {
      transform: translateY(-5px);
      box-shadow: 0 8px 25px rgba(10, 35, 66, 0.1);
      border-color: rgba(224, 68, 72, 0.3);
    }
    .next-steps-list li:before {
      content: '';
      position: absolute;
      height: 5px;
      left: 0;
      right: 0;
      top: 0;
      background: linear-gradient(90deg, #e04448, #c02e32);
      opacity: 0;
      transition: all 0.3s;
    }
    .next-steps-list li:hover:before {
      opacity: 1;
    }
    .step-icon {
      display: block;
      font-size: 32px;
      margin-bottom: 15px;
      color: #e04448;
    }
    .step-title {
      display: block;
      font-weight: 700;
      margin-bottom: 8px;
      color: #0a2342;
      font-size: 18px;
    }
    .footer {
      background-color: #0a2342;
      padding: 35px 25px;
      text-align: center;
      color: white;
      position: relative;
      overflow: hidden;
    }
    .footer:before {
      content: '';
      position: absolute;
      top: -100px;
      right: -100px;
      width: 200px;
      height: 200px;
      background-color: rgba(224, 68, 72, 0.1);
      border-radius: 50%;
    }
    .social-links {
      margin-bottom: 25px;
    }
    .social-links a {
      display: inline-block;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: rgba(255, 255, 255, 0.1);
      color: white;
      text-align: center;
      line-height: 40px;
      margin: 0 8px;
      font-size: 18px;
      transition: all 0.3s;
      text-decoration: none;
    }
    .social-links a:hover {
      background-color: #e04448;
      transform: translateY(-3px);
    }
    .contact {
      color: rgba(255, 255, 255, 0.7);
      font-size: 14px;
      position: relative;
      z-index: 2;
    }
    .contact a {
      color: white;
      text-decoration: none;
      border-bottom: 1px dotted rgba(255, 255, 255, 0.5);
      transition: all 0.3s;
    }
    .contact a:hover {
      border-color: #e04448;
      color: #e04448;
    }
    .divider {
      height: 8px;
      background: linear-gradient(90deg, #0a2342, #e04448, #0a2342);
      margin: 0;
      padding: 0;
      border: none;
    }
    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      .content {
        padding: 30px 20px;
      }
      .next-steps-list {
        flex-direction: column;
      }
      .next-steps-list li {
        flex: 1 1 auto;
      }
      .header h1 {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="https://tierceledconsulting.com/wp-content/uploads/img/logo-tiercel.jpg" alt="Study Abroad Logo">
      </div>
      <h1>THANK YOU FOR JOINING US!</h1>
      <p>Your global adventure begins now</p>
    </div>
    
    <hr class="divider">
    
    <div class="content">
      <div class="welcome-message">
        <p><strong>Hi there, future global citizen!</strong></p>
        <p>We're absolutely <em>thrilled</em> that you've joined our worldwide community of adventurous learners! Your comprehensive Study Abroad Checklist is now ready for you to download and kickstart your life-changing international education journey.</p>
      </div>
      
      <a href="https://tierceledconsulting.com/wp-content/uploads/img/guide.pdf" class="download-button">Get Your Checklist Now!</a>
      
      <div class="checklist-container">
        <h3>🌍 Your Ultimate Checklist Includes:</h3>
        <ul class="checklist">
          <li><strong>Essential Documents Guide</strong> - Passport, visa, and application requirements</li>
          <li><strong>Housing Navigator</strong> - Finding the perfect place to call home abroad</li>
          <li><strong>Financial Planner</strong> - Budgeting tools and scholarship opportunities</li>
          <li><strong>Cultural Immersion Kit</strong> - Language resources and local customs guide</li>
          <li><strong>Health & Safety Handbook</strong> - Insurance tips and emergency contacts</li>
        </ul>
      </div>
      
      <div class="next-steps">
        <h3>Your Next Steps to Success:</h3>
        <ul class="next-steps-list">
          <li>
            <span class="step-icon">📥</span>
            <span class="step-title">Save Your Checklist</span>
            Download and keep it handy throughout your journey - we recommend printing it too!
          </li>
          <li>
            <span class="step-icon">🔔</span>
            <span class="step-title">Tuesday Tips</span>
            Watch for our exclusive weekly insights and opportunities in your inbox
          </li>
          <li>
            <span class="step-icon">👋</span>
            <span class="step-title">Join Our Community</span>
            Connect with fellow students and alumni in our private forum
          </li>
        </ul>
      </div>
      
      <p>Have questions about studying abroad? Feeling nervous or excited? We're here for you every step of the way! Simply reply to this email and our team of international education experts will get back to you within 24 hours.</p>
      
      <p>Here's to the incredible adventure ahead of you!</p>
      
      <p>Bon Voyage,<br>
      <strong>The Study Abroad Team</strong></p>
    </div>
    
    <div class="footer">
      <div class="social-links">
        <a href="https://www.facebook.com/tierceled">f</a>
        <a href="#">in</a>
        <a href="https://www.instagram.com/tierceled">ig</a>
        <a href="#">tw</a>
      </div>
      <div class="contact">
        <p>© 2025 Global Study Abroad Program | <a href="#">Privacy Policy</a> | <a href="#">Unsubscribe</a></p>
        <p>123 Education Lane, Global City, 10001</p>
        <p><a href="mailto:hello@studyabroad.com">hello@studyabroad.com</a> | <a href="tel:+12345678900">+1 (234) 567-8900</a></p>
      </div>
    </div>
  </div>
</body>
</html>
              `,
            // --- Attachment Section ---
            // UNCOMMENT and configure this section if you want to attach the PDF

            /*  attachments: [
              {
                filename: "Tiercel-Study-Abroad-Guide.pdf", // Use a branded filename
                // IMPORTANT: Use an absolute path or ensure relative path is correct from where your script runs
                path: "/absolute/path/to/your/checklist.pdf", // Example: use path.join(__dirname, 'assets', 'checklist.pdf') in Node.js
                contentType: "application/pdf",
              },
            ], */
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
