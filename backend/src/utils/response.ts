import { Response } from 'express';

export const successResponse = (res: Response, data: any, statusCode: number = 200) => {
  return res.status(statusCode).json({
    success: true,
    data
  });
};

export const errorResponse = (res: Response, code: string, message: string, statusCode: number = 400, details?: any) => {
  const error: any = {
    code,
    message
  };

  if (details) {
    error.details = details;
  }

  return res.status(statusCode).json({
    success: false,
    error
  });
};

export const paginatedResponse = (res: Response, data: any[], page: number, limit: number, total: number) => {
  return res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    }
  });
};
