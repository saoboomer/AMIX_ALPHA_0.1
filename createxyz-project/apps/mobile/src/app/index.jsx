import React, { memo } from "react";
import { Redirect } from "expo-router";

const Index = memo(() => {
  return <Redirect href="/(tabs)" />;
});

Index.displayName = 'Index';

export default Index;
