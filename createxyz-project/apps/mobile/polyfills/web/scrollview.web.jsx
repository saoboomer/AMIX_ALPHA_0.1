import React from 'react';

// Simple ScrollView implementation for web
export const ScrollView = React.forwardRef((props, ref) => {
  const { horizontal, style, children, ...restProps } = props;
  
  const scrollViewStyle = React.useMemo(() => {
    const baseStyle = {
      overflow: 'auto',
      ...style,
    };
    
    if (horizontal) {
      return {
        ...baseStyle,
        flexDirection: 'row',
        flexGrow: 0,
      };
    }
    
    return baseStyle;
  }, [horizontal, style]);

  return (
    <div
      ref={ref}
      style={scrollViewStyle}
      {...restProps}
    >
      {children}
    </div>
  );
});

ScrollView.displayName = 'ScrollView';

export default ScrollView;
