import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./router/authRouter";
import reportRouter from "./router/reportRouter";
import userRouter from "./router/userRouter";
import riverJournalRouter from "./router/riverJournalRouter";
import productionRouter from "./router/productionRouter";
import glRouter from "./router/glRouter";
import plantRouter from "./router/plantRouter";
import assetfindrRouter from "./router/assetfindrRouter";
import volvoRouter from "./router/volvoRouter";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable robust CORS for Vercel deployment
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-assetfindr-token",
      "x-user-role",
      "x-user-jobsite",
      "x-user-id",
      "x-user-email",
    ],
  })
);

app.use(express.json());

// Normalize URL path when Vercel rewrites to /api
app.use((req, res, next) => {
  if (req.originalUrl && req.url !== req.originalUrl) {
    req.url = req.originalUrl;
  }
  next();
});

// Health check endpoints
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Report Company API is running!" });
});

app.get("/api", (req, res) => {
  res.json({ status: "ok", message: "Report Company API is running on Vercel!" });
});

app.use("/api/auth", authRouter);
app.use("/api/reports", reportRouter);
app.use("/api/users", userRouter);
app.use("/api/river-journal", riverJournalRouter);
app.use("/api/production", productionRouter);
app.use("/api/gl", glRouter);
app.use("/api/plant", plantRouter);
app.use("/api/assetfindr", assetfindrRouter);
app.use("/api/volvo", volvoRouter);


// Start server locally (on Vercel, serverless function invokes exported app)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

export default app;
