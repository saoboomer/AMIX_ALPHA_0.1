import { Box, Button, Heading, HStack, Input, List, ListItem, Spinner, Text, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, Link } from '@chakra-ui/react';
import NextLink from 'next/link';
import { useState } from 'react';
import { useGroups, useCreateGroup, useInviteToGroup } from '../../utils/groups';

export default function GroupsPage() {
  // TODO: replace with real auth user id
  const userId = 'demo-user-id';

  const handleCreate = async () => {
    if (!groupName) return;
    await db.groups.add({ name: groupName, members: [] });
    setGroupName('');
  };

  return (
    <Box maxW="3xl" mx="auto" mt={8} px={4}>
      <Heading size="lg" mb={4}>Your Groups</Heading>

      <HStack mb={6}>
        <Input placeholder="New group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        <Button colorScheme="teal" onClick={handleCreate}>Create</Button>
      </HStack>

      {!groups ? (
        <Spinner />
      ) : (
        <List spacing={3}>
          {groups.map((g) => (
            <ListItem key={g.id} bg="gray.700" p={3} rounded="md">
              <Link href={`/groups/${g.id}`}>
                <Text>{g.name}</Text>
              </Link>
            </ListItem>
          ))}
          {groups.length === 0 && <Text color="gray.400">No groups yet</Text>}
        </List>
      )}
      <Modal isOpen={inviteModal.isOpen} onClose={inviteModal.onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Invite to group</ModalHeader>
          <ModalBody>
            <Input placeholder="Friend's email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={inviteModal.onClose}>Cancel</Button>
            <Button colorScheme="teal" onClick={handleInvite} isLoading={inviteMutation.isPending}>Send Invite</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
