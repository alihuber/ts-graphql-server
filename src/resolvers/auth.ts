import { User } from '../entities/user';
import { MyContext, UserResponse } from '../types';
import { decodeToken, generateJwt } from '../utils/jwtUtils';
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
import { getLogger } from '../utils/Logger';
import { v4 } from 'uuid';

const logger = getLogger('AuthResolver');

@Resolver(User)
export class AuthResolver {
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
    logger.info({
      message: `Got change password request with token ${token}`,
    });
    if (newPassword.length <= 3) {
      logger.warn({
        message: `Change password error for token ${token}, password too short`,
      });
      return {
        errors: [
          { field: 'newPassword', message: 'password must be greater than 3' },
        ],
      };
    }
    const key = FORGOT_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      logger.warn({
        message: `Change password error for token ${token}, token expired`,
      });
      return { errors: [{ field: 'token', message: 'token expired' }] };
    }
    const id = parseInt(userId, 10);
    const user = await User.findOneBy({ id });
    if (!user) {
      logger.warn({
        message: `Change password error for token ${token}, user with ${userId} not found`,
      });
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
    logger.info({
      message: `Got forgot password request with email ${email}`,
    });
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // not found
      logger.warn({
        message: `Forgot password error with ${email}: user not found`,
      });
      return true;
    }
    const token = v4();
    await redis.set(
      FORGOT_PASSWORD_PREFIX + token,
      user.id,
      'EX',
      1000 * 60 * 60 * 24 * 3 // 3 days
    );
    logger.info({
      message: `Password for user with ${user.id} reset, sending email...`,
    });
    sendEmail(
      email,
      `<a href="http://${process.env.CORS_ORIGIN}/change-password/${token}">reset password</a>`
    );
    return true;
  }

  @Query(() => User, { nullable: true })
  async me(@Ctx() context: MyContext): Promise<User | null> {
    if (context.req?.headers?.origin === 'capacitor://localhost') {
      return this.getMobileMe(context);
    } else {
      return this.getMe(context);
    }
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('options') options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    logger.info({
      message: `Got register request with username: ${options.username}, email: ${options.email}`,
    });
    const errors = validateRegister(options);
    if (errors) {
      logger.warn({
        message: `Register error with username: ${options.username}, email: ${
          options.email
        }, error: ${JSON.stringify(errors)}`,
      });
      return { errors };
    }
    const hashedPassword = await argon.hash(options.password);

    let user;
    try {
      user = await User.create({
        username: options.username,
        password: hashedPassword,
        email: options.email,
        admin: false,
      }).save();
    } catch (e) {
      logger.warn({
        message: `Register error with username: ${options.username}, email: ${options.email}, save error: ${e.message}`,
      });
      return {
        errors: [
          {
            field: 'username',
            message: 'user could not be created',
          },
        ],
      };
    }
    let jwt;
    if (user) {
      if (req?.headers?.origin === 'capacitor://localhost') {
        jwt = await generateJwt(user.id, user.username, user.email);
      } else {
        req.session.userId = user.id;
      }
    }
    return {
      user,
      jwt,
    };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('usernameOrEmail') usernameOrEmail: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    logger.info({
      message: `Got login request with usernameOrEmail: ${usernameOrEmail}`,
    });
    const user = await User.findOne(
      usernameOrEmail.includes('@')
        ? { where: { email: usernameOrEmail } }
        : { where: { username: usernameOrEmail } }
    );
    const valid = user && (await argon.verify(user.password, password));
    if (!user || !valid) {
      logger.warn({
        message: `Login error with usernameOrEmail: ${usernameOrEmail}`,
      });
      return {
        errors: [
          {
            field: 'usernameOrEmail',
            message: 'invalid username/password combination',
          },
        ],
      };
    }
    if (req?.headers?.origin === 'capacitor://localhost') {
      const jwt = await generateJwt(user.id, user.username, user.email);
      return {
        user,
        jwt,
      };
    } else {
      req.session.userId = user.id;
      return {
        user,
      };
    }
  }

  @Mutation(() => Boolean)
  logout(@Ctx() context: MyContext): Promise<boolean> {
    if (context.req?.headers?.origin === 'capacitor://localhost') {
      return this.handleMobileLogout(context);
    } else {
      return this.handleLogout(context);
    }
  }

  private async getMe(context: MyContext): Promise<User | null> {
    logger.info({
      message: `Got me query for ${context.req.session.userId}`,
    });
    if (!context.req.session.userId) {
      logger.warn({
        message: 'Me query error: no session id',
      });
      return null;
    }
    return await User.findOneBy({ id: context.req.session.userId });
  }

  private async getMobileMe(context: MyContext): Promise<User | null> {
    try {
      const decoded = await decodeToken(context);
      if (decoded) {
        return await User.findOneBy({ id: decoded.id });
      } else return null;
    } catch (err) {
      logger.warn({
        message: 'Me query error: could not verify token: ' + err.message,
      });
      return null;
    }
  }

  private handleMobileLogout(context: MyContext): Promise<boolean> {
    return new Promise(async (resolve) => {
      try {
        const decoded = await decodeToken(context);
        if (decoded) {
          // TODO: nothing yet, remove token from known tokens etc.
          logger.info({
            message: `Got logout request for: ${decoded.id}`,
          });
          resolve(true);
        }
      } catch (err) {
        logger.warn({
          message: 'Logout error: could not verify token: ' + err.message,
        });
        resolve(false);
      }
    });
  }

  private handleLogout({ req, res }: MyContext): Promise<boolean> {
    logger.info({
      message: `Got logout request for: ${req.session.userId}`,
    });
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          logger.warn({
            message: `Logout error with: ${req.session.userId}, error: ${err.message}`,
          });
          resolve(false);
          return;
        }
        resolve(true);
      })
    );
  }
}
