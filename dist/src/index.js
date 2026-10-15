"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const authRouter_1 = __importDefault(require("./router/authRouter"));
const reportRouter_1 = __importDefault(require("./router/reportRouter"));
const userRouter_1 = __importDefault(require("./router/userRouter"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Enable robust CORS for Vercel deployment
app.use((0, cors_1.default)({
    origin: true,
    credentials: true,
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-user-role",
        "x-user-jobsite",
        "x-user-id",
        "x-user-email",
    ],
}));
app.use(express_1.default.json());
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
app.use("/api/auth", authRouter_1.default);
app.use("/api/reports", reportRouter_1.default);
app.use("/api/users", userRouter_1.default);
// Start server locally (on Vercel, serverless function invokes exported app)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
exports.default = app;
