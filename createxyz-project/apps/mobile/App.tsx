import { App } from 'expo-router/build/qualified-entry';
import React, { memo, useEffect, useCallback } from 'react';
import { ErrorBoundaryWrapper } from './__create/SharedErrorBoundary';
import './src/__create/polyfills';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';
import { AlertModal } from './polyfills/web/alerts.web';
import './global.css';

const GlobalErrorReporter = memo(() => {
  const errorHandler = useCallback((event: ErrorEvent) => {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    console.error(event.error);
  }, []);

  const unhandledRejectionHandler = useCallback((event: PromiseRejectionEvent) => {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    console.error('Unhandled promise rejection:', event.reason);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
  }, [errorHandler, unhandledRejectionHandler]);
  
  return null;
});

GlobalErrorReporter.displayName = 'GlobalErrorReporter';

const Wrapper = memo(() => {
  const initialMetrics = React.useMemo(() => ({
    insets: { top: 64, bottom: 34, left: 0, right: 0 },
    frame: {
      x: 0,
      y: 0,
      width: typeof window === 'undefined' ? 390 : window.innerWidth,
      height: typeof window === 'undefined' ? 844 : window.innerHeight,
    },
  }), []);

  return (
    <ErrorBoundaryWrapper>
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <App />
        <GlobalErrorReporter />
        <Toaster />
      </SafeAreaProvider>
    </ErrorBoundaryWrapper>
  );
});

Wrapper.displayName = 'Wrapper';

const healthyResponse = {
  type: 'sandbox:mobile:healthcheck:response',
  healthy: true,
};

const useHandshakeParent = () => {
  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data.type === 'sandbox:mobile:healthcheck' && window.parent) {
      window.parent.postMessage(healthyResponse, '*');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    window.addEventListener('message', handleMessage);
    
    // Only send to parent if we're in an iframe context
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(healthyResponse, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);
};

const CreateApp = memo(() => {
  useHandshakeParent();

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data.type === 'sandbox:navigation') {
      // Handle navigation if needed
      console.log('Navigation message received:', event.data);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    
    window.addEventListener('message', handleMessage);
    
    // Only send to parent if we're in an iframe context
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'sandbox:mobile:ready' }, '*');
    }
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [handleMessage]);

  return (
    <>
      <Wrapper />
      <AlertModal />
    </>
  );
});

CreateApp.displayName = 'CreateApp';

export default CreateApp;
