import { Box, Flex, Link as ChakraLink, Button, Heading } from '@chakra-ui/react';
import { Link, useLocation } from 'react-router-dom';

function NavItem({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <ChakraLink
      as={Link}
      to={to}
      px={3}
      py={2}
      rounded="md"
      fontWeight={isActive ? 'bold' : 'normal'}
      _hover={{ textDecoration: 'none', bg: 'gray.700' }}
      bg={isActive ? 'gray.700' : 'transparent'}
      color="white"
    >
      {children}
    </ChakraLink>
  );
}

export default function NavBar() {
  return (
    <Box bg="gray.800" px={4}>
      <Flex h={14} alignItems="center" justifyContent="space-between" maxW="6xl" mx="auto">
        <Heading size="md" color="white">
          create-anything
        </Heading>
        <Flex gap={2} alignItems="center">
          <NavItem to="/groups">Groups</NavItem>
          <NavItem to="/friends">Friends</NavItem>
          <NavItem to="/">Home</NavItem>
        </Flex>
      </Flex>
    </Box>
  );
}
