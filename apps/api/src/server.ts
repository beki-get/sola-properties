
import "dotenv/config";

import { logger } from "./utils/logger";
import { pool } from "./config/database";
import app from "./app";

const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    await pool.query("SELECT NOW()");

    logger.info("PostgreSQL connection successful");

    const server = app.listen(PORT, () => {
      logger.info({ port: PORT }, "Express server started");
    });

    function shutdown() {
      logger.info("Shutting down server");

      server.close(async (error) => {
        if (error) {
          logger.error({ err: error }, "Error during server shutdown");
          process.exitCode = 1;
        }

        await pool.end();
      });
    }

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (err) {
    logger.fatal({ err }, "Failed to connect to PostgreSQL");
    await pool.end();
    process.exitCode = 1;
  }
}

void startServer();
