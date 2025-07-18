import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";

// routes imports
import userRoutes from "./routes/userRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import exerciseRoutes from "./routes/exerciseRoutes.js";
import shopItemRoutes from "./routes/shopItemRoutes.js";

// admin routes
import adminRoutes from "./routes/adminRoutes.js";

// utils imports
import genericSearch from "./utils/genericSearch.js";
import searchUsers from "./utils/searchUsers.js";
import searchCourses from "./utils/searchCourses.js";
import searchExercises from "./utils/searchExercises.js";


// Environment variables
const port: number = process.env.PORT ? Number(process.env.PORT) : 3000;
const mongoUri: string = process.env.MONGO_URI || "";
const nodeEnv =
  process.env.NODE_ENV === "production" ? "production" : "development";
const apiUrl = process.env.API_URL || `http://localhost:${port}`;
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",")
  : ["http://localhost:5173", "https://yourdomain.com"];

// Global rate limiter for production
const prodLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Limit each IP to 10000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: "Too many requests, please try again later.",
  },
});

// connect to MongoDB
mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

const app = express();
app.use(cookieParser());
app.use(compression());

console.log("CORS configuration:");
console.log("- Environment:", nodeEnv);
console.log("Cours Origins:", corsOrigins);

app.use(
  cors({
    origin: corsOrigins, // List specific origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true // This is critical for requests with credentials
  })
);

app.use(express.json());

// Add basic security in production
if (nodeEnv === "production") {
  app.use(helmet());
}

app.use(prodLimiter);

/**
 * Generic Search, Sort and Pagination Function
 * @param model - The Mongoose model to search
 * @param validSearchKeys - Array of valid keys for searching
 * @param validSortKeys - Array of valid keys for sorting
 * @param numericFields - Array of fields that should be treated as numbers
 * @param search - Search string in format "key:value"
 * @param sort - Sort string in format "field:order"
 * @param pageNumber - Page number for pagination
 * @param pageSize - Number of items per page
 */

app.use(genericSearch);
app.use(searchUsers);
app.use(searchCourses);
app.use(searchExercises);

// routes initiation
app.use("/users", userRoutes);
app.use("/courses", courseRoutes);
app.use("/exercises", exerciseRoutes);
app.use("/shop", shopItemRoutes);

app.use("/admin", adminRoutes);

app.listen(port, () => {
  console.log(
    `🚀 Server running on ${apiUrl} in ${nodeEnv} mode (to inserted port ${port})`,
  );
});
