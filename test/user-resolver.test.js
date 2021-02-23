/* eslint-disable @typescript-eslint/no-var-requires */
const { createTestClient } = require('apollo-server-testing');
const {
  resetDatabase,
  constructTestServer,
  getConnection,
  closeConnection,
} = require('./utils');
const { describe, it, expect } = require('@jest/globals');
const gql = require('graphql-tag');
const argon = require('argon2');
const { User } = require('../dist/entities/user');
const {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  UsernamePasswordInput,
} = require('../dist/resolvers/UsernamePasswordInput');

const ME_QUERY = gql`
  query Me {
    me {
      username
      email
    }
  }
`;

const REGISTER_MUTATION = gql`
  mutation register($options: UsernamePasswordInput!) {
    register(options: $options) {
      errors {
        message
      }
      user {
        id
        username
        email
      }
    }
  }
`;

const LOGIN_MUTATION = gql`
  mutation login($usernameOrEmail: String!, $password: String!) {
    login(usernameOrEmail: $usernameOrEmail, password: $password) {
      errors {
        message
      }
      user {
        id
        username
        email
      }
    }
  }
`;

const LOGOUT_MUTATION = gql`
  mutation Logout {
    logout
  }
`;

const CHANGE_PASSWORD_MUTATION = gql`
  mutation changePassword($token: String!, $newPassword: String!) {
    changePassword(token: $token, newPassword: $newPassword) {
      errors {
        message
      }
      user {
        id
        username
        email
      }
    }
  }
`;

const FORGOT_PASSWORD_MUTATION = gql`
  mutation forgotPassword($email: String!) {
    forgotPassword(email: $email)
  }
`;

describe('me query', () => {
  it('returns null with no session', async () => {
    await resetDatabase();
    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: {} },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: ME_QUERY });

    expect(res.data.me).toBe(null);
  });

  it('returns user data for user in session', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();

    const { server } = await constructTestServer({
      context: () => ({
        user: { id: 1, username: 'user' },
        req: { session: { userId: 1 } },
      }),
    });
    const { query } = createTestClient(server);

    const res = await query({ query: ME_QUERY });

    expect(res.data.me).toEqual({
      username: 'user',
      email: 'user@example.com',
    });
    await closeConnection(connection);
  });
});

describe('register mutation', () => {
  it('returns errors on username already taken', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'user',
          password: 'newpassword',
          email: 'foo@bar.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual(
      'user could not be created'
    );
    await closeConnection(connection);
  });

  it('returns errors on email already taken', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();

    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'other user',
          password: 'newpassword',
          email: 'user@example.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual(
      'user could not be created'
    );
    await closeConnection(connection);
  });

  it('returns errors on email not valid', async () => {
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'username',
          password: 'newpassword',
          email: 'userexample.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual('invalid email');
  });

  it('returns errors on password too short', async () => {
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'username',
          password: 'np',
          email: 'user@example.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual(
      'password must be greater than 3'
    );
  });

  it('returns errors on username too short', async () => {
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'u',
          password: 'newpassword',
          email: 'user@example.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual(
      'username must be greater than 2'
    );
  });

  it('returns errors on username invalid', async () => {
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'user@foo',
          password: 'newpassword',
          email: 'user@example.com',
        },
      },
    });

    expect(res.data.register.errors[0].message).toEqual('cannot include @');
  });

  it('returns user on successful register, creates session', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const req = { session: {} };
    const { server } = await constructTestServer({
      context: () => ({
        req,
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: REGISTER_MUTATION,
      variables: {
        options: {
          username: 'newuser',
          password: 'newpassword',
          email: 'foo@example.com',
        },
      },
    });

    expect(res.data).toEqual({
      register: {
        errors: null,
        user: { id: 1, username: 'newuser', email: 'foo@example.com' },
      },
    });

    expect(req).toEqual({ session: { userId: 1 } });
    await closeConnection(connection);
  });
});

describe('logout mutation', () => {
  it('returns false on error', async () => {
    const req = {
      session: {
        destroy: (cb) => {
          cb('error');
        },
      },
    };
    const res = {
      clearCookie: () => {
        // nothing
      },
    };
    const { server } = await constructTestServer({
      context: () => ({
        req,
        res,
      }),
    });

    const { mutate } = createTestClient(server);
    const result = await mutate({
      mutation: LOGOUT_MUTATION,
    });

    expect(result.data.logout).toBe(false);
  });

  it('returns true on success', async () => {
    const req = {
      session: {
        destroy: (cb) => {
          cb();
        },
      },
    };
    const res = {
      clearCookie: () => {
        // nothing
      },
    };
    const { server } = await constructTestServer({
      context: () => ({
        req,
        res,
      }),
    });
    const { mutate } = createTestClient(server);

    const result = await mutate({
      mutation: LOGOUT_MUTATION,
    });

    expect(result.data.logout).toBe(true);
  });
});

describe('login mutation', () => {
  it('returns errors on wrong credentials', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const hashedPassword = await argon.hash('abc123');
    await User.create({
      username: 'user',
      password: hashedPassword,
      email: 'user@example.com',
    }).save();
    const req = { session: {} };
    const { server } = await constructTestServer({
      context: () => ({
        req,
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: LOGIN_MUTATION,
      variables: {
        usernameOrEmail: 'user',
        password: 'abc1234',
      },
    });

    expect(res.data.login.errors[0].message).toEqual(
      'invalid username/password combination'
    );
    await closeConnection(connection);
  });

  it('returns user on successful login, creates session', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const hashedPassword = await argon.hash('abc123');
    await User.create({
      username: 'user',
      password: hashedPassword,
      email: 'user@example.com',
    }).save();
    const req = { session: {} };
    const { server } = await constructTestServer({
      context: () => ({
        req,
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: LOGIN_MUTATION,
      variables: {
        usernameOrEmail: 'user',
        password: 'abc123',
      },
    });

    expect(res.data).toEqual({
      login: {
        errors: null,
        user: { id: 1, username: 'user', email: 'user@example.com' },
      },
    });

    expect(req).toEqual({ session: { userId: 1 } });
    await closeConnection(connection);
  });

  it('allows login with email', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const hashedPassword = await argon.hash('abc123');
    await User.create({
      username: 'user',
      password: hashedPassword,
      email: 'user@example.com',
    }).save();
    const req = { session: {} };
    const { server } = await constructTestServer({
      context: () => ({
        req,
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: LOGIN_MUTATION,
      variables: {
        usernameOrEmail: 'user@example.com',
        password: 'abc123',
      },
    });

    expect(res.data).toEqual({
      login: {
        errors: null,
        user: { id: 1, username: 'user', email: 'user@example.com' },
      },
    });
    expect(req).toEqual({ session: { userId: 1 } });
    await closeConnection(connection);
  });
});

describe('change password mutation', () => {
  it('returns errors on password too short', async () => {
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CHANGE_PASSWORD_MUTATION,
      variables: {
        token: 'abc123',
        newPassword: 'np',
      },
    });

    expect(res.data.changePassword.errors[0].message).toEqual(
      'password must be greater than 3'
    );
  });

  it('returns errors on no token entry', async () => {
    const { server } = await constructTestServer({
      context: () => ({
        redis: {
          get: () => {
            return null;
          },
        },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CHANGE_PASSWORD_MUTATION,
      variables: {
        token: 'abc123',
        newPassword: 'newpassword',
      },
    });

    expect(res.data.changePassword.errors[0].message).toEqual('token expired');
  });

  it('returns errors on user not found', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({
        redis: {
          get: () => {
            return 3;
          },
        },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CHANGE_PASSWORD_MUTATION,
      variables: {
        token: 'abc123',
        newPassword: 'newpassword',
      },
    });

    expect(res.data.changePassword.errors[0].message).toEqual(
      'user does no longer exist'
    );
    await closeConnection(connection);
  });

  it('returns user on successful change password, creates session', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const hashedPassword = await argon.hash('abc123');
    await User.create({
      username: 'user',
      password: hashedPassword,
      email: 'user@example.com',
    }).save();
    const req = { session: {} };
    const { server } = await constructTestServer({
      context: () => ({
        req,
        redis: {
          get: () => {
            return 1;
          },
          del: () => {
            return true;
          },
        },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: CHANGE_PASSWORD_MUTATION,
      variables: {
        token: 'abc123',
        newPassword: 'newpassword',
      },
    });

    expect(res.data).toEqual({
      changePassword: {
        errors: null,
        user: { id: 1, username: 'user', email: 'user@example.com' },
      },
    });
    expect(req).toEqual({ session: { userId: 1 } });
    await closeConnection(connection);
  });
});

describe('forgot password mutation', () => {
  it('returns true when user not found', async () => {
    await resetDatabase();
    const connection = await getConnection();
    const { server } = await constructTestServer({
      context: () => ({}),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: FORGOT_PASSWORD_MUTATION,
      variables: {
        email: 'foo@bar.com',
      },
    });

    expect(res.data.forgotPassword).toBe(true);
    await closeConnection(connection);
  });

  it('returns true when reset successful', async () => {
    await resetDatabase();
    const connection = await getConnection();
    await User.create({
      username: 'user',
      password: 'abc123',
      email: 'user@example.com',
    }).save();
    const { server } = await constructTestServer({
      context: () => ({
        redis: {
          set: () => {
            return true;
          },
        },
      }),
    });
    const { mutate } = createTestClient(server);

    const res = await mutate({
      mutation: FORGOT_PASSWORD_MUTATION,
      variables: {
        email: 'user@example.com',
      },
    });

    expect(res.data.forgotPassword).toBe(true);
    await closeConnection(connection);
  });
});
