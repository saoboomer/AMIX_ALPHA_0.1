import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../utils/db';

// For demo purposes, we'll use a default user.
// In a real app, you'd have a login/signup flow.
const DEFAULT_EMAIL = `user-${Math.random().toString(36).substring(2, 9)}@demo.local`;

export function useUser() {
  const user = useLiveQuery(async () => {
    let user = await db.users.toCollection().first();
    if (!user) {
      console.log('No user found, creating a default one...');
      const newUser = { email: DEFAULT_EMAIL, name: 'Demo User' };
      await db.users.add(newUser);
      return newUser;
    }
    return user;
  }, []);

  return { user, isReady: !!user };
}
