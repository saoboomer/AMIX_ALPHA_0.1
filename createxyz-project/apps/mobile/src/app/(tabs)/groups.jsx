import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const [groups] = useState([
    {
      id: '1',
      name: 'Dev Team',
      amiXID: 'DT2wE8kL',
      lastMessage: 'Meeting at 3pm tomorrow',
      timestamp: '1d',
      unreadCount: 1,
      memberCount: 8,
      avatar: 'DT',
    },
    {
      id: '2',
      name: 'Family',
      amiXID: 'FM5kR9vX',
      lastMessage: 'Mom: Don\'t forget about Sunday dinner!',
      timestamp: '2d',
      unreadCount: 0,
      memberCount: 5,
      avatar: 'FM',
    },
    {
      id: '3',
      name: 'Book Club',
      amiXID: 'BC7nQ3wY',
      lastMessage: 'Next book: "The Midnight Library"',
      timestamp: '3d',
      unreadCount: 2,
      memberCount: 12,
      avatar: 'BC',
    },
  ]);

  const handleGroupPress = (group) => {
    console.log('Group pressed:', group.name);
  };

  const handleCreateGroup = () => {
    console.log('Create group pressed');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8EC' }}>
      <StatusBar style="dark" />
      
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 40,
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: '#FFF8EC',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(74, 44, 42, 0.1)',
      }}>
        <Text style={{
          fontSize: 28,
          fontWeight: '700',
          color: '#4A2C2A',
          marginBottom: 4,
        }}>
          Groups
        </Text>
        <Text style={{
          fontSize: 14,
          color: 'rgba(74, 44, 42, 0.7)',
        }}>
          Connect with multiple people securely
        </Text>
      </View>

      {/* Create Group Button */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#FFF1D6',
            borderRadius: 16,
            padding: 16,
            alignItems: 'center',
            borderWidth: 2,
            borderColor: 'rgba(74, 44, 42, 0.1)',
            borderStyle: 'dashed',
          }}
          onPress={handleCreateGroup}
        >
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#4A2C2A',
          }}>
            + Create New Group
          </Text>
        </TouchableOpacity>
      </View>

      {/* Groups List */}
      <ScrollView 
        style={{ flex: 1, paddingHorizontal: 20 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={{
              backgroundColor: '#FFFFFF',
              marginBottom: 12,
              borderRadius: 20,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: 'rgba(0,0,0,0.10)',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            }}
            onPress={() => handleGroupPress(group)}
          >
            {/* Avatar */}
            <View style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#FFF1D6',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16,
            }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#4A2C2A',
              }}>
                {group.avatar}
              </Text>
            </View>

            {/* Content */}
            <View style={{ flex: 1 }}>
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 4,
              }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#4A2C2A',
                  flex: 1,
                }}>
                  {group.name}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: 'rgba(74, 44, 42, 0.5)',
                }}>
                  {group.timestamp}
                </Text>
              </View>
              
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{
                  fontSize: 14,
                  color: 'rgba(74, 44, 42, 0.7)',
                  flex: 1,
                }} numberOfLines={1}>
                  {group.lastMessage}
                </Text>
                
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 12,
                    color: 'rgba(74, 44, 42, 0.5)',
                    marginRight: 8,
                  }}>
                    {group.memberCount} members
                  </Text>
                  
                  {group.unreadCount > 0 && (
                    <View style={{
                      backgroundColor: '#FFF1D6',
                      borderRadius: 10,
                      minWidth: 20,
                      height: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '600',
                        color: '#4A2C2A',
                      }}>
                        {group.unreadCount > 9 ? '9+' : group.unreadCount}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {/* Empty State */}
        {groups.length === 0 && (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 100,
            paddingHorizontal: 32,
          }}>
            <View style={{
              backgroundColor: '#FFF1D6',
              borderRadius: 40,
              padding: 20,
              marginBottom: 24,
            }}>
              <Text style={{
                fontSize: 32,
                color: '#4A2C2A',
              }}>
                👥
              </Text>
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '600',
              color: '#4A2C2A',
              textAlign: 'center',
              marginBottom: 8,
            }}>
              No groups yet, wanna create one?
            </Text>
            <Text style={{
              fontSize: 16,
              color: 'rgba(74, 44, 42, 0.7)',
              textAlign: 'center',
              marginBottom: 32,
            }}>
              Create a group to chat with multiple people securely
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#FFF1D6',
                borderRadius: 20,
                paddingVertical: 12,
                paddingHorizontal: 24,
              }}
              onPress={handleCreateGroup}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#4A2C2A',
              }}>
                Create Group
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}