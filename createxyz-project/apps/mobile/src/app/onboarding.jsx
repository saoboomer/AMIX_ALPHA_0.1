import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to AmiX',
      subtitle: 'Secure, private messaging for everyone',
      description: 'Your conversations are protected with military-grade encryption. Only you and your friends can read your messages.',
    },
    {
      title: 'Choose Your Name',
      subtitle: 'How should we call you?',
      description: 'This is how your friends will see you in AmiX.',
    },
    {
      title: 'You\'re All Set!',
      subtitle: 'Ready to start messaging',
      description: 'Your AmiX ID is: DEMO123\n\nShare this with friends to connect securely.',
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
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
          minHeight: '100%',
        }}
      >
        {/* Progress indicator */}
        <View style={{ flexDirection: 'row', marginBottom: 40 }}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 4,
                backgroundColor: index <= currentStep ? '#FFF1D6' : 'rgba(74, 44, 42, 0.1)',
                marginHorizontal: 4,
                borderRadius: 2,
              }}
            />
          ))}
        </View>

        {/* Content */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{
            fontSize: 32,
            fontWeight: '700',
            color: '#4A2C2A',
            textAlign: 'center',
            marginBottom: 16,
          }}>
            {steps[currentStep].title}
          </Text>
          
          <Text style={{
            fontSize: 18,
            fontWeight: '600',
            color: 'rgba(74, 44, 42, 0.8)',
            textAlign: 'center',
            marginBottom: 24,
          }}>
            {steps[currentStep].subtitle}
          </Text>
          
          <Text style={{
            fontSize: 16,
            color: 'rgba(74, 44, 42, 0.7)',
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: 40,
          }}>
            {steps[currentStep].description}
          </Text>

          {/* Input for step 1 */}
          {currentStep === 1 && (
            <View style={{ marginBottom: 40 }}>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(74, 44, 42, 0.2)',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: '#4A2C2A',
                  backgroundColor: '#FFFFFF',
                  textAlign: 'center',
                }}
                placeholder="Enter your name"
                placeholderTextColor="rgba(74, 44, 42, 0.5)"
                value={displayName}
                onChangeText={setDisplayName}
                autoFocus
              />
            </View>
          )}

          {/* AmiX ID display for step 2 */}
          {currentStep === 2 && (
            <View style={{
              backgroundColor: '#FFF1D6',
              borderRadius: 16,
              padding: 24,
              marginBottom: 40,
              alignItems: 'center',
            }}>
              <Text style={{
                fontSize: 24,
                fontWeight: '700',
                color: '#4A2C2A',
                letterSpacing: 2,
              }}>
                DEMO123
              </Text>
              <Text style={{
                fontSize: 14,
                color: 'rgba(74, 44, 42, 0.7)',
                marginTop: 8,
              }}>
                Your AmiX ID
              </Text>
            </View>
          )}
        </View>

        {/* Navigation buttons */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={{
                flex: 1,
                backgroundColor: '#FFFFFF',
                borderRadius: 12,
                padding: 16,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(74, 44, 42, 0.2)',
              }}
              onPress={handleBack}
            >
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                color: '#4A2C2A',
              }}>
                Back
              </Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: '#FFF1D6',
              borderRadius: 12,
              padding: 16,
              alignItems: 'center',
            }}
            onPress={handleNext}
          >
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#4A2C2A',
            }}>
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}