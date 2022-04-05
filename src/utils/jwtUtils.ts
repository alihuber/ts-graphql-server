import { DecodedToken, MyContext } from 'src/types';

const jwt = require('jsonwebtoken');

export const generateJwt = (
  id: Number,
  username: String,
  email: String
): Promise<string> => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  return new Promise((resolve, reject) => {
    jwt.sign(
      {
        id: id,
        username: username,
        email: email,
        exp: expiry.getTime() / 1000,
      },
      process.env.TOKEN_SECRET,
      (err: Error, res: string) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      }
    );
  });
};

export const decodeToken = (
  context: MyContext
): Promise<DecodedToken | null> => {
  const authHeader = context.req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      process.env.TOKEN_SECRET,
      (err: Error, res: DecodedToken) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      }
    );
  });
};
