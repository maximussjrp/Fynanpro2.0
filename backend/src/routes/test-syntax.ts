// Test file to validate syntax
import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

const testRouter = Router();

testRouter.post('/activate-templates', async (req: AuthRequest, res: Response) => {
  try {
    const data = { success: true };
    return successResponse(res, data, 201);
  } catch (error) {
    return errorResponse(res, 'ERROR', 'Failed', 500);
  }
});

export default testRouter;
