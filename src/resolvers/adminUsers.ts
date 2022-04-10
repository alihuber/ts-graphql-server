import { User } from '../entities/user';
import {
  Arg,
  Field,
  Int,
  ObjectType,
  Query,
  Resolver,
  UseMiddleware,
} from 'type-graphql';
import { getLogger } from '../utils/Logger';
import { isAdmin } from '../middleware/isAdmin';

const logger = getLogger('AdminUserResolver');

@ObjectType()
class PaginatedUsers {
  @Field(() => [User])
  users: User[];
  @Field(() => Boolean)
  hasMore: boolean;
}

@Resolver(User)
export class AdminUserResolver {
  @Query(() => PaginatedUsers)
  @UseMiddleware(isAdmin)
  async users(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedUsers> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    let users: User[];
    logger.info({
      message: `Got users request with limit ${limit}, cursor ${cursor}`,
    });
    if (!cursor) {
      users = await User.createQueryBuilder('u')
        .orderBy('u."createdAt"', 'DESC')
        .limit(realLimitPlusOne)
        .getMany();
    } else {
      users = await User.createQueryBuilder('u')
        .where('u."createdAt" < :cursor', { cursor })
        .orderBy('u."createdAt"', 'DESC')
        .limit(realLimitPlusOne)
        .getMany();
    }
    return {
      users: users.slice(0, realLimit),
      hasMore: users.length === realLimitPlusOne,
    };
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(isAdmin)
  async user(@Arg('userId', () => Int) userId: number): Promise<User | null> {
    return await User.findOneBy({ id: userId });
  }
}
