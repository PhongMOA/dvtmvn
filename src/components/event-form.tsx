"use client";

import { useActionState } from "react";
import type { EventFormState } from "@/app/actions/admin-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EventDefaults = {
  title: string;
  description: string;
  posterUrl: string;
  venue: string;
  startAt: string; // yyyy-MM-ddThh:mm, for <input type="datetime-local">
};

export function EventForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prevState: EventFormState, formData: FormData) => Promise<EventFormState>;
  defaults?: Partial<EventDefaults>;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<EventFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Tên sự kiện</Label>
        <Input id="title" name="title" defaultValue={defaults?.title} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Mô tả</Label>
        <Textarea id="description" name="description" defaultValue={defaults?.description} rows={4} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="posterUrl">Link poster (tuỳ chọn)</Label>
        <Input id="posterUrl" name="posterUrl" defaultValue={defaults?.posterUrl} placeholder="https://..." />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="venue">Địa điểm</Label>
        <Input id="venue" name="venue" defaultValue={defaults?.venue} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startAt">Thời gian chiếu</Label>
        <Input
          id="startAt"
          name="startAt"
          type="datetime-local"
          defaultValue={defaults?.startAt}
          required
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" size="lg" disabled={isPending} className="w-fit">
        {isPending ? "Đang lưu..." : submitLabel}
      </Button>
    </form>
  );
}
