const errorResponse = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string" },
    code: { type: "string" },
    status: { type: "string" },
    errors: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

const messageResponse = {
  type: "object",
  required: ["message"],
  properties: { message: { type: "string" } },
} as const;

export const jsonBody = (schema: string) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

export const jsonResponse = (description: string, schema: string) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

export const error = (description: string) =>
  jsonResponse(description, "ErrorResponse");

export const sharedSchemas = {
  ErrorResponse: errorResponse,
  MessageResponse: messageResponse,
  HealthResponse: {
    type: "object",
    required: ["status", "message"],
    properties: {
      status: { type: "string", example: "ok" },
      message: { type: "string", example: "Express backend is running" },
    },
  },
} as const;