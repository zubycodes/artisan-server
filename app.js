"use strict";

// Core dependencies - These are the fundamental libraries that the application relies on for its basic functionality.
const express = require("express"); // Web framework for Node.js.
const cors = require("cors"); // Middleware to enable Cross-Origin Resource Sharing.
const { createServer } = require("http");
const { promisify } = require("util");
const cluster = require("cluster");
const os = require("os");

// Security - These libraries are crucial for protecting the application from common security vulnerabilities.
const helmet = require("helmet"); // Middleware for security headers.
const rateLimit = require("express-rate-limit"); // Middleware for rate limiting.
const compression = require("compression"); // Middleware for compressing responses.

// Observability - These libraries are important for monitoring the application's performance and identifying potential issues.
const pino = require("pino"); // Logger.
const pinoHttp = require("pino-http"); // Middleware for logging HTTP requests.

const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./config/swagger");

// Application constants
const CONFIG = Object.freeze({
  PORT: process.env.PORT || 6500,
  ENV: process.env.NODE_ENV || "development",
  CLIENT_URL: process.env.CLIENT_URL || [
    "http://3.106.165.252:8080",
    "http://artisan-psic.com",
    "https://artisan-psic.com",
    "https://tierceledconsulting.com",
    "http://localhost:6500",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://localhost:8083",
    "http://localhost:8084",
    "http://3.106.165.252",
  ],
  WORKER_COUNT: process.env.WORKER_COUNT || os.cpus().length,
  RATE_LIMIT: { windowMs: 15 * 60 * 10000, max: 10000 },
});

// Logger setup with context
const logger = pino({
  level: CONFIG.ENV === "production" ? "info" : "debug",
  transport:
    CONFIG.ENV !== "production"
      ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      }
      : undefined,
  base: { pid: process.pid, env: CONFIG.ENV },
});

// Database connection with advanced patterns - This section is essential for connecting to the database and performing database operations.
const { db, setLogger, connect, disconnect } = require("./db");
const subscriptions = require("./routes/subscriptions");
setLogger(logger.child({ module: "database" }));

// Route registry with dependency injection - This section is important for defining the application's routes and handling incoming requests.
const createRouteRegistry = (dbInstance) => ({
  users: {
    path: "./routes/user",
    dependencies: { db: dbInstance, logger: logger.child({ module: "users" }) },
  },
  crafts: {
    path: "./routes/crafts",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "crafts" }),
    },
  },
  categories: {
    path: "./routes/categories",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "categories" }),
    },
  },
  techniques: {
    path: "./routes/techniques",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "techniques" }),
    },
  },
  geo_level: {
    path: "./routes/geo_level",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "geo_level" }),
    },
  },
  artisans: {
    path: "./routes/artisans",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "artisans" }),
    },
  },
  education: {
    path: "./routes/education",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "education" }),
    },
  },
  charts: {
    path: "./routes/charts",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "charts" }),
    },
  },
  inq: {
    path: "./routes/inq",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "inq" }),
    },
  },
  subscriptions: {
    path: "./routes/subscriptions",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "subscriptions" }),
    },
  },
  conversations: {
    path: "./routes/conversations",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "conversations" }),
    },
  },
  sessions: {
    path: "./routes/sessions",
    dependencies: {
      db: dbInstance,
      logger: logger.child({ module: "sessions" }),
    },
  },
});

// Main application factory
const createApp = async (dbInstance, routeRegistry) => {
  const app = express();

  // Enhanced middleware stack
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    })
  );
  app.use(compression());
  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: "10mb", strict: true }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(
    cors({
      origin: CONFIG.CLIENT_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
      exposedHeaders: ["X-Total-Count,X-Rate-Limit-Remaining"],
    })
  );

  // API rate limiting
  app.use(
    rateLimit({
      windowMs: CONFIG.RATE_LIMIT.windowMs,
      max: CONFIG.RATE_LIMIT.max,
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn({ ip: req.ip }, "Rate limit exceeded");
        res
          .status(429)
          .json({ error: "Too many requests, please try again later" });
      },
    })
  );

  // Swagger UI setup
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

  // Dynamic route mounting with dependency injection
  await Promise.all(
    Object.entries(routeRegistry).map(async ([name, config]) => {
      try {
        const routeModule = require(config.path);
        if (!routeModule) {
          logger.error({ routePath: config.path }, "Route module is undefined");
          return;
        }
        const router =
          typeof routeModule === "function"
            ? routeModule(config.dependencies)
            : routeModule;

        // Mount the router
        app.use(router);
        logger.debug(`Mounted route: /${name}`);
      } catch (error) {
        logger.error(
          { error, routePath: config.path },
          "Failed to load route module"
        );
      }
    })
  );

  // Serve static files from the "uploads" directory
  app.use("/uploads", express.static("uploads"));

  // Catch-all to serve your Angular app for all other routes
  app.use(express.static(require("path").join(__dirname, "public")));
  app.get("*", (req, res) => {
    res.sendFile(require("path").join(__dirname, "public/index.html"));
  });

  // Health and monitoring endpoints
  app.get("/", (_, res) =>
    res.status(200).json({
      status: "operational",
      version: process.env.npm_package_version,
      uptime: process.uptime(),
    })
  );

  app.get("/health", async (_, res) => {
    try {
      const dbStatus = await dbInstance.ping();
      res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus ? "connected" : "disconnected",
        },
      });
    } catch (error) {
      logger.error({ error }, "Health check failed");
      res.status(503).json({ status: "unhealthy" });
    }
  });

  // Comprehensive error handling - This section is crucial for handling errors and preventing the application from crashing.
  app.use((req, res, next) => {
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    logger.error(
      {
        err,
        request: {
          method: req.method,
          url: req.url,
          id: req.id,
        },
      },
      err.message
    );

    res.status(statusCode).json({
      error:
        CONFIG.ENV === "production" && statusCode === 500
          ? "Internal server error"
          : err.message,
    });
  });

  return app;
};

// Server lifecycle management - This section is essential for starting and stopping the server gracefully.
const startServer = async () => {
  // Initialize DB connection
  try {
    await connect();
    logger.info("Database connection established");
  } catch (error) {
    logger.fatal({ error }, "Database connection failed");
    process.exit(1);
  }

  // Create application with injected dependencies
  const routeRegistry = createRouteRegistry(db);
  const app = await createApp(db, routeRegistry);

  // Create HTTP server
  const server = createServer(app);

  // Enhanced server events
  server.on("error", (error) => {
    logger.fatal({ error }, "Server failed to start");
    process.exit(1);
  });

  // Graceful shutdown handlers
  const shutdown = async (signal) => {
    logger.info({ signal }, "Shutdown signal received, closing connections");

    // Close server first to stop accepting new connections
    await promisify(server.close.bind(server))();
    logger.info("HTTP server closed");

    // Then close DB connections
    try {
      await disconnect();
      logger.info("Database connections closed");
    } catch (error) {
      logger.error({ error }, "Database disconnection failed");
    }

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Unhandled error handlers
  process.on("uncaughtException", (error) => {
    logger.fatal({ error }, "Uncaught exception");
    shutdown("UNCAUGHT_EXCEPTION").catch(() => process.exit(1));
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.fatal({ reason }, "Unhandled promise rejection");
    shutdown("UNHANDLED_REJECTION").catch(() => process.exit(1));
  });

  // Start listening
  return new Promise((resolve) => {
    server.listen(CONFIG.PORT, () => {
      logger.info(
        `Server running on port ${CONFIG.PORT} in ${CONFIG.ENV} mode [Worker: ${process.pid}]`
      );
      resolve({ app, server });
    });
  });
};

// Cluster mode for production
if (cluster.isMaster && CONFIG.ENV === "production") {
  logger.info(`Master process ${process.pid} is running`);

  // Create workers
  for (let i = 0; i < CONFIG.WORKER_COUNT; i++) {
    cluster.fork();
  }

  // Handle worker events
  cluster.on("exit", (worker, code, signal) => {
    logger.warn(
      { workerId: worker.id, code, signal },
      "Worker died, spawning replacement"
    );
    cluster.fork();
  });
} else {
  // Start worker
  startServer().catch((error) => {
    logger.fatal({ error }, "Application failed to start");
    process.exit(1);
  });
}

// For testing/programmatic usage
module.exports = { createApp, startServer, CONFIG, logger };
