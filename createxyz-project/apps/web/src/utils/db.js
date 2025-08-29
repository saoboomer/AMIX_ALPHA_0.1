import Dexie from 'dexie';

export const db = new Dexie('chatApp');

db.version(1).stores({
  users: '++id, &email',
  friends: '++id, &email, verified',
  groups: '++id, &name',
  messages: '++id, groupId, timestamp',
  directMessages: '++id, &recipientEmail, timestamp',
  cryptoKeys: '++id, &name',
  ratchetStates: '&recipientEmail, rootKey, sendChain, receiveChain', // For forward secrecy
});
