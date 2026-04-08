import type { Request, Response } from "express";

export function createMockRequest(input: Partial<Request> = {}): Request {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    ip: "127.0.0.1",
    ...input,
  } as Request;
}

export function createMockResponse() {
  let statusCode = 200;
  let jsonBody: unknown;
  let sentBody: unknown;

  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(payload: unknown) {
      jsonBody = payload;
      return response;
    },
    send(payload?: unknown) {
      sentBody = payload;
      return response;
    },
    cookie() {
      return response;
    },
    clearCookie() {
      return response;
    },
  } as unknown as Response;

  return {
    response,
    get statusCode() {
      return statusCode;
    },
    get jsonBody() {
      return jsonBody;
    },
    get sentBody() {
      return sentBody;
    },
  };
}
