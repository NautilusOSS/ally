import React from 'react';

interface VersionDisplayProps {
  className?: string;
}

const VersionDisplay: React.FC<VersionDisplayProps> = ({ className = '' }) => {
  // Get version from Vite environment variable
  const version = import.meta.env.VITE_APP_VERSION || '0.1.0';
  
  // Debug: log version to console
  if (import.meta.env.DEV) {
    console.log('App version:', version);
  }
  
  return (
    <div className={`text-xs text-gray-500 ${className}`}>
      Ally v{version}
    </div>
  );
};

export default VersionDisplay;

