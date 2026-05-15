'use client';

interface MonoValueProps {
  value: string | number;
  unit?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses: Record<string, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
  xl: 'text-2xl',
};

export default function MonoValue({ value, unit, size = 'md', className = '' }: MonoValueProps) {
  return (
    <span className={`mono-value font-semibold text-text-primary ${sizeClasses[size]} ${className}`}>
      {value}
      {unit && (
        <span className="ml-0.5 text-text-tertiary font-normal text-[0.75em]">{unit}</span>
      )}
    </span>
  );
}
