'use client';
import { Box, Button, Heading, HStack, Input, List, ListItem, Spinner, Text, VStack, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Badge } from '@chakra-ui/react';
import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../utils/db';
import { useUser } from '../../hooks/useUser';
import { useCrypto } from '../../hooks/useCrypto';
import { usePeers } from '../../hooks/usePeers';
import { generateSafetyNumber } from '../../utils/crypto';

function FriendChatHistory({ friendEmail, userEmail }) {
  const messagesEndRef = useRef(null);
  const chatHistory = useLiveQuery(() =>
    db.directMessages
      .where('recipientEmail').anyOf(friendEmail, userEmail)
      .and(record => [friendEmail, userEmail].includes(record.senderId))
      .sortBy('timestamp'),
    [friendEmail, userEmail]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  return (
    <Box h="200px" overflowY="auto" p={2} borderWidth={1} rounded="md" mt={2}>
      <List spacing={3}>
        {chatHistory?.map((m) => (
          <ListItem key={m.id} alignSelf={m.senderId === userEmail ? 'flex-end' : 'flex-start'}>
            <Box
              bg={m.senderId === userEmail ? 'teal.500' : 'gray.600'}
              color="white"
              px={3}
              py={1}
              rounded="lg"
              maxW="80%"
              ml={m.senderId === userEmail ? 'auto' : '0'}
              mr={m.senderId !== userEmail ? 'auto' : '0'}
            >
              <Text>{m.content}</Text>
            </Box>
          </ListItem>
        ))}
        <div ref={messagesEndRef} />
      </List>
    </Box>
  );
}

export default function FriendsPage() {
  const { user, isReady: userReady } = useUser();
  const { keys, isReady: cryptoReady } = useCrypto();

  const handleIncomingMessage = (message) => {
    db.directMessages.add(message);
  };

    const { peers, publicKeys, connectToPeer, sendMessage } = usePeers(user, keys, handleIncomingMessage);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [safetyNumber, setSafetyNumber] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
    const [messages, setMessages] = useState({}); // State for individual friend messages

  const friends = useLiveQuery(() => db.friends.toArray(), []);

    const handleAdd = async () => {
    if (!friendEmail) return;
    await db.friends.add({ email: friendEmail, verified: 0 });
    setFriendEmail('');
  };

  const handleVerify = async (friend) => {
    const friendPublicKey = publicKeys[friend.email];
    if (keys.publicKeyJwk && friendPublicKey) {
      const num = await generateSafetyNumber(keys.publicKeyJwk, friendPublicKey);
      setSafetyNumber(num);
      setSelectedFriend(friend);
      onOpen();
    }
  };

  const markAsVerified = async () => {
    if (selectedFriend) {
      await db.friends.update(selectedFriend.id, { verified: 1 });
      onClose();
    }
  };

  const handleSend = (friend) => {
    if (!friend.verified) {
      console.log('Friend not verified, cannot send message.');
      return;
    }
    const content = messages[friend.email];
    if (!content) return;

    const messagePayload = {
      recipientEmail: friend.email,
      senderId: user.email,
      content,
      timestamp: new Date(),
    };

    sendMessage(friend.email, JSON.stringify(messagePayload));
    db.directMessages.add(messagePayload);
    setMessages((prev) => ({ ...prev, [friend.email]: '' }));
  };

  const isReady = userReady && cryptoReady;

  return (
    <Box maxW="3xl" mx="auto" mt={8} px={4}>
      <Heading size="lg" mb={4}>Your Friends</Heading>
      {user && <Text mb={4}>Your email for signaling: {user.email}</Text>}

      <HStack mb={6}>
        <Input placeholder="Friend's email" value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} />
        <Button colorScheme="teal" onClick={handleAdd}>Add</Button>
      </HStack>

      {!isReady ? (
        <Spinner />
      ) : (
        <List spacing={3}>
          {friends?.map((f) => (
                        <ListItem key={f.id} bg="gray.700" p={3} rounded="md">
              <VStack align="stretch">
                <HStack justifyContent="space-between">
                                    <HStack>
                    <Text fontWeight="bold">{f.email}</Text>
                    {f.verified ? <Badge colorScheme="green">Verified</Badge> : <Badge colorScheme="red">Unverified</Badge>}
                  </HStack>
                                    <HStack>
                    {peers[f.email]?.peer.connected && !f.verified && (
                      <Button size="sm" colorScheme="orange" onClick={() => handleVerify(f)}>Verify</Button>
                    )}
                    <Button size="sm" onClick={() => connectToPeer(f)} isDisabled={peers[f.email]?.peer.connected}>
                    {peers[f.email]?.peer.connected ? 'Connected' : 'Connect'}
                  </Button>
                </HStack>
                {peers[f.email]?.peer.connected && (
                  <>
                    <FriendChatHistory friendEmail={f.email} userEmail={user.email} />
                    <HStack mt={2}>
                      <Input
                        placeholder={f.verified ? "Send a message" : "Verify to send messages"}
                        value={messages[f.email] || ''}
                        onChange={(e) => setMessages((prev) => ({ ...prev, [f.email]: e.target.value }))}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend(f)}
                        isDisabled={!f.verified}
                      />
                      <Button size="sm" onClick={() => handleSend(f)} isDisabled={!f.verified}>Send</Button>
                    </HStack>
                  </>
                )}
              </VStack>
            </ListItem>
          ))}
          {friends?.length === 0 && <Text color="gray.400">No friends yet</Text>}
        </List>
      )}

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Verify Identity of {selectedFriend?.email}</ModalHeader>
          <ModalBody>
            <Text>Compare this safety number with your friend to ensure the connection is secure. It should be identical on both of your screens.</Text>
            <Text fontSize="2xl" fontWeight="bold" textAlign="center" my={4}>{safetyNumber}</Text>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="green" onClick={markAsVerified}>Mark as Verified</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
