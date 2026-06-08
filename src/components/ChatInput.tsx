import { Component, createSignal, createEffect } from "solid-js";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  initialValue?: string;
}

const ChatInput: Component<ChatInputProps> = (props) => {
  let textareaRef: HTMLTextAreaElement | undefined;
  const [value, setValue] = createSignal(props.initialValue || "");

  createEffect(() => {
    if (props.initialValue && props.initialValue !== value()) {
      setValue(props.initialValue);
      if (textareaRef) {
        textareaRef.value = props.initialValue;
        autoResize();
        textareaRef.focus();
      }
    }
  });

  const autoResize = () => {
    if (textareaRef) {
      textareaRef.style.height = "auto";
      textareaRef.style.height = Math.min(textareaRef.scrollHeight, 150) + "px";
    }
  };

  const handleSubmit = () => {
    const msg = value().trim();
    if (!msg || props.disabled) return;
    props.onSend(msg);
    setValue("");
    if (textareaRef) {
      textareaRef.value = "";
      textareaRef.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div class="bg-bg-primary px-5 pt-4 pb-5">
      <div class="mx-auto max-w-3xl">
        <div class="flex items-end gap-2 rounded-xl border border-border bg-bg-secondary px-3 py-2 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(56,189,248,0.15)]">
          <textarea
            ref={textareaRef}
            class="max-h-37.5 min-h-8 flex-1 resize-none border-none bg-transparent py-1.5 text-sm leading-5 text-text-primary outline-none placeholder:text-text-muted"
            placeholder="Ask about WCA regulations, guidelines, or precedents"
            value={value()}
            onInput={(e) => {
              setValue(e.currentTarget.value);
              autoResize();
            }}
            onKeyDown={handleKeyDown}
            disabled={props.disabled}
            rows={1}
            id="chat-input"
          />
          <button
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-base text-bg-primary transition-all hover:scale-105 hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleSubmit}
            disabled={props.disabled || !value().trim()}
            title="Send message"
            id="send-button"
          >
            ↑
          </button>
        </div>
        <div class="mt-2 text-center text-xs text-text-muted">
          RegsGPT can make mistakes. Always verify rulings with the official regulations.
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
