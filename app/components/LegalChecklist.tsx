"use client";

import { useState } from "react";
import { Check } from "lucide-react";

export interface ChecklistItem {
  id: string;
  text: string;
  category: string;
}

interface Props {
  title: string;
  subtitle: string;
  iconNode: React.ReactNode;
  /** @deprecated 리디자인(2026-09-16)으로 틴트 박스 폐지 — 받되 무시한다(호출처 호환) */
  iconBg?: string;
  /** @deprecated 리디자인(2026-09-16)으로 색 채움 폐지 — 받되 무시한다(호출처 호환) */
  iconColor?: string;
  items: ChecklistItem[];
}

export default function LegalChecklist({
  title, subtitle, iconNode, items,
}: Props) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const progress = items.length > 0 ? Math.round((checked.size / items.length) * 100) : 0;

  const categories: { name: string; items: ChecklistItem[] }[] = [];
  for (const item of items) {
    const last = categories[categories.length - 1];
    if (last && last.name === item.category) {
      last.items.push(item);
    } else {
      categories.push({ name: item.category, items: [item] });
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 flex items-center justify-center shrink-0 text-text-sub">
          {iconNode}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-text-main">{title}</p>
          <p className="text-[13px] text-text-sub">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 progress-bar">
          <div style={{ width: `${progress}%`, background: "var(--color-primary)" }} />
        </div>
        <span className="text-[11px] font-semibold text-text-sub">
          {checked.size}/{items.length}
        </span>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name}>
            <p className="text-[11px] font-semibold text-text-light mb-2">
              {cat.name}
            </p>
            <div className="space-y-1.5">
              {cat.items.map((item) => {
                const done = checked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-start gap-2.5 text-left p-2 rounded-lg active:bg-surface-alt transition-colors"
                  >
                    <div
                      className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200"
                      style={{
                        borderRadius: "var(--radius-square)",
                        border: done ? "1px solid var(--color-primary)" : "1px solid var(--color-gray-300)",
                        background: done ? "var(--color-primary)" : "var(--color-surface)",
                      }}
                    >
                      {done && <Check size={13} style={{ color: "var(--color-surface)" }} strokeWidth={2.5} />}
                    </div>
                    <span
                      className={`text-[13px] leading-relaxed transition-colors duration-200 ${
                        done ? "text-text-light line-through" : "text-text-sub"
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {progress === 100 && (
        <div className="mt-4 pt-3 text-center" style={{ borderTop: "1px solid var(--color-divider)" }}>
          <p className="text-[13px] font-semibold" style={{ color: "var(--color-sage)" }}>
            모든 단계를 완료했어요
          </p>
        </div>
      )}
    </div>
  );
}
