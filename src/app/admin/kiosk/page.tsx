import type { Metadata } from "next";
import Link from "next/link";
import { getKioskLook } from "@/app/actions/kiosk-uni";
import { UniControl } from "@/components/kiosk-uni/uni-control";

export const metadata: Metadata = { title: "Điều khiển kiosk" };

/** Điều khiển linh vật trên máy kiosk check-in (/kiosk/[eventId]). */
export default async function AdminKioskPage() {
  const look = await getKioskLook();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl tracking-wide text-primary">ĐIỀU KHIỂN KIOSK</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thao tác ở đây hiện ngay trên máy kiosk đang mở.{" "}
          <Link href="/kiosk" className="underline underline-offset-4 hover:text-foreground">
            Mở kiosk trên máy này
          </Link>
        </p>
      </div>
      <UniControl initialLook={look} />
    </div>
  );
}
