import React from 'react';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { View, Text, StyleSheet } from 'react-native';
import FriendSearch from '../../components/FriendSearch';
import FriendRequests from '../../components/FriendRequests';
import { useFriendRequests } from '../../hooks/useFriendRequests';

const Tab = createMaterialTopTabNavigator();

const FriendsScreen = () => {
  const { pendingCount } = useFriendRequests();
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarLabelStyle: styles.tabLabel,
        tabBarIndicatorStyle: styles.tabIndicator,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tab.Screen 
        name="Search" 
        component={FriendSearch} 
        options={{ title: 'Add Friends' }}
      />
      <Tab.Screen 
        name="Requests" 
        component={FriendRequests} 
        options={{
          title: 'Requests',
          tabBarBadge: pendingCount > 0 ? () => (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {pendingCount > 9 ? '9+' : pendingCount}
              </Text>
            </View>
          ) : undefined,
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'none',
  },
  tabIndicator: {
    backgroundColor: '#007AFF',
    height: 3,
  },
  tabBar: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  badge: {
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default FriendsScreen;
