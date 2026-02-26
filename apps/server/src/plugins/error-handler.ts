import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { AppError } from "../errors.js";

function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError | AppError, _request, reply) => {
    if (error instanceof AppError) {
      void reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
        statusCode: error.statusCode,
      });
      return;
    }

    if ("validation" in error) {
      void reply.status(400).send({
        error: error.message,
        code: "VALIDATION_ERROR",
        statusCode: 400,
      });
      return;
    }

    fastify.log.error(error);
    void reply.status(500).send({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  });
}

export const errorHandler = fp(errorHandlerPlugin, {
  name: "error-handler",
});
