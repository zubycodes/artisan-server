const express = require("express");
const router = express.Router();
const { dbAsync, createHandler } = require("./base_route.js");
const nodemailer = require("nodemailer");

/**
 * Inquiry operations
 */
const inquiryOps = {
  getAll() {
    return dbAsync.all(`
      SELECT * FROM inquiry_requests ORDER BY created_at DESC
    `);
  },

  getById(id) {
    return dbAsync.get(
      `
      SELECT * FROM inquiry_requests WHERE id = ?
    `,
      [id]
    );
  },

  create(inquiry) {
    const {
      full_name,
      email_address,
      phone_number,
      desired_country,
      current_education_level,
      message,
    } = inquiry;

    return dbAsync.run(
      `INSERT INTO inquiry_requests (
        full_name, 
        email_address, 
        phone_number, 
        desired_country, 
        current_education_level, 
        message
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email_address,
        phone_number,
        desired_country,
        current_education_level,
        message,
      ]
    );
  },

  update(id, inquiry) {
    const {
      full_name,
      email_address,
      phone_number,
      desired_country,
      current_education_level,
      message,
    } = inquiry;

    return dbAsync.run(
      `UPDATE inquiry_requests 
       SET full_name = ?, 
           email_address = ?, 
           phone_number = ?, 
           desired_country = ?, 
           current_education_level = ?, 
           message = ? 
       WHERE id = ?`,
      [
        full_name,
        email_address,
        phone_number,
        desired_country,
        current_education_level,
        message,
        id,
      ]
    );
  },

  delete(id) {
    return dbAsync.run("DELETE FROM inquiry_requests WHERE id = ?", [id]);
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
        route: "inquiries",
        handler: "getAll",
      });
      routeLogger.info("Received get all inquiries request");
      try {
        const inquiries = await inquiryOps.getAll();
        res.json(inquiries);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching inquiries");
        res.status(500).json({ error: error.message });
      }
    }),

    getById: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "inquiries",
        handler: "getById",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received get inquiry by id request"
      );
      try {
        const inquiry = await inquiryOps.getById(req.params.id);

        if (!inquiry) {
          return res.status(404).json({ error: "Inquiry not found" });
        }

        res.json(inquiry);
      } catch (error) {
        routeLogger.error({ error }, "Error fetching inquiry");
        res.status(500).json({ error: error.message });
      }
    }),

    create: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "inquiries",
        handler: "create",
      });
      routeLogger.info({ body: req.body }, "Received create inquiry request");

      // Validate required fields
      const requiredFields = ["full_name", "email_address", "desired_country"];
      const missingFields = requiredFields.filter((field) => !req.body[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      try {
        const { lastID } = await inquiryOps.create(req.body);

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
          const firstName = req.body.full_name || "there";
          const userEmail = req.body.email_address; // Use this for the 'to' field
          const consultantName = "Aleem";
          const consultationDate = "15 April, 2025";
          const consultationTime = "10:00 AM";
          const meetingLink = "https://zoom.us/j/1234567890";
          await transporter.sendMail({
            from: '"Tiercel Education Consultant" <dev@tierceledconsulting.com>',
            to: userEmail,
            subject: "✅ Your Virtual Consultation is Confirmed!",
            text: `Hi ${firstName}, your consultation with ${consultantName} is confirmed for ${consultationDate} at ${consultationTime}. Join link: ${meetingLink}`,
            html: `
             <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Virtual Consultation is Confirmed</title>
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
      background-color: white;
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
      width: 75px;
      height: 75px;
    }
    .content {
      padding: 40px 30px;
    }
    .welcome-message {
      margin-bottom: 30px;
      line-height: 1.7;
      font-size: 16px;
    }
    .consultation-details {
      background-color: #f5f8ff;
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border-left: 5px solid #0a2342;
      box-shadow: 0 6px 12px rgba(10, 35, 66, 0.08);
      position: relative;
    }
    .consultation-details:after {
      content: '🗓️';
      position: absolute;
      right: 20px;
      top: 20px;
      font-size: 24px;
      opacity: 0.2;
    }
    .consultation-details h3 {
      margin-top: 0;
      color: #0a2342;
      font-size: 20px;
      font-weight: 700;
    }
    .consultation-details p {
      margin: 5px 0;
    }
    .details-row {
      display: flex;
      margin: 15px 0;
      align-items: center;
    }
    .details-icon {
      flex: 0 0 30px;
      font-size: 20px;
      color: #e04448;
      margin-right: 15px;
      text-align: center;
    }
    .details-text {
      flex: 1;
    }
    .details-text strong {
      display: block;
      color: #0a2342;
      margin-bottom: 3px;
    }
    .calendar-button {
      display: block;
      background-color: #e04448;
      color: white;
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
    .calendar-button:before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: all 0.6s;
    }
    .calendar-button:hover {
      background-color: #c02e32;
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(224, 68, 72, 0.4);
    }
    .calendar-button:hover:before {
      left: 100%;
    }
    .prepare-section {
      background-color: #fff;
      padding: 25px;
      border-radius: 12px;
      margin-bottom: 30px;
      box-shadow: 0 6px 12px rgba(10, 35, 66, 0.08);
      border: 2px solid #f0f4f9;
    }
    .prepare-section h3 {
      color: #0a2342;
      font-size: 20px;
      font-weight: 700;
      margin-top: 0;
      text-align: center;
      margin-bottom: 20px;
    }
    .prepare-list {
      padding-left: 0;
      list-style-type: none;
    }
    .prepare-list li {
      position: relative;
      padding-left: 38px;
      margin-bottom: 16px;
      line-height: 1.5;
    }
    .prepare-list li:before {
      content: '';
      position: absolute;
      left: 0;
      top: 2px;
      width: 24px;
      height: 24px;
      background-color: rgba(224, 68, 72, 0.15);
      border-radius: 50%;
    }
    .prepare-list li:after {
      content: '✓';
      position: absolute;
      left: 6px;
      top: 1px;
      color: #e04448;
      font-weight: bold;
    }
    .meeting-link-container {
      background-color: #0a2342;
      color: white;
      border-radius: 12px;
      padding: 25px;
      margin: 30px 0;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .meeting-link-container:before {
      content: '';
      position: absolute;
      top: -20px;
      right: -20px;
      width: 100px;
      height: 100px;
      background-color: rgba(224, 68, 72, 0.2);
      border-radius: 50%;
    }
    .meeting-link-container h3 {
      margin-top: 0;
      color: white;
      font-size: 20px;
      position: relative;
      z-index: 2;
    }
    .meeting-link {
      display: inline-block;
      background-color: white;
      color: #0a2342;
      padding: 15px 25px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      margin: 15px 0;
      transition: all 0.3s;
      position: relative;
      z-index: 2;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
    }
    .meeting-link:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    }
    .consultant-profile {
      display: flex;
      align-items: center;
      background-color: #f5f8ff;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 30px;
      border: 1px solid #e1e8f5;
    }
    .consultant-img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      margin-right: 20px;
      border: 3px solid white;
      box-shadow: 0 5px 15px rgba(10, 35, 66, 0.1);
    }
    .consultant-info h4 {
      margin: 0 0 5px;
      color: #0a2342;
      font-size: 18px;
    }
    .consultant-info p {
      margin: 0;
      color: #555;
      font-size: 14px;
    }
    .divider {
      height: 8px;
      background: linear-gradient(90deg, #0a2342, #e04448, #0a2342);
      margin: 0;
      padding: 0;
      border: none;
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
    @media (max-width: 600px) {
      .container {
        border-radius: 0;
      }
      .content {
        padding: 30px 20px;
      }
      .header h1 {
        font-size: 28px;
      }
      .consultant-profile {
        flex-direction: column;
        text-align: center;
      }
      .consultant-img {
        margin: 0 0 15px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <img src="/api/placeholder/150/150" alt="Tiercel Education Logo">
      </div>
      <h1>YOUR CONSULTATION IS CONFIRMED!</h1>
      <p>We're excited to help plan your study abroad journey</p>
    </div>
    
    <hr class="divider">
    
    <div class="content">
      <div class="welcome-message">
        <p><strong>Hello ${firstName},</strong></p>
        <p>Thank you for booking a virtual consultation with Tiercel Education Consulting! We're thrilled to help you navigate your study abroad journey and provide personalized guidance for your international education plans.</p>
      </div>
      
      <div class="consultation-details">
        <h3>📅 Your Consultation Details</h3>
        
        <div class="details-row">
          <div class="details-icon">📆</div>
          <div class="details-text">
            <strong>Date</strong>
            {{consultationDate}} ({{timezone}})
          </div>
        </div>
        
        <div class="details-row">
          <div class="details-icon">⏰</div>
          <div class="details-text">
            <strong>Time</strong>
            {{consultationTime}} ({{duration}} minutes)
          </div>
        </div>
        
        <div class="details-row">
          <div class="details-icon">👤</div>
          <div class="details-text">
            <strong>Your Consultant</strong>
            {{consultantName}}, {{consultantTitle}}
          </div>
        </div>
        
        <div class="details-row">
          <div class="details-icon">💻</div>
          <div class="details-text">
            <strong>Virtual Meeting Platform</strong>
            {{platform}} (Zoom/Teams/Google Meet)
          </div>
        </div>
      </div>
      
      <a href="#" class="calendar-button">Add to Calendar</a>
      
      <div class="meeting-link-container">
        <h3>Join Your Virtual Consultation Here</h3>
        <a href="{{meetingLink}}" class="meeting-link">Click to Join Meeting</a>
        <p>Meeting ID: {{meetingId}}</p>
        <p>Passcode: {{passcode}}</p>
      </div>
      
      <div class="consultant-profile">
        <img src="/api/placeholder/150/150" alt="Consultant Photo" class="consultant-img">
        <div class="consultant-info">
          <h4>Your Consultant: {{consultantName}}</h4>
          <p>{{consultantBio}}</p>
        </div>
      </div>
      
      <div class="prepare-section">
        <h3>How to Prepare for Your Consultation</h3>
        <ul class="prepare-list">
          <li><strong>Have your desired destinations in mind</strong> - Think about where you'd like to study and why those countries interest you</li>
          <li><strong>Consider your academic goals</strong> - What programs, degrees, or research areas are you interested in?</li>
          <li><strong>Know your timeline</strong> - When would you like to begin your studies abroad?</li>
          <li><strong>Budget considerations</strong> - Have a general idea of your financial parameters for this journey</li>
          <li><strong>Prepare questions</strong> - Write down any specific questions you have about studying abroad</li>
        </ul>
      </div>
      
      <p>If you need to reschedule your consultation, please contact us at least 24 hours before your scheduled time by replying to this email or calling us at {{phoneNumber}}.</p>
      
      <p>We look forward to speaking with you and helping you take the first steps toward your international education adventure!</p>
      
      <p>Best regards,<br>
      <strong>The Tiercel Education Consulting Team</strong></p>
    </div>
    
    <div class="footer">
      <div class="social-links">
        <a href="#">f</a>
        <a href="#">in</a>
        <a href="#">ig</a>
        <a href="#">tw</a>
      </div>
      <div class="contact">
        <p>© 2025 Tiercel Education Consulting | <a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></p>
        <p>123 Education Lane, Global City, 10001</p>
        <p><a href="mailto:dev@tierceledconsulting.com">dev@tierceledconsulting.com</a> | <a href="tel:+12345678900">+1 (234) 567-8900</a></p>
      </div>
    </div>
  </div>
</body>
</html>
            `,
          });
        } catch (error) {
          console.error("Error sending thank you email:", error);
          res.status(500).json({ error: error.message });
        }

        res.status(201).json({
          status: "success",
          message: "Inquiry submitted successfully",
          id: lastID,
        });
      } catch (error) {
        logger.error({ error }, "Error creating inquiry");
        res.status(500).json({ error: error.message });
      }
    }),

    update: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "inquiries",
        handler: "update",
      });
      routeLogger.info(
        { id: req.params.id, body: req.body },
        "Received update inquiry request"
      );

      try {
        const { changes } = await inquiryOps.update(req.params.id, req.body);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Inquiry not found");
          return res.status(404).json({ error: "Inquiry not found" });
        }

        res.json({
          status: "success",
          message: "Inquiry updated successfully",
          id: parseInt(req.params.id),
        });
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error updating inquiry");
        res.status(500).json({ error: error.message });
      }
    }),

    delete: createHandler(async (req, res) => {
      const routeLogger = logger.child({
        route: "inquiries",
        handler: "delete",
      });
      routeLogger.info(
        { id: req.params.id },
        "Received delete inquiry request"
      );

      try {
        const { changes } = await inquiryOps.delete(req.params.id);

        if (changes === 0) {
          logger.warn({ id: req.params.id }, "Inquiry not found");
          return res.status(404).json({ error: "Inquiry not found" });
        }

        res.json({
          status: "success",
          message: "Inquiry deleted successfully",
        });
      } catch (error) {
        logger.error({ error, id: req.params.id }, "Error deleting inquiry");
        res.status(500).json({ error: error.message });
      }
    }),
  };

  // Route definitions

  /**
   * @swagger
   * /inquiries:
   *   get:
   *     summary: Get all inquiry requests
   *     responses:
   *       200:
   *         description: Successful operation
   */
  router.get("/inquiries", handlers.getAll);

  /**
   * @swagger
   * /inquiries/{id}:
   *   get:
   *     summary: Get an inquiry request by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to fetch
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Successful operation
   *       404:
   *         description: Inquiry not found
   */
  router.get("/inquiries/:id", handlers.getById);

  /**
   * @swagger
   * /inquiries:
   *   post:
   *     summary: Submit a new inquiry request
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               full_name:
   *                 type: string
   *               email_address:
   *                 type: string
   *               phone_number:
   *                 type: string
   *               desired_country:
   *                 type: string
   *               current_education_level:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Inquiry submitted successfully
   *       400:
   *         description: Missing required fields
   */
  router.post("/inquiries", handlers.create);

  /**
   * @swagger
   * /inquiries/{id}:
   *   put:
   *     summary: Update an existing inquiry
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to update
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               full_name:
   *                 type: string
   *               email_address:
   *                 type: string
   *               phone_number:
   *                 type: string
   *               desired_country:
   *                 type: string
   *               current_education_level:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       200:
   *         description: Inquiry updated successfully
   *       404:
   *         description: Inquiry not found
   */
  router.put("/inquiries/:id", handlers.update);

  /**
   * @swagger
   * /inquiries/{id}:
   *   delete:
   *     summary: Delete an inquiry
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         description: ID of the inquiry to delete
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Inquiry deleted successfully
   *       404:
   *         description: Inquiry not found
   */
  router.delete("/inquiries/:id", handlers.delete);

  return router;
};
