import { MiddlewareFn } from 'type-graphql';
import { MyContext } from '../types';
import { User } from '../entities/user';
import { decodeToken } from '../utils/jwtUtils';
import { getLogger } from '../utils/Logger';

const logger = getLogger('isAdmin');

export const isAdmin: MiddlewareFn<MyContext> = async ({ context }, next) => {
  let id;
  if (context.req?.headers?.authorization) {
    const decoded = await decodeToken(context);
    if (!decoded) {
      throw new Error('not authenticated');
    }
    id = decoded.id;
  }
  id = context.req.session.userId;
  if (!id) {
    throw new Error('not authenticated');
  }
  const user = await User.findOneBy({ id });
  if (!user) {
    logger.warn(`user with id ${id} not found, aborting auth check`);
  }
  if (!user?.admin) {
    throw new Error('not authenticated');
  }
  return next();
};
