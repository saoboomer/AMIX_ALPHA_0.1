import React, { useEffect } from 'react';
import { View, Animated, Dimensions } from 'react-native';
import { useTheme } from '../utils/theme';

const { width: screenWidth } = Dimensions.get('window');

export default function CloudHeader({ children, style }) {
  const { colors } = useTheme();
  const cloud1Position = React.useRef(new Animated.Value(0)).current;
  const cloud2Position = React.useRef(new Animated.Value(0)).current;
  const cloud3Position = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate clouds with different speeds for parallax effect
    const animateCloud = (cloudAnim, duration, delay = 0) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(cloudAnim, {
            toValue: 1,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(cloudAnim, {
            toValue: 0,
            duration,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateCloud(cloud1Position, 20000, 0);
    animateCloud(cloud2Position, 15000, 5000);
    animateCloud(cloud3Position, 18000, 2000);
  }, []);

  const CloudShape = ({ translateX, opacity = 0.05, size = 100, color }) => (
    <Animated.View
      style={{
        position: 'absolute',
        top: 20,
        width: size,
        height: size * 0.6,
        transform: [
          {
            translateX: translateX.interpolate({
              inputRange: [0, 1],
              outputRange: [-size, screenWidth + size],
            }),
          },
        ],
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: color,
          borderRadius: size * 0.3,
          opacity,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.2,
          left: size * 0.3,
          width: size * 0.7,
          height: size * 0.4,
          backgroundColor: color,
          borderRadius: size * 0.2,
          opacity: opacity * 0.8,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.1,
          right: size * 0.2,
          width: size * 0.5,
          height: size * 0.3,
          backgroundColor: color,
          borderRadius: size * 0.15,
          opacity: opacity * 0.6,
        }}
      />
    </Animated.View>
  );

  return (
    <View style={[{ position: 'relative', overflow: 'hidden' }, style]}>
      {/* Cloud layer with golden-cream and sky blue tints */}
      <CloudShape 
        translateX={cloud1Position} 
        opacity={0.04} 
        size={120} 
        color={colors.primaryGolden}
      />
      <CloudShape 
        translateX={cloud2Position} 
        opacity={0.03} 
        size={80} 
        color={colors.incomingBubble}
      />
      <CloudShape 
        translateX={cloud3Position} 
        opacity={0.05} 
        size={100} 
        color={colors.primaryGolden}
      />
      
      {/* Content */}
      {children}
    </View>
  );
}