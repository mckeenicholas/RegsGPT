import { Component } from "solid-js";

interface UserMenuProps {
  name: string;
  wcaID: string;
  tokensUsed: number;
  tokenCap: number;
  onLogout: () => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const UserMenu: Component<UserMenuProps> = (props) => {
  const initials = () => {
    const parts = props.name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return props.name.substring(0, 2).toUpperCase();
  };

  return (
    <div class="px-4 py-3 border-t border-border flex items-center gap-2.5">
      <div class="w-8 h-8 rounded-full bg-linear-to-br from-accent to-accent-dim flex items-center justify-center text-xs font-semibold text-bg-primary shrink-0">
        {initials()}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-medium text-text-primary truncate">
          {props.name}
        </div>
        <div class="text-xs text-text-muted">
          {formatTokens(props.tokensUsed)} / {formatTokens(props.tokenCap)}{" "}
          tokens
        </div>
      </div>
      <button
        class="p-1.5 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors text-base"
        onClick={() => props.onLogout()}
        title="Sign out"
        id="logout-button"
      >
        ⏻
      </button>
    </div>
  );
};

export default UserMenu;
