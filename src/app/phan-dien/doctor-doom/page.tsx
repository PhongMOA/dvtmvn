import type { Metadata } from "next";
import Image from "next/image";
import styles from "./doctor-doom.module.css";

// Hồ sơ phản diện cho khán giả sự kiện offline. Nội dung tĩnh, chuyển từ bản
// demo artifact; ảnh trong public/phan-dien/doctor-doom/ (bản quyền Marvel).
export const metadata: Metadata = {
  title: "Doctor Doom – Hồ sơ phản diện – Đa vũ trụ Marvel VN",
  description:
    "Giới thiệu, chỉ số sức mạnh, tiểu sử, năng lực và điểm yếu của Doctor Doom – phản diện của Avengers: Doomsday.",
};

// Thang 1–7 kiểu Power Grid của Marvel; thứ tự giống trang marvel.com.
const STATS = [
  { name: "Sức bền", why: "Giáp titan, khiên năng lượng", val: 6 },
  { name: "Kỹ năng chiến đấu", why: "Mưu lược, kiếm thuật", val: 4 },
  { name: "Trí tuệ", why: "Thiên tài đa lĩnh vực", val: 6 },
  { name: "Tốc độ", why: "Bay bằng động cơ phản lực", val: 5 },
  { name: "Sức mạnh", why: "Được giáp trợ lực", val: 4 },
  { name: "Năng lượng", why: "Xung lực và phép thuật", val: 6 },
];
const MAX = 7;
const R = 52;
const CIRC = 2 * Math.PI * R;
const TOTAL = STATS.reduce((sum, s) => sum + s.val, 0);

type Chapter = { era: string; title: string; body: string };

const CHAPTERS_BEFORE_PANEL: Chapter[] = [
  {
    era: "Thuở ấu thơ",
    title: "Đứa trẻ mồ côi xứ Latveria",
    body: "Victor chào đời trong một gia đình Romani nghèo khó tại Latveria, một tiểu quốc ở Đông Âu. Mẹ cậu chết dưới tay một tên lính, ít lâu sau người cha cũng bỏ mạng vì cơn thịnh nộ của nhà vua. Bơ vơ một mình, Victor tìm thấy kho bảo vật ma thuật mẹ để lại và phát hiện linh hồn bà đang bị con quỷ từng giao ước với bà giam cầm. Kể từ đó, cậu bước chân vào con đường tăm tối.",
  },
  {
    era: "Những năm đại học tại New York",
    title: "Vụ nổ định mệnh",
    body: "Tài năng khoa học giúp Victor giành học bổng sang Mỹ, nơi cậu gặp Reed Richards. Hai thiên tài vừa chạm mặt đã coi nhau là đối thủ. Victor bí mật thử nghiệm cỗ máy xuyên chiều không gian do chính mình chế tạo, nhưng nó phát nổ ngay trước mặt cậu. Victor bị đuổi học, mang theo vết sẹo trên mặt và mối hận với Reed suốt đời.",
  },
];

const CHAPTERS_AFTER_PANEL: Chapter[] = [
  {
    era: "Tây Tạng",
    title: "Sau chiếc mặt nạ sắt",
    body: "Không chịu nổi gương mặt mang sẹo, Victor lên đường tới Tây Tạng. Hắn khuất phục một hội tu sĩ, học hết bí thuật của họ, rồi buộc họ rèn cho mình bộ giáp cùng chiếc mặt nạ sắt để che đi khuôn mặt mãi mãi. Doctor Doom chính thức ra đời.",
  },
  {
    era: "Lên ngôi",
    title: "Bạo chúa xứ Latveria",
    body: "Trở về quê hương, Doom lật đổ nhà vua, đổi tên thủ đô thành Doomstadt và dồn sức phát triển robot, vũ khí, thậm chí cả cỗ máy thời gian. Hắn theo đuổi ba mục tiêu: chinh phục thế giới, giải thoát linh hồn mẹ và chứng minh mình hơn hẳn Reed Richards.",
  },
  {
    era: "Secret Wars",
    title: "God Emperor Doom",
    body: "Khi đa vũ trụ sụp đổ, Doom đoạt được quyền năng tối thượng và chắp vá những mảnh vũ trụ còn sót lại thành Battleworld, nơi hắn ngự trị như một vị thần. Cuối cùng, Reed Richards cùng các đồng minh đã lật đổ hắn và tái thiết đa vũ trụ.",
  },
];

const FACTS: [string, string][] = [
  ["Tên thật", "Victor von Doom"],
  ["Chiều cao", "188 cm · kèm giáp 201 cm"],
  ["Cân nặng", "103 kg · kèm giáp 188 kg"],
  ["Mắt / Tóc", "Nâu / Nâu"],
  ["Quê quán", "Khu trại ngoại ô Haasenstadt (nay là Doomstadt), Latveria"],
  ["Học vấn", "Bị đuổi khỏi đại học, tự học khoa học và huyền thuật đến trình độ bậc thầy"],
  ["Người thân", "Mẹ Cynthia và cha Werner von Doom, đều đã qua đời"],
  ["Danh tính", "Công khai"],
  ["Kẻ thù truyền kiếp", "Reed Richards (Mr. Fantastic), Namor, Iron Man"],
];

const POWERS = [
  {
    kind: "Trí tuệ",
    title: "Thiên tài khoa học",
    body: "Tinh thông vật lý, robot học, chế tạo vũ khí và du hành thời gian. Cỗ máy thời gian của Doom là một trong những phát minh nguy hiểm bậc nhất vũ trụ Marvel.",
  },
  {
    kind: "Huyền thuật",
    title: "Phù thủy bậc thầy",
    body: "Doom sở hữu một trong những thư viện bùa chú và cổ vật đồ sộ nhất Trái Đất. Tài phép thuật của hắn sánh ngang, thậm chí vượt cả trình độ khoa học.",
  },
  {
    kind: "Trang bị",
    title: "Bộ giáp titan",
    body: "Khiên năng lượng, găng tay phóng xung lực và động cơ phản lực thu nhỏ giúp hắn bay lượn. Qua năm tháng, bộ giáp không ngừng được nâng cấp.",
  },
  {
    kind: "Quân đội",
    title: "Doombot",
    body: "Đội quân robot mang hình hài Doom, giống thật đến mức kẻ thù có thể đối đầu với một bản sao suốt thời gian dài mà không hề hay biết.",
  },
  {
    kind: "Tâm linh",
    title: "Hoán đổi cơ thể",
    body: "Doom từng chiếm giữ cơ thể người khác, kể cả Reed Richards và Daredevil, để thoát hiểm hoặc qua mặt đối thủ.",
  },
  {
    kind: "Quyền lực",
    title: "Nguyên thủ Latveria",
    body: "Trong tay Doom là cả một quốc gia được phòng thủ kiên cố bậc nhất Trái Đất, cùng tấm khiên miễn trừ ngoại giao trước công lý quốc tế.",
  },
];

const WEAKNESSES = [
  {
    title: "Cái tôi ngạo mạn",
    body: "Doom không bao giờ nhận mình sai. Chính một phép tính sai năm xưa đã để lại vết sẹo trên mặt hắn.",
  },
  {
    title: "Nỗi ám ảnh mang tên Reed",
    body: "Khát khao vượt mặt Reed Richards nhiều lần khiến Doom vuột mất chiến thắng ngay trong tầm tay.",
  },
  {
    title: "Danh dự",
    body: "Doom luôn giữ lời, kể cả với kẻ thù. Ai hiểu được điều đó có thể dùng chính lời hứa để trói buộc hắn.",
  },
];

const eyebrow = "font-heading text-xs uppercase tracking-[0.16em] text-primary";
const sectionTitle = "font-heading text-3xl leading-tight sm:text-4xl";

function ChapterBlock({ era, title, body }: Chapter) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold tracking-wide text-primary">{era}</p>
      <h3 className="font-heading text-2xl leading-snug text-balance">{title}</h3>
      <p className="max-w-[64ch] leading-relaxed text-foreground/85">{body}</p>
    </div>
  );
}

export default function DoctorDoomPage() {
  return (
    <div className="w-full">
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-border/60">
        <Image
          src="/phan-dien/doctor-doom/hero.jpg"
          alt="Doctor Doom đứng trên tường thành, áo choàng xanh tung bay"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[38%_0%] sm:object-[70%_0%]"
        />
        <div className={`absolute inset-0 ${styles.heroShade}`} />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-3.5 px-4 pt-48 pb-9 sm:pt-28 sm:pb-14 lg:pt-40">
          <p className={eyebrow}>Hồ sơ phản diện · Avengers: Doomsday</p>
          <h1
            className={`font-logo text-[clamp(64px,12vw,140px)] leading-[0.88] uppercase ${styles.title}`}
          >
            Doctor Doom
          </h1>
          <p className="font-heading text-xl text-accent sm:text-2xl">Victor von Doom</p>
          <p className="max-w-[46ch] text-base leading-relaxed sm:text-lg">
            Quốc vương xứ Latveria, bộ óc thiên tài và phù thủy đầy quyền năng. Với Doom,
            thế giới chỉ có trật tự khi tất cả cúi đầu trước hắn.
          </p>
          <div className="mt-1 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-muted-foreground">
              Ra mắt lần đầu{" "}
              <b className="font-semibold text-foreground">Fantastic Four #5 (1962)</b>
            </span>
            <span className="rounded-full border border-border bg-card/70 px-3 py-1 text-muted-foreground">
              Cha đẻ <b className="font-semibold text-foreground">Stan Lee &amp; Jack Kirby</b>
            </span>
          </div>
        </div>
      </header>

      {/* Chỉ số */}
      <section aria-labelledby="stats-h" className="py-10 sm:py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-7 px-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={eyebrow}>Đánh giá sức mạnh</p>
              <h2 id="stats-h" className={sectionTitle}>
                Bảng chỉ số
              </h2>
            </div>
            <p className="font-heading text-sm text-muted-foreground">
              <b className="mr-1 font-logo text-4xl font-normal text-accent">{TOTAL}</b>/{" "}
              {STATS.length * MAX} điểm
            </p>
          </div>
          <ul className="grid grid-cols-3 gap-x-3.5 gap-y-7 md:grid-cols-6 md:gap-5">
            {STATS.map((s, n) => {
              const shown = (CIRC * s.val) / MAX;
              return (
                <li key={s.name} className="flex flex-col items-center gap-2.5 text-center">
                  <svg
                    viewBox="0 0 120 120"
                    role="img"
                    aria-label={`${s.name}: ${s.val} trên ${MAX}`}
                    className="h-auto w-full max-w-[132px] overflow-visible"
                  >
                    <circle cx="60" cy="60" r={R} fill="none" strokeWidth="10" className="stroke-secondary" />
                    <circle
                      cx="60"
                      cy="60"
                      r={R}
                      fill="none"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${shown} ${CIRC}`}
                      className={`stroke-primary ${styles.ringValue}`}
                      style={{ "--n": n, "--len": shown } as React.CSSProperties}
                    />
                    <text
                      x="60"
                      y="60"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground font-logo text-[40px]"
                    >
                      {s.val}
                    </text>
                    <text x="60" y="96" textAnchor="middle" className="fill-muted-foreground text-[11px]">
                      / {MAX}
                    </text>
                  </svg>
                  <span className="font-heading text-[13px] leading-tight tracking-wide uppercase sm:text-[15px]">
                    {s.name}
                  </span>
                  <span className="hidden text-[13px] leading-snug text-muted-foreground sm:block">
                    {s.why}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[13px] text-muted-foreground">
            Chấm theo thang 1–7 của Power Grid trong truyện tranh Marvel: 1 tương đương người
            thường, 7 là cấp độ vũ trụ.
          </p>
        </div>
      </section>

      {/* Tiểu sử */}
      <section aria-labelledby="bio-h" className="border-t border-border/60 py-10 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-7 px-4 lg:grid-cols-[180px_minmax(0,1fr)_280px] lg:gap-10">
          <div className="self-start border-t-2 border-primary pt-3.5">
            <h2 id="bio-h" className="font-logo text-4xl leading-none uppercase">
              Tiểu sử
            </h2>
          </div>

          <div className="flex min-w-0 flex-col gap-7">
            <p className="text-lg leading-relaxed">
              Trí tuệ thiên tài, khát vọng quyền lực không đáy cùng cái tôi ngạo mạn đã biến
              Victor von Doom thành một trong những phản diện đáng gờm nhất thế giới.
            </p>
            {CHAPTERS_BEFORE_PANEL.map((c) => (
              <ChapterBlock key={c.title} {...c} />
            ))}
            <figure className="flex flex-col gap-2">
              <Image
                src="/phan-dien/doctor-doom/panel.jpg"
                alt="Khung truyện cổ điển: Doctor Doom giới thiệu cỗ máy thời gian"
                width={800}
                height={563}
                sizes="(min-width: 1024px) 560px, 100vw"
                className="w-full rounded-lg border border-border"
              />
              <figcaption className="text-[13px] text-muted-foreground">
                Doom phô diễn cỗ máy thời gian trong lần đầu đối đầu Fantastic Four.
              </figcaption>
            </figure>
            {CHAPTERS_AFTER_PANEL.map((c) => (
              <ChapterBlock key={c.title} {...c} />
            ))}
          </div>

          <dl
            aria-label="Thông tin nhân vật"
            className="grid self-start overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 lg:sticky lg:top-20 lg:grid-cols-1"
          >
            {FACTS.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 border-b border-border px-5 py-3.5 last:border-b-0">
                <dt className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{label}</dt>
                <dd className="leading-normal font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Năng lực */}
      <section aria-labelledby="pow-h" className="border-t border-border/60 py-10 sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col gap-7 px-4">
          <div>
            <p className={eyebrow}>Sức mạnh &amp; năng lực</p>
            <h2 id="pow-h" className={sectionTitle}>
              Khi khoa học gặp ma thuật
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {POWERS.map((p) => (
              <article key={p.title} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5">
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">{p.kind}</p>
                <h3 className="font-heading text-xl leading-snug">{p.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Điểm yếu */}
      <section aria-labelledby="weak-h" className="border-t border-border/60 py-10 sm:py-14">
        <div className="mx-auto flex max-w-5xl flex-col gap-7 px-4">
          <div>
            <p className={eyebrow}>Điểm yếu</p>
            <h2 id="weak-h" className={sectionTitle}>
              Những vết nứt sau mặt nạ sắt
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {WEAKNESSES.map((w) => (
              <div key={w.title} className="flex flex-col gap-1.5 border-t-2 border-destructive pt-3.5">
                <h3 className="font-heading text-xl">{w.title}</h3>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{w.body}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Doctor Doom cùng hình ảnh nhân vật thuộc bản quyền của Marvel.
          </p>
        </div>
      </section>
    </div>
  );
}
