'use client';
import { Box, Button, Heading, HStack, Input, List, ListItem, Spinner, Text, VStack, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@chakra-ui/react';
import { useEffect, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../utils/db';
import { useUser } from '../../hooks/useUser';
import { useCrypto } from '../../hooks/useCrypto';
import { usePeers } from '../../hooks/usePeers';

export default function GroupChatPage({ params }) {
  const { groupId } = params;
  const { user, isReady: userReady } = useUser();
  const { keys, isReady: cryptoReady } = useCrypto();

  const handleIncomingMessage = (message) => {
    if (message.groupId === parseInt(groupId)) {
      db.messages.add(message);
    }
  };

  const { peers, connectToPeer, sendMessage } = usePeers(user, keys, handleIncomingMessage);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [inviteEmail, setInviteEmail] = useState('');

  const group = useLiveQuery(() => db.groups.get(parseInt(groupId)), [groupId]);
  const messages = useLiveQuery(() => db.messages.where('groupId').equals(parseInt(groupId)).sortBy('timestamp'), [groupId]);
  const friends = useLiveQuery(() => db.friends.toArray(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage || !group) return;

    const message = {
      groupId: group.id,
      senderId: user.email,
      content: newMessage,
      timestamp: new Date(),
    };

    await db.messages.add(message);

    // Send to all connected members
    group.members.forEach((email) => {
      if (peers[email]?.peer.connected) {
        sendMessage(email, JSON.stringify(message));
      }
    });

    setNewMessage('');
  };

  const handleInvite = async () => {
    if (!inviteEmail || !group) return;
    await db.groups.update(group.id, { members: [...group.members, inviteEmail] });
    onClose();
  };

  const isReady = userReady && cryptoReady;

  return (
    <Box maxW="4xl" mx="auto" mt={8} px={4}>
      <HStack justifyContent="space-between" mb={4}>
        <Heading size="lg">{group?.name || 'Group Chat'}</Heading>
        <Button onClick={onOpen}>Invite Friend</Button>
      </HStack>

      <VStack spacing={4} align="stretch">
        <Box h="500px" overflowY="auto" p={4} borderWidth={1} rounded="md">
          {!isReady || !messages ? (
            <Spinner />
          ) : (
            <List spacing={3}>
              {messages.map((m) => (
                <ListItem key={m.id} alignSelf={m.senderId === user?.email ? 'flex-end' : 'flex-start'}>
                  <Box
                    bg={m.senderId === user?.email ? 'teal.500' : 'gray.600'}
                    color="white"
                    px={3}
                    py={1}
                    rounded="lg"
                    maxW="80%"
                  >
                    <Text fontSize="sm" color="gray.300">{m.senderId}</Text>
                    <Text>{m.content}</Text>
                  </Box>
                </ListItem>
              ))}
              <div ref={messagesEndRef} />
            </List>
          )}
        </Box>
        <HStack>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          />
          <Button colorScheme="teal" onClick={handleSend}>Send</Button>
        </HStack>
      </VStack>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invite a friend to {group?.name}</ModalHeader>
          <ModalBody>
            <Input placeholder="Friend's email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleInvite}>Invite</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
