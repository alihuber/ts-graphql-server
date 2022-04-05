import { MyContext } from '../types';
import { decodeToken } from '../utils/jwtUtils';
import { MiddlewareFn } from 'type-graphql';

export const isAuth: MiddlewareFn<MyContext> = async ({ context }, next) => {
  if (context.req?.headers?.authorization) {
    const decoded = await decodeToken(context);
    if (!decoded) {
      throw new Error('not authenticated');
    }
  }
  if (!context.req.session.userId) {
    throw new Error('not authenticated');
  }
  return next();
};
