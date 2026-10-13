import dotenv from "dotenv";
import path from "node:path";

// Resolve from the project root so loading works from src during development
// and from dist after compiling, regardless of the current working directory.
const envFilePath = path.resolve(__dirname, "../../.env");
const result = dotenv.config({ path: envFilePath });

if (result.error && (result.error as NodeJS.ErrnoException).code !== "ENOENT") {
  console.error(`Could not load environment file at ${envFilePath}:`, result.error.message);
}
