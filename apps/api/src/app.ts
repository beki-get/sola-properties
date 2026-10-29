import cors from "cors";
import express from "express";
import { requestLogger } from "./middlewares/requestLogger";
import authRoutes from "./routes/authRoutes";
import accountVerificationRoutes from "./routes/accountVerificationRoutes";
import buyerProfileRoutes from "./routes/buyerProfileRoutes";
import agentProfileRoutes from "./routes/agentProfileRoutes";
import developerProfileRoutes from "./routes/developerProfileRoutes";
import buyerPreferencesRoutes from "./routes/buyerPreferencesRoutes";
import developerProjectRoutes from "./routes/developerProjectRoutes";
import propertyRoutes from "./routes/propertyRoutes";
import adminProjectRoutes from "./routes/adminProjectRoutes";
import propertyAuthorizationRoutes from "./routes/propertyAuthorizationRoutes";

import { openApiDocument, swaggerUiHtml } from "./docs/openapi";
import adminAccountVerificationRoutes from "./routes/adminAccountVerificationRoutes";
import adminPropertyRoutes from "./routes/adminPropertyRoutes";

const app = express();

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

app.use(requestLogger);

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.use(express.json());

app.get("/api/docs/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});

app.get("/api/docs", (_req, res) => {
  res.type("html").send(swaggerUiHtml);
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/account-verification", accountVerificationRoutes);
app.use("/api/v1/admin/account-verification", adminAccountVerificationRoutes);

app.use("/api/v1/buyer", buyerProfileRoutes);
app.use("/api/v1/agent", agentProfileRoutes);
app.use("/api/v1/developer/projects", developerProjectRoutes);
app.use("/api/v1/admin/projects", adminProjectRoutes);
app.use("/api/v1/developer", developerProfileRoutes);
app.use("/api/v1/buyer", buyerPreferencesRoutes);
app.use("/api/v1/properties", propertyRoutes);
app.use("/api/v1", propertyAuthorizationRoutes);

app.use("/api/v1/admin/properties", adminPropertyRoutes);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Express backend is running",
  });
});

export default app;
