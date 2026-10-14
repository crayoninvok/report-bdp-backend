import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRouter from "./router/authRouter";
import reportRouter from "./router/reportRouter";
import userRouter from "./router/userRouter";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/reports", reportRouter);
app.use("/api/users", userRouter);

app.get("/", (req, res) => {
  res.json({ message: "Report Company API is running!" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
