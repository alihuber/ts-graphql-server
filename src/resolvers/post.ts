import { Post } from '../entities/post';
import {
  Arg,
  Ctx,
  Field,
  FieldResolver,
  Int,
  Mutation,
  ObjectType,
  Query,
  Resolver,
  Root,
  UseMiddleware,
} from 'type-graphql';
import { MyContext } from 'src/types';
import { isAuth } from '../middleware/isAuth';
import { getConnection } from 'typeorm';
import { User } from '../entities/user';
import { PostInput } from './PostInput';
import { getLogger } from '../utils/Logger';

const logger = getLogger('PostResolver');

@ObjectType()
class PaginatedPosts {
  @Field(() => [Post])
  posts: Post[];
  @Field(() => Boolean)
  hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
  @FieldResolver(() => String)
  textSnippet(@Root() root: Post): string {
    return root.text.slice(0, 50);
  }

  @FieldResolver(() => User)
  creator(@Root() post: Post, @Ctx() { userLoader }: MyContext) {
    return userLoader.load(post.creatorId);
  }

  @Query(() => PaginatedPosts)
  async posts(
    @Arg('limit', () => Int) limit: number,
    @Arg('cursor', () => String, { nullable: true }) cursor: string | null
  ): Promise<PaginatedPosts> {
    const realLimit = Math.min(50, limit);
    const realLimitPlusOne = realLimit + 1;
    let posts: Post[];
    logger.info({
      message: `Got posts request with limit ${limit}, cursor ${cursor}`,
    });
    if (!cursor) {
      posts = await getConnection()
        .getRepository(Post)
        .createQueryBuilder('p')
        .orderBy('p."createdAt"', 'DESC')
        .limit(realLimitPlusOne)
        .getMany();
    } else {
      posts = await getConnection()
        .getRepository(Post)
        .createQueryBuilder('p')
        .where('p."createdAt" < :cursor', { cursor })
        .orderBy('p."createdAt"', 'DESC')
        .limit(realLimitPlusOne)
        .getMany();
    }
    return {
      posts: posts.slice(0, realLimit),
      hasMore: posts.length === realLimitPlusOne,
    };
  }

  @Query(() => Post, { nullable: true })
  post(@Arg('id', () => Int) id: number): Promise<Post | undefined> {
    logger.info({
      message: `Got post request for id ${id}`,
    });
    return Post.findOne(id);
  }

  @Mutation(() => Post)
  @UseMiddleware(isAuth)
  async createPost(
    @Ctx() { req }: MyContext,
    @Arg('input') input: PostInput
  ): Promise<Post> {
    logger.info({
      message: `Got create post request for user ${req.session.userId}`,
    });
    return Post.create({
      ...input,
      creatorId: req.session.userId,
    }).save();
  }

  @Mutation(() => Post, { nullable: true })
  @UseMiddleware(isAuth)
  async updatePost(
    @Ctx() { req }: MyContext,
    @Arg('title') title: string,
    @Arg('text') text: string,
    @Arg('id', () => Int) id: number
  ): Promise<Post | null> {
    logger.info({
      message: `Got update post request for user ${req.session.userId}, post ${id}`,
    });
    const post = await Post.findOne(id);
    if (!post) {
      logger.warn({
        message: `Post with ${id} not found, returning...`,
      });
      return null;
    }
    const result = await getConnection()
      .createQueryBuilder()
      .update(Post)
      .set({ title, text })
      .where('id = :id and "creatorId" = :creatorId', {
        id,
        creatorId: req.session.userId,
      })
      .returning('*')
      .execute();
    return result.raw[0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async deletePost(
    @Arg('id', () => Int) id: number,
    @Ctx() { req }: MyContext
  ): Promise<boolean> {
    logger.info({
      message: `Got delete post request for user ${req.session.userId}, post ${id}`,
    });
    const post = await Post.findOne(id);
    if (!post) {
      logger.warn({
        message: `Post with ${id} not found, returning...`,
      });
      return false;
    }
    if (post.creatorId !== req.session.userId) {
      logger.warn({
        message: 'Creator/session user mismatch, returning...',
      });
      throw new Error('not authorized');
    }
    try {
      await Post.delete(id);
    } catch (e) {
      logger.warn({
        message: `Error deleting post, error: ${e.message}`,
      });
      return false;
    }
    return true;
  }
}
