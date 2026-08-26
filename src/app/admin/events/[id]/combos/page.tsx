import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteCombo } from "@/app/actions/admin-combos";
import { parseComboItems } from "@/lib/combo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
}

export default async function EventCombosPage({
  params,
}: PageProps<"/admin/events/[id]/combos">) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) notFound();

  const combos = await prisma.comboType.findMany({
    where: { eventId: id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl tracking-wide text-primary">
          COMBO — {event.title.toUpperCase()}
        </h1>
        <Link
          href={`/admin/events/${id}/combos/new`}
          className={cn(buttonVariants({ size: "sm" }))}
        >
          Tạo combo mới
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Combo</TableHead>
              <TableHead>Giá</TableHead>
              <TableHead>Kèm vé</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Còn lại</TableHead>
              <TableHead className="text-right">Hành động</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {combos.map((combo) => (
              <TableRow key={combo.id}>
                <TableCell className="font-medium">{combo.name}</TableCell>
                <TableCell>
                  {formatVnd(combo.price)}
                  {combo.originalPrice && (
                    <span className="ml-1 text-xs text-muted-foreground line-through">
                      {formatVnd(combo.originalPrice)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={combo.includesTicket ? "default" : "outline"}>
                    {combo.includesTicket ? "Có" : "Không"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {parseComboItems(combo.items).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  {combo.remainingQuantity}/{combo.totalQuantity}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/events/${id}/combos/${combo.id}/edit`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      Sửa
                    </Link>
                    <form action={deleteCombo.bind(null, id, combo.id)}>
                      <Button type="submit" variant="secondary" size="sm">
                        Xoá
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {combos.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Chưa có combo nào cho sự kiện này.
          </p>
        )}
      </div>
    </div>
  );
}
