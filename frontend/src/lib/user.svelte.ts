import { getUser } from './auth';
import type { AuthUser } from './auth';

function createUserState() {
  let user = $state<AuthUser | null>(getUser());
  return {
    get user() { return user; },
    refresh() { user = getUser(); },
  };
}

export const userState = createUserState();
