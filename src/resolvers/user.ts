import { User } from '../entities/user';
import { MyContext, UserResponse } from '../types';
import { COOKIE_NAME, FORGOT_PASSWORD_PREFIX } from '../constants';
import {
  Arg,
  Ctx,
  FieldResolver,
  Mutation,
  Query,
  Resolver,
  Root,
} from 'type-graphql';
import argon from 'argon2';
import { UsernamePasswordInput } from './UsernamePasswordInput';
import { validateRegister } from '../utils/validateRegister';
import { sendEmail } from '../utils/sendEmail';
import { v4 } from 'uuid';

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User, @Ctx() { req }: MyContext): string | null {
    if (req.session.userId === user.id) {
      return user.email;
    }
    return '';
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    if (newPassword.length <= 3) {
      return {
        errors: [
          { field: 'newPassword', message: 'password must be greater than 3' },
        ],
      };
    }
    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return { errors: [{ field: 'token', message: 'token expired' }] };
    }
    const id = parseInt(userId, 10);
    const user = await User.findOne(id);
    if (!user) {
      return {
        errors: [{ field: 'token', message: 'user does no longer exist' }],
      };
    }
    await User.update(id, { password: await argon.hash(newPassword) });
    await redis.del(key);
    req.session.userId = user.id;
    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Ctx() { redis }: MyContext,
    @Arg('email') email: string
  ): Promise<boolean> {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // not found
      return true;
    }
    const token = v4();
    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      'ex',
      1000 * 60 * 60 * 24 * 3 // 3 days
    );
    // TODO: real domain
    sendEmail(
      email,
      `<a href="http://localhost:3000/change-password/${token}">reset password</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() { req }: MyContext): Promise<User | undefined> {
    if (!req.session.userId) {
      return undefined;
    }
    return await User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = validateRegister(options);
    if (errors) {
      return { errors };
    }
    const hashedPassword = await argon.hash(options.password);

    let user;
    try {
      user = await User.create({
        username: options.username,
        password: hashedPassword,
        email: options.email,
      }).save();
    } catch (e) {
      return {
        errors: [
          {
            field: 'username',
            message: 'user could not be created',
          },
        ],
      };
    }
    if (user) {
      req.session.userId = user.id;
    }
    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    const valid = user && (await argon.verify(user.password, password));
    if (!user || !valid) {
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: 'invalid username/password combination',
          },
        ],
      };
    }
    req.session.userId = user.id;
    return {
      user,
    };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext): Promise<boolean> {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
