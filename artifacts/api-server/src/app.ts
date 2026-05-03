import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

// 1. Add these two imports for file pathing
import path from "path";
import { fileURLToPath } from "url";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// This handles all your backend requests
app.use("/api", router);

// --- ADDED CODE: SERVE THE FRONTEND ---
// Get the current directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Point Express exactly to where Vite built your React app
// Based on your folder structure, it's two folders up, then into khabar/dist/public
const frontendPath = path.join(__dirname, "../../khabar/dist/public");

// Serve all the static files (CSS, JS, images)
app.use(express.static(frontendPath));

// Catch-all route: If they ask for any URL not handled by "/api", send them the React app!
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});
// --------------------------------------

export default app;