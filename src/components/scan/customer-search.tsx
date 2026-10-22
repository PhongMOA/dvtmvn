"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { staffSearch } from "@/app/actions/checkin";
import type { CustomerMatch } from "@/lib/checkin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERROR_MESSAGE, ScanResultCard, useCheckinScan } from "./checkin-scan";

/**
 * Check-in khách không có QR: nhân viên gõ tên / email / SĐT (tên hiện đầy đủ,
 * không che như kiosk) -> chọn đúng người -> xem thẻ -> Xác nhận.
 */
export function CustomerSearch({ eventId }: { eventId: string }) {
  const { result, confirmed, isConfirming, lookup, confirm, reset } = useCheckinScan(eventId);
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<CustomerMatch[] | null>(null);
  const [isSearching, startSearch] = useTransition();

  function search(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      const res = await staffSearch(q, eventId);
      if (!res.ok) {
        toast.error(ERROR_MESSAGE[res.error] ?? "Tìm kiếm thất bại.");
        return;
      }
      setMatches(res.value);
    });
  }

  function done() {
    reset();
    setMatches(null);
    setQ("");
  }

  if (result) {
    return (
      <ScanResultCard
        result={result}
        confirmed={confirmed}
        isConfirming={isConfirming}
        onConfirm={confirm}
        onNext={done}
        nextLabel="Xong"
      />
    );
  }

  return (
    <div className="w-full max-w-sm">
      <form onSubmit={search} className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tên, email hoặc SĐT"
          aria-label="Tìm khách"
        />
        <Button type="submit" variant="outline" disabled={isSearching || q.trim().length < 2}>
          {isSearching ? "Đang tìm..." : "Tìm"}
        </Button>
      </form>

      {matches && (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
          {matches.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">
              Không có khách có vé suất này khớp “{q}”.
            </li>
          )}
          {matches.map((m) => (
            <li key={m.userId}>
              <button
                type="button"
                onClick={() => lookup({ userId: m.userId })}
                className="flex w-full flex-col items-start p-3 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{m.name}</span>
                {m.phone && <span className="text-xs text-muted-foreground">{m.phone}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
