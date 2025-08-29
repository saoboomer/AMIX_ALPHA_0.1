import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="[id]" 
        options={{ 
          headerShown: false,
          animation: 'slide_from_right'
        }} 
      />
      <Stack.Screen 
        name="test" 
        options={{ 
          title: 'Chat Tests',
          headerShown: true,
          animation: 'slide_from_bottom'
        }} 
      />
    </Stack>
  );
}
