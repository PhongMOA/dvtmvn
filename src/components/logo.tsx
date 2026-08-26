import { cn } from "@/lib/utils";

/**
 * Logo "ĐA VŨ TRỤ / MARVEL VN" dựng bằng SVG thay vì ảnh raster, để màu sắc
 * luôn ăn theo theme token (--card, --primary...) — đổi bảng màu theo phim ở
 * globals.css là logo tự đổi theo, không cần vẽ lại ảnh. 2 khối dính liền
 * nhau: khối trên có viền trắng 2px đủ 4 cạnh (cạnh dưới của nó đóng luôn
 * vai trò đường phân cách), khối dưới chỉ vẽ viền trái/phải/dưới (bỏ viền
 * trên) để không bị chồng nét ở đường ráp giữa 2 khối — viền luôn trắng
 * cứng theo đúng ảnh gốc, không ăn theo theme.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 150"
      role="img"
      aria-label="Đa Vũ Trụ Marvel VN"
      className={cn("h-10 w-auto", className)}
    >
      <rect
        x="0"
        y="0"
        width="300"
        height="52"
        className="fill-card stroke-white stroke-2"
      />
      <rect x="0" y="52" width="300" height="98" className="fill-primary" />
      <path
        d="M 0 52 L 0 150 L 300 150 L 300 52"
        fill="none"
        className="stroke-white stroke-2"
      />
      <text
        x="150"
        y="36"
        textAnchor="middle"
        textLength="272"
        lengthAdjust="spacingAndGlyphs"
        fontSize="32"
        letterSpacing="1"
        className="fill-card-foreground font-logo"
      >
        ĐA VŨ TRỤ
      </text>
      <text
        x="150"
        y="135"
        textAnchor="middle"
        textLength="265"
        lengthAdjust="spacingAndGlyphs"
        fontSize="102"
        className="fill-primary-foreground font-marvel"
      >
        MARVEL VN
      </text>
    </svg>
  );
}
