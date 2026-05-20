type TabPillTab = {
  id: string;
  label: string;
  /** Shown next to the label when this tab is active and count > 0 */
  count?: number | null;
};

interface TabPillProps {
  tabs: TabPillTab[];
  activeTab: string;
  onTabChange?: (id: string) => void;
}

export default function TabPill({
  tabs,
  activeTab,
  onTabChange,
}: TabPillProps) {
  return (
    <div className="bg-navy rounded-lg p-1 flex items-center gap-0.5">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange?.(tab.id)}
            disabled={!onTabChange}
            className={
              isActive
                ? "bg-card text-text-dark font-bold text-s font-figtree px-3 py-1.5 rounded-md transition-colors"
                : "text-white/70 text-s font-figtree px-3 py-1.5 rounded-md transition-colors hover:bg-white/10"
            }
          >
            {tab.label}
            {isActive && tab.count != null && tab.count > 0 && (
              <span className="ml-1 text-accent font-bold">({tab.count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
