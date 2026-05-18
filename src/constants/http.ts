export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}

export enum ErrorMessage {
  NOT_FOUND = 'Resource not found',
  UNAUTHORIZED = 'Authentication required',
  FORBIDDEN = 'Insufficient permissions',
  SERVER_ERROR = 'An unexpected error occurred',
}
