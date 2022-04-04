const jwt = require('jsonwebtoken');

export const generateJwt = (id: Number, username: String, email: String) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

  return jwt.sign(
    {
      id: id,
      username: username,
      email: email,
      exp: expiry.getTime() / 1000,
    },
    process.env.TOKEN_SECRET
  );
};
