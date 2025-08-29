import { useState, useEffect } from 'react';
import { db } from '../utils/db';
import { generateKeyPair } from '../utils/crypto';

const KEY_NAME = 'user-key-pair';

export function useCrypto() {
  const [keys, setKeys] = useState(null);

  const isReady = useLiveQuery(async () => {
    let keyPair = await db.cryptoKeys.get({ name: KEY_NAME });
    if (!keyPair) {
      console.log('No key pair found, generating a new one...');
      const newKeys = await generateKeyPair();
      await db.cryptoKeys.add({ 
        name: KEY_NAME, 
        privateKey: newKeys.privateKey, 
        publicKey: newKeys.publicKey, 
        publicKeyJwk: newKeys.publicKeyJwk 
      });
      keyPair = await db.cryptoKeys.get({ name: KEY_NAME });
    }
    setKeys(keyPair);
    return true;
  }, [], false);

  return { keys, isReady: !!isReady };
}
