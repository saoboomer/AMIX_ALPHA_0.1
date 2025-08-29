import { useColorScheme } from 'react-native';

export const useTheme = () => {
  const colorScheme = useColorScheme();
  
  const colors = {
    light: {
      // AmiX Brand Colors
      background: '#FFF8EC', // Cream base/background
      surface: '#FFFFFF',
      surfaceSecondary: '#FFF1D6', // Golden-cream for cards/elevated surfaces
      surfaceElevated: '#FFFFFF',
      text: '#4A2C2A', // Marron primary text
      textSecondary: 'rgba(74, 44, 42, 0.7)',
      textTertiary: 'rgba(74, 44, 42, 0.5)',
      border: 'rgba(74, 44, 42, 0.1)',
      
      // AmiX Specific Colors
      primaryGolden: '#FFF1D6', // Golden-cream primary
      incomingBubble: '#B0D9FF', // Sky blue incoming
      outgoingBubble: '#FFE8AA', // Light gold outgoing
      shadow: 'rgba(0,0,0,0.10)', // Graphite shadow
      
      // Button colors
      primaryButton: '#FFF1D6', // Golden-cream
      primaryButtonText: '#4A2C2A',
      secondaryButton: '#FFFFFF',
      secondaryButtonText: '#4A2C2A',
      
      // Status colors
      online: '#4ADE80',
      typing: '#FFF1D6',
      unread: '#FFF1D6',
    },
    dark: {
      background: '#1A1A1A',
      surface: '#262626',
      surfaceSecondary: '#3A3A3A',
      surfaceElevated: '#2A2A2A',
      text: 'rgba(255, 255, 255, 0.87)',
      textSecondary: 'rgba(255, 255, 255, 0.6)',
      textTertiary: 'rgba(255, 255, 255, 0.38)',
      border: '#333333',
      
      // AmiX Specific Colors (adjusted for dark mode)
      primaryGolden: '#D4C5A0', // Muted golden-cream
      incomingBubble: '#4A90C2', // Darker sky blue
      outgoingBubble: '#C4A55C', // Darker light gold
      shadow: 'rgba(0,0,0,0.30)',
      
      // Button colors
      primaryButton: '#D4C5A0',
      primaryButtonText: '#1A1A1A',
      secondaryButton: '#333333',
      secondaryButtonText: 'rgba(255, 255, 255, 0.87)',
      
      // Status colors
      online: '#4ADE80',
      typing: '#D4C5A0',
      unread: '#D4C5A0',
    }
  };
  
  return {
    colors: colors[colorScheme] || colors.light,
    isDark: colorScheme === 'dark'
  };
};