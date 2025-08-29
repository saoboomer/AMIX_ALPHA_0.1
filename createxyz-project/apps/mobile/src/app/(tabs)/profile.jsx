import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive' }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive' }
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF8EC' }}>
      <StatusBar style="dark" />
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 40,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#FFF1D6',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <Text style={{
              fontSize: 32,
              fontWeight: '700',
              color: '#4A2C2A',
            }}>
              U
            </Text>
          </View>
          
          <Text style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#4A2C2A',
            marginBottom: 4,
          }}>
            Demo User
          </Text>
          
          <Text style={{
            fontSize: 14,
            color: 'rgba(74, 44, 42, 0.7)',
          }}>
            DEMO123
          </Text>
        </View>

        {/* Settings Sections */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 16,
          }}>
            Settings
          </Text>
          
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(74, 44, 42, 0.1)',
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Notifications
              </Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: 'rgba(74, 44, 42, 0.2)', true: '#FFF1D6' }}
                thumbColor={notificationsEnabled ? '#4A2C2A' : '#FFFFFF'}
              />
            </View>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(74, 44, 42, 0.1)',
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Dark Mode
              </Text>
              <Switch
                value={darkModeEnabled}
                onValueChange={setDarkModeEnabled}
                trackColor={{ false: 'rgba(74, 44, 42, 0.2)', true: '#FFF1D6' }}
                thumbColor={darkModeEnabled ? '#4A2C2A' : '#FFFFFF'}
              />
            </View>
            
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Analytics
              </Text>
              <Switch
                value={analyticsEnabled}
                onValueChange={setAnalyticsEnabled}
                trackColor={{ false: 'rgba(74, 44, 42, 0.2)', true: '#FFF1D6' }}
                thumbColor={analyticsEnabled ? '#4A2C2A' : '#FFFFFF'}
              />
            </View>
          </View>
        </View>

        {/* Account Actions */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 16,
          }}>
            Account
          </Text>
          
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <TouchableOpacity style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(74, 44, 42, 0.1)',
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Export Data
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(74, 44, 42, 0.1)',
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Privacy Policy
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={{
              padding: 16,
            }}>
              <Text style={{
                fontSize: 16,
                color: '#4A2C2A',
              }}>
                Terms of Service
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 16,
          }}>
            Danger Zone
          </Text>
          
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 16,
            overflow: 'hidden',
          }}>
            <TouchableOpacity 
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: 'rgba(74, 44, 42, 0.1)',
              }}
              onPress={handleLogout}
            >
              <Text style={{
                fontSize: 16,
                color: '#E53E3E',
              }}>
                Logout
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={{
                padding: 16,
              }}
              onPress={handleDeleteAccount}
            >
              <Text style={{
                fontSize: 16,
                color: '#E53E3E',
              }}>
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* App Info */}
        <View style={{
          backgroundColor: '#FFF1D6',
          borderRadius: 16,
          padding: 20,
          alignItems: 'center',
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#4A2C2A',
            marginBottom: 8,
          }}>
            AmiX Cursor
          </Text>
          <Text style={{
            fontSize: 14,
            color: 'rgba(74, 44, 42, 0.7)',
            marginBottom: 4,
          }}>
            Version 1.0.0
          </Text>
          <Text style={{
            fontSize: 12,
            color: 'rgba(74, 44, 42, 0.6)',
            textAlign: 'center',
          }}>
            Secure, private messaging for everyone
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
