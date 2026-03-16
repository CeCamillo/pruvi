import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { hasZodFastifySchemaValidationErrors } from "fastify-type-provider-zod";
import { AppError } from "../utils/errors";

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    // Zod schema validation errors (from type provider)
    if (hasZodFastifySchemaValidationErrors(error)) {
      request.log.warn({ err: error }, "Validation error");
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        code: "VALIDATION_ERROR",
      });
    }

    // Known application errors
    if (error instanceof AppError) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error }, error.message);
      } else {
        request.log.warn({ err: error }, error.message);
      }
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
        code: error.code,
      });
    }

    // Unexpected errors — never expose internals
    request.log.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  });
};

export const errorHandlerPlugin = fp(plugin, {
  name: "error-handler",
});
