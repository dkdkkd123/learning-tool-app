import React from 'react';

type Color = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'orange' | 'purple';

const colorClasses: Record<Color, string> = {
  gray: 'bg-gray-700 text-gray-300',
  blue: 'bg-blue-900 text-blue-300',
  green: 'bg-emerald-900 text-emerald-300',
  yellow: 'bg-yellow-900 text-yellow-300',
  red: 'bg-red-900 text-red-300',
  orange: 'bg-orange-900 text-orange-300',
  purple: 'bg-purple-900 text-purple-300',
};

type BadgeProps = {
  color?: Color;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ color = 'gray', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses[color]} ${className}`}
    >
      {children}
    </span>
  );
}
