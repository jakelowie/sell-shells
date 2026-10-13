import type { NextFunction, Request, Response } from "express";

const allowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";

/** Public cross-origin access for the API and its documentation. */
export function corsMiddleware(request: Request, response: Response, next: NextFunction): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", allowedMethods);

  const requestedHeaders = request.get("Access-Control-Request-Headers");
  if (requestedHeaders) {
    response.setHeader("Access-Control-Allow-Headers", requestedHeaders);
  }

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  next();
}
