// src/swagger.ts
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { Express } from "express";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AWP MVP API",
      version: "1.0.0",
      description: "API de usuarios y auth con datos dinámicos",
    },
  },
  apis: ["./routes/*.ts"], // Swagger leerá tus comentarios en las rutas
};

const swaggerSpec = swaggerJSDoc(options);

export const setupSwagger = (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
