import cors from "cors";
import express from "express";
import { requestLogger } from "./middlewares/requestLogger";
import authRoutes from "./routes/authRoutes";

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

app.use("/api/v1/auth", authRoutes);

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "Express backend is running",
  });
});

export default app;
