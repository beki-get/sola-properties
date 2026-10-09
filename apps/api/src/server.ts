import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    message: "Express backend is running cleanly with TypeScript!",
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is flying on http://localhost:${PORT}`);
});
