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
    <div class="px-5 pb-5 pt-4 bg-bg-primary">
      <div class="max-w-3xl mx-auto">
        <div class="flex items-end gap-2 bg-bg-secondary border border-border rounded-xl px-3 py-2 transition-colors focus-within:border-accent focus-within:shadow-[0_0_0_2px_rgba(56,189,248,0.15)]">
          <textarea
            ref={textareaRef}
            class="flex-1 bg-transparent border-none text-text-primary text-sm leading-5 resize-none outline-none max-h-37.5 min-h-8 py-1.5 placeholder:text-text-muted"
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
            class="w-8 h-8 rounded-lg bg-accent text-bg-primary flex items-center justify-center shrink-0 text-base transition-all hover:bg-accent-dim hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleSubmit}
            disabled={props.disabled || !value().trim()}
            title="Send message"
            id="send-button"
          >
            ↑
          </button>
        </div>
        <div class="text-center mt-2 text-xs text-text-muted">
          RegsGPT can make mistakes. Always verify rulings with the official regulations.
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
