import '@expo/metro-runtime';
import './__create/consoleToParent';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';

// Lazy load Skia for better performance
const LoadSkiaWeb = () => import('@shopify/react-native-skia/lib/module/web');

import './__create/reset.css';
import CreateApp from './App';

// Optimized loading with error handling
LoadSkiaWeb()
  .then(async (skiaModule) => {
    await skiaModule.default();
    renderRootComponent(CreateApp);
  })
  .catch((error) => {
    console.warn('Skia failed to load, continuing without it:', error);
    renderRootComponent(CreateApp);
  });
