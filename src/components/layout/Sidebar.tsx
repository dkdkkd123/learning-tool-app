import React from 'react';
import { useApp } from '../../context/AppContext';
import type { AppView } from '../../domain/types';

type NavItem = {
  view: AppView;
  label: string;
  icon: string;
  badge?: number;
};

export function Sidebar() {
  const { state, dispatch } = useApp();
  const pendingCount = state.project?.pendingTests.length ?? 0;

  const items: NavItem[] = [
    { view: 'home', label: '홈', icon: '⌂' },
    { view: 'test-queue', label: '테스트', icon: '✎', badge: pendingCount },
    { view: 'options', label: '설정', icon: '⚙' },
  ];

  if (state.project) {
    items.splice(1, 0, { view: 'dag-workspace', label: 'DAG', icon: '⬡' });
  }

  function handleNav(view: AppView) {
    dispatch({ type: 'NAVIGATE', view });
  }

  return (
    <div className="w-14 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-3 gap-1">
      {/* Logo */}
      <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center text-white font-bold text-xs mb-3 flex-shrink-0">
        LT
      </div>

      {items.map((item) => {
        const isActive = state.view === item.view;
        return (
          <button
            key={item.view}
            title={item.label}
            onClick={() => handleNav(item.view)}
            className={`relative w-10 h-10 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors text-[11px] ${
              isActive
                ? 'bg-blue-700 text-white'
                : 'text-gray-500 hover:bg-gray-800 hover:text-gray-300'
            }`}
          >
            <span className="text-base leading-none">{item.icon}</span>
            <span className="leading-none">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
