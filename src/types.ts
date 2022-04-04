import { Field, ObjectType } from 'type-graphql';
import { User } from './entities/user';
import { Request, Response } from 'express';
import Redis from 'ioredis';
import { createUserLoader } from './utils/createUserLoader';

declare global {
  // eslint-disable-next-line
  namespace Express {
    interface Session {
      userId?: number;
    }
  }
}

export type MyContext = {
  req: Request & { session: Express.Session };
  res: Response;
  redis: Redis;
  userLoader: ReturnType<typeof createUserLoader>;
};

@ObjectType()
export class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
export class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
  @Field(() => String, { nullable: true })
  jwt?: String;
}
