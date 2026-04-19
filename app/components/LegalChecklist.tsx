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
  iconBg: string;
  iconColor: string;
  items: ChecklistItem[];
}

export default function LegalChecklist({
  title, subtitle, iconNode, iconBg, iconColor, items,
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
    <div className="rounded-2xl p-5 bg-white" style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          {iconNode}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-bold text-text-main">{title}</p>
          <p className="text-[12px] text-text-sub">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 rounded-full bg-[#E5E0D6] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, backgroundColor: iconColor }}
          />
        </div>
        <span className="text-[11px] font-semibold" style={{ color: iconColor }}>
          {checked.size}/{items.length}
        </span>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat.name}>
            <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">
              {cat.name}
            </p>
            <div className="space-y-1.5">
              {cat.items.map((item) => {
                const done = checked.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-start gap-2.5 text-left p-2 rounded-xl active:bg-surface-alt transition-colors"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-200 ${
                        done ? "border-transparent" : "border-border"
                      }`}
                      style={done ? { backgroundColor: iconColor } : {}}
                    >
                      {done && <Check size={13} color="white" strokeWidth={3} />}
                    </div>
                    <span
                      className={`text-[13px] leading-relaxed transition-colors duration-200 ${
                        done ? "text-text-muted line-through" : "text-text-sub"
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
        <div className="mt-4 p-3 rounded-2xl bg-[#E8ECE5] text-center">
          <p className="text-[13px] font-semibold text-[#6B8E6F]">
            모든 단계를 완료했어요
          </p>
        </div>
      )}
    </div>
  );
}
