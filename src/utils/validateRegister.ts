import { FieldError } from '../types';
import { UsernamePasswordInput } from '../resolvers/UsernamePasswordInput';

export const validateRegister = (
  options: UsernamePasswordInput
): FieldError[] | null => {
  if (options.username.length <= 2) {
    return [{ field: 'username', message: 'username must be greater than 2' }];
  }
  if (options.password.length <= 3) {
    return [{ field: 'password', message: 'password must be greater than 3' }];
  }
  if (!options.email.includes('@')) {
    return [{ field: 'email', message: 'invalid email' }];
  }
  if (options.username.includes('@')) {
    return [{ field: 'username', message: 'cannot include @' }];
  }
  return null;
};
