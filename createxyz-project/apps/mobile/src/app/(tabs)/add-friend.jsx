import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddFriendScreen() {
  const insets = useSafeAreaInsets();
  const [friendAmiXID, setFriendAmiXID] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const addFriend = async () => {
    if (!friendAmiXID.trim()) {
      Alert.alert('Error', 'Please enter a valid AmiX ID');
      return;
    }

    setIsAdding(true);
    try {
      // Demo functionality
      Alert.alert(
        'Success',
        'Friend added successfully! (Demo mode)',
        [
          { text: 'OK', onPress: () => setFriendAmiXID('') }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add friend. Please check the AmiX ID.');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8EC' }}>
      <StatusBar style="dark" />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: 20,
        }}
      >
        <View style={{ marginBottom: 40 }}>
          <Text style={{
            fontSize: 28,
            fontWeight: '700',
            color: '#4A2C2A',
            marginBottom: 8,
          }}>
            Add Friend
          </Text>
          <Text style={{
            fontSize: 16,
            color: 'rgba(74, 44, 42, 0.7)',
          }}>
            Connect with friends using their AmiX ID
          </Text>
        </View>

        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 24,
          marginBottom: 24,
          shadowColor: 'rgba(0,0,0,0.10)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 12,
          }}>
            Enter AmiX ID
          </Text>
          
          <TextInput
            style={{
              borderWidth: 1,
              borderColor: 'rgba(74, 44, 42, 0.2)',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              color: '#4A2C2A',
              backgroundColor: '#FFFFFF',
            }}
            placeholder="Enter friend's AmiX ID"
            placeholderTextColor="rgba(74, 44, 42, 0.5)"
            value={friendAmiXID}
            onChangeText={setFriendAmiXID}
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          <TouchableOpacity
            style={{
              backgroundColor: '#FFF1D6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
              marginTop: 16,
            }}
            onPress={addFriend}
            disabled={isAdding}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#4A2C2A',
            }}>
              {isAdding ? 'Adding...' : 'Add Friend'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{
          backgroundColor: '#FFF1D6',
          borderRadius: 20,
          padding: 24,
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 12,
          }}>
            Your AmiX ID
          </Text>
          <Text style={{
            fontSize: 14,
            color: 'rgba(74, 44, 42, 0.7)',
            marginBottom: 16,
          }}>
            Share this ID with friends so they can add you
          </Text>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: 'rgba(74, 44, 42, 0.1)',
          }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#4A2C2A',
              textAlign: 'center',
            }}>
              DEMO123
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}