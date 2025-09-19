export enum AppCode {
  // 0: ÉXITO
  OK = 0,

  // 1–19: Validación / entrada
  VALIDATION_FAILED = 1,
  BAD_CONTENT_TYPE = 2,
  MISSING_FIELDS = 3,
  INVALID_CREDENTIALS = 4,

  // 20–39: Auth / permisos
  UNAUTHORIZED = 20,
  FORBIDDEN = 21,
  OTP_INVALID = 22,
  TOKEN_EXPIRED = 23,

  // 40–59: Negocio / dominio
  USER_ALREADY_EXISTS = 40,
  USER_NOT_FOUND = 41,
  ROLE_NOT_ALLOWED = 42,

  // 60–79: Recurso / DB
  DB_CONSTRAINT = 60,
  DB_ERROR = 61,
  NOT_FOUND = 62,

  // 80–99: Límite / anti abuse
  RATE_LIMITED = 80,

  // 100–199: Infraestructura
  INTERNAL_ERROR = 100
}

export const CodeMessage: Record<AppCode, string> = {
  [AppCode.OK]: "Operación exitosa",

  [AppCode.VALIDATION_FAILED]: "Validación fallida",
  [AppCode.BAD_CONTENT_TYPE]: "Content-Type debe ser application/json",
  [AppCode.MISSING_FIELDS]: "Faltan campos requeridos",
  [AppCode.INVALID_CREDENTIALS]: "Credenciales inválidas",

  [AppCode.UNAUTHORIZED]: "No autenticado",
  [AppCode.FORBIDDEN]: "No tienes permisos",
  [AppCode.OTP_INVALID]: "OTP inválido",
  [AppCode.TOKEN_EXPIRED]: "Token expirado",

  [AppCode.USER_ALREADY_EXISTS]: "El email ya está registrado",
  [AppCode.USER_NOT_FOUND]: "Usuario no encontrado",
  [AppCode.ROLE_NOT_ALLOWED]: "Rol no permitido",

  [AppCode.DB_CONSTRAINT]: "Restricción de base de datos",
  [AppCode.DB_ERROR]: "Error de base de datos",
  [AppCode.NOT_FOUND]: "Recurso no encontrado",

  [AppCode.RATE_LIMITED]: "Demasiados intentos, inténtalo más tarde",

  [AppCode.INTERNAL_ERROR]: "Error interno del servidor"
};

// HTTP por defecto (puedes ajustar)
export const CodeHttp: Record<AppCode, number> = {
  [AppCode.OK]: 200,

  [AppCode.VALIDATION_FAILED]: 400,
  [AppCode.BAD_CONTENT_TYPE]: 415,
  [AppCode.MISSING_FIELDS]: 400,
  [AppCode.INVALID_CREDENTIALS]: 401,

  [AppCode.UNAUTHORIZED]: 401,
  [AppCode.FORBIDDEN]: 403,
  [AppCode.OTP_INVALID]: 401,
  [AppCode.TOKEN_EXPIRED]: 401,

  [AppCode.USER_ALREADY_EXISTS]: 400,
  [AppCode.USER_NOT_FOUND]: 404,
  [AppCode.ROLE_NOT_ALLOWED]: 403,

  [AppCode.DB_CONSTRAINT]: 409,
  [AppCode.DB_ERROR]: 500,
  [AppCode.NOT_FOUND]: 404,

  [AppCode.RATE_LIMITED]: 429,

  [AppCode.INTERNAL_ERROR]: 500
};
