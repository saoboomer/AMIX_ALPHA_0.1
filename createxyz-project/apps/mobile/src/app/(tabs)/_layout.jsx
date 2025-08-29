import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "react-native";
import FriendsScreen from "./friends";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: 'rgba(74, 44, 42, 0.1)',
          paddingBottom: insets.bottom,
          paddingTop: 8,
          height: 60 + insets.bottom,
        },
        tabBarActiveTintColor: '#4A2C2A',
        tabBarInactiveTintColor: 'rgba(74, 44, 42, 0.5)',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20, 
              color: color,
              opacity: focused ? 1 : 0.6,
            }}>
              💬
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: "Groups",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20, 
              color: color,
              opacity: focused ? 1 : 0.6,
            }}>
              🏠
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        component={FriendsScreen}
        options={{
          title: "Friends",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20, 
              color: color,
              opacity: focused ? 1 : 0.6,
            }}>
              👥
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <Text style={{ 
              fontSize: 20, 
              color: color,
              opacity: focused ? 1 : 0.6,
            }}>
              👤
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
