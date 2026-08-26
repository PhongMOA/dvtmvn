import QRCode from "qrcode";

export async function TicketQr({ qrToken }: { qrToken: string }) {
  const dataUrl = await QRCode.toDataURL(qrToken, {
    margin: 1,
    width: 200,
    color: { dark: "#0a0a0f", light: "#f4f4f0" },
  });

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      alt="Mã QR check-in"
      width={160}
      height={160}
      className="rounded-md border border-border bg-white p-2"
    />
  );
}
