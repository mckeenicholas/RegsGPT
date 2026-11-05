import type { Component } from "solid-js";

interface UserMenuProps {
  name: string;
  wcaID: string;
  requestsUsedToday: number;
  requestCap: number;
  onLogout: () => void;
}

const UserMenu: Component<UserMenuProps> = (props) => {
  const initials = () => {
    const parts = props.name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts.at(-1)![0]).toUpperCase();
    }
    return props.name.slice(0, 2).toUpperCase();
  };

  return (
    <div class="flex items-center gap-2.5 border-t border-border px-4 py-3">
      <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-dim text-xs font-semibold text-bg-primary">
        {initials()}
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-text-primary">{props.name}</div>
        <div class="text-xs text-text-muted">
          {props.requestsUsedToday} / {props.requestCap} requests today
        </div>
      </div>
      <button
        class="rounded p-1.5 text-base text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        onClick={() => {
          props.onLogout();
        }}
        title="Sign out"
        id="logout-button"
      >
        ⏻
      </button>
    </div>
  );
};

export default UserMenu;
