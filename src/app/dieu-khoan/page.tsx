import type { Metadata } from "next";

// Nội dung lấy từ tài liệu "Điều khoản và điều kiện sử dụng" của Ban tổ chức
// (Google Doc). Sửa điều khoản: sửa ở đây + cập nhật TERMS_UPDATED_AT.
// Checkout bắt buộc tick đồng ý trang này (xem ShippingCheckout + prepareCheckout).
const TERMS_UPDATED_AT = "15/10/2026";

export const metadata: Metadata = {
  title: "Điều khoản và điều kiện sử dụng – Đa vũ trụ Marvel VN",
  description:
    "Điều khoản sử dụng, chính sách đặt vé, hoàn tiền và bảo vệ dữ liệu cá nhân của dvtmarvelvn.com.",
};

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="font-heading text-xl tracking-wide text-primary">{title}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-primary">{children}</ul>
  );
}

const SECTIONS = [
  ["pham-vi", "1. Phạm vi dịch vụ"],
  ["tai-khoan", "2. Điều kiện đăng ký tài khoản"],
  ["dang-nhap", "3. Phương thức đăng ký và đăng nhập"],
  ["bao-mat", "4. Bảo mật tài khoản"],
  ["dat-ve", "5. Đặt vé, thanh toán và giao vé"],
  ["hoan-tien", "6. Hủy, đổi và hoàn tiền"],
  ["tham-du", "7. Quy định khi tham dự Sự kiện"],
  ["hanh-vi-cam", "8. Hành vi bị cấm"],
  ["du-lieu", "9. Thu thập và bảo vệ dữ liệu cá nhân"],
  ["hinh-anh", "10. Quyền sử dụng hình ảnh, video tại Sự kiện"],
  ["so-huu-tri-tue", "11. Sở hữu trí tuệ và tuyên bố miễn trừ"],
  ["gioi-han", "12. Giới hạn trách nhiệm"],
  ["thay-doi", "13. Thay đổi điều khoản"],
] as const;

const title = Object.fromEntries(SECTIONS) as Record<(typeof SECTIONS)[number][0], string>;

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="font-heading text-3xl tracking-wide text-primary sm:text-4xl">
        ĐIỀU KHOẢN VÀ ĐIỀU KIỆN SỬ DỤNG
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Website: dvtmarvelvn.com · Cập nhật lần cuối: {TERMS_UPDATED_AT}
      </p>

      <p className="mt-6 rounded-lg border border-primary/40 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
        Khi tạo tài khoản hoặc sử dụng website, bạn xác nhận đã đọc, hiểu và đồng ý với
        các điều khoản dưới đây. Nếu không đồng ý, vui lòng không đăng ký và không sử
        dụng dịch vụ.
      </p>

      <nav
        aria-label="Mục lục"
        className="mt-6 rounded-lg border border-border bg-card p-4 text-sm"
      >
        <p className="mb-2 font-medium text-foreground">Mục lục</p>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-10 flex flex-col gap-10">
        <Section id="pham-vi" title={title["pham-vi"]}>
          <List>
            <li>
              Website cung cấp dịch vụ bán vé tham dự sự kiện giao lưu và chiếu phim
              offline Avengers: Doomsday (sau đây gọi là “Sự kiện”). Thông tin về thời
              gian, địa điểm, giá vé và số lượng vé được hiển thị trên từng trang sự kiện
              và có thể thay đổi theo thông báo của chúng tôi.
            </li>
          </List>
        </Section>

        <Section id="tai-khoan" title={title["tai-khoan"]}>
          <List>
            <li>Bạn phải từ đủ 16 tuổi trở lên để đăng ký tài khoản.</li>
            <li>
              Nếu bạn dưới 18 tuổi, bạn cam kết đã được cha mẹ hoặc người giám hộ đồng ý
              cho việc đăng ký, mua vé và cung cấp thông tin cá nhân.
            </li>
            <li>
              Thông tin đăng ký phải chính xác, đầy đủ và cập nhật. Mỗi người chỉ nên sử
              dụng một tài khoản.
            </li>
            <li>
              Chúng tôi có quyền từ chối đăng ký hoặc khóa tài khoản nếu phát hiện thông
              tin sai lệch hoặc vi phạm điều khoản.
            </li>
          </List>
        </Section>

        <Section id="dang-nhap" title={title["dang-nhap"]}>
          <p>Bạn có thể đăng ký/đăng nhập bằng một trong hai cách:</p>
          <h3 className="font-semibold text-foreground">3.1. Tài khoản Google</h3>
          <List>
            <li>
              Khi chọn đăng nhập bằng Google, chúng tôi nhận từ Google các thông tin cơ
              bản: họ tên, địa chỉ email và ảnh đại diện. Chúng tôi không nhận mật khẩu
              Google của bạn.
            </li>
            <li>
              Việc đăng nhập bằng Google còn tuân theo điều khoản và chính sách quyền
              riêng tư của Google.
            </li>
            <li>
              Bạn có thể thu hồi quyền truy cập của website trong phần cài đặt tài khoản
              Google bất cứ lúc nào. Khi đó bạn có thể không đăng nhập được vào tài khoản
              trên website.
            </li>
          </List>
          <h3 className="font-semibold text-foreground">
            3.2. Tài khoản tự tạo (email và mật khẩu)
          </h3>
          <List>
            <li>Bạn tự đặt mật khẩu và chịu trách nhiệm giữ bí mật mật khẩu.</li>
            <li>Mật khẩu được lưu trữ dưới dạng đã mã hóa.</li>
          </List>
        </Section>

        <Section id="bao-mat" title={title["bao-mat"]}>
          <List>
            <li>Bạn chịu trách nhiệm về mọi hoạt động phát sinh từ tài khoản của mình.</li>
            <li>
              Hãy thông báo ngay cho chúng tôi qua fanpage Đa Vũ Trụ Marvel VN nếu nghi
              ngờ tài khoản bị truy cập trái phép.
            </li>
            <li>
              Chúng tôi không chịu trách nhiệm cho thiệt hại phát sinh do bạn để lộ thông
              tin đăng nhập hoặc chia sẻ tài khoản cho người khác.
            </li>
          </List>
        </Section>

        <Section id="dat-ve" title={title["dat-ve"]}>
          <List>
            <li>
              Đơn hàng chỉ được xác nhận khi bạn hoàn tất thanh toán và nhận được thông
              báo xác nhận từ chúng tôi.
            </li>
            <li>Giá vé niêm yết bằng VND.</li>
            <li>Phương thức thanh toán: Chuyển khoản.</li>
            <li>
              Vé được giao theo hình thức vé điện tử và vé giấy giao tận nơi. Với vé giao
              tận nơi, bạn cần cung cấp số điện thoại và địa chỉ nhận hàng chính xác.
              Chúng tôi không chịu trách nhiệm nếu giao thất bại do thông tin sai hoặc
              không liên lạc được người nhận.
            </li>
            <li>
              Vé được bán theo số lượng giới hạn. Chúng tôi có thể giới hạn số vé tối đa
              cho mỗi tài khoản/đơn hàng để hạn chế việc gom vé.
            </li>
          </List>
        </Section>

        <Section id="hoan-tien" title={title["hoan-tien"]}>
          <List>
            <li>
              <strong>
                Vé đã mua không được hủy, đổi hoặc hoàn tiền trong bất kì trường hợp nào.
              </strong>
            </li>
            <li>
              Nếu Sự kiện bị hủy do lỗi phía chúng tôi, bạn được hoàn 100% giá trị vé
              trong vòng 10 ngày làm việc.
            </li>
            <li>
              Nếu Sự kiện thay đổi thời gian hoặc địa điểm, chúng tôi sẽ thông báo qua
              email/số điện thoại đã đăng ký.
            </li>
            <li>
              Chúng tôi không chịu trách nhiệm với các trường hợp bất khả kháng (thiên
              tai, dịch bệnh, quyết định của cơ quan nhà nước...).
            </li>
          </List>
        </Section>

        <Section id="tham-du" title={title["tham-du"]}>
          <List>
            <li>
              Người tham dự phải đủ 16 tuổi trở lên tính đến ngày diễn ra Sự kiện. Người
              dưới 16 tuổi không được mua vé hoặc tham dự, kể cả khi có người lớn đi cùng
              hoặc có sự đồng ý của cha mẹ. Người từ đủ 16 đến dưới 18 tuổi cần có sự
              đồng ý của cha mẹ hoặc người giám hộ hợp pháp.
            </li>
            <li>
              Ban tổ chức có quyền yêu cầu xuất trình CCCD, hộ chiếu hoặc giấy tờ hợp lệ
              khác có ngày sinh khi nhận vé hoặc tại cổng vào. Người không xuất trình được
              giấy tờ có thể bị từ chối vào Sự kiện.
            </li>
            <li>
              Ban tổ chức có quyền hủy đơn hàng, vô hiệu hóa vé, từ chối cho vào Sự kiện
              và không hoàn tiền nếu người mua hoặc người tham dự chưa đủ 16 tuổi hoặc
              cung cấp sai thông tin về độ tuổi.
            </li>
            <li>
              Người tham dự phải tuân thủ nội quy địa điểm tổ chức và hướng dẫn của Ban tổ
              chức. Nghiêm cấm quay phim, ghi âm hoặc phát tán trái phép nội dung phim.
            </li>
            <li>
              Ban tổ chức có quyền từ chối cho vào hoặc mời người vi phạm ra khỏi Sự kiện
              mà không hoàn tiền.
            </li>
            <li>Vé chỉ có giá trị cho đúng suất chiếu đã mua.</li>
          </List>
        </Section>

        <Section id="hanh-vi-cam" title={title["hanh-vi-cam"]}>
          <p>Bạn không được:</p>
          <List>
            <li>Mua vé bằng thông tin giả mạo hoặc tài khoản của người khác.</li>
            <li>
              Dùng bot, script hoặc công cụ tự động để mua vé hay gây quá tải hệ thống.
            </li>
            <li>
              Bán lại vé với giá cao hơn giá niêm yết (đầu cơ, “phe vé”) hoặc làm giả vé.
            </li>
            <li>Tấn công, dò quét lỗ hổng, can thiệp trái phép vào website.</li>
            <li>Sử dụng website cho mục đích vi phạm pháp luật Việt Nam.</li>
          </List>
          <p>
            Nếu vi phạm, chúng tôi có quyền hủy đơn hàng, vô hiệu hóa vé, khóa tài khoản
            và chuyển thông tin cho cơ quan có thẩm quyền khi cần.
          </p>
        </Section>

        <Section id="du-lieu" title={title["du-lieu"]}>
          <List>
            <li>
              Dữ liệu chúng tôi thu thập: họ tên, email, ảnh đại diện (nếu đăng nhập
              Google), mật khẩu đã mã hóa (nếu tự đăng ký), số điện thoại, địa chỉ giao
              hàng, lịch sử đơn hàng và dữ liệu kỹ thuật cơ bản (IP, thiết bị, trình
              duyệt).
            </li>
            <li>
              Mục đích sử dụng: tạo và quản lý tài khoản, xử lý đơn hàng, giao vé, liên hệ
              về đơn hàng/Sự kiện, hỗ trợ khách hàng, phòng chống gian lận và tuân thủ
              pháp luật.
            </li>
            <li>
              Chúng tôi không gửi email marketing và không bán dữ liệu cá nhân của bạn cho
              bên thứ ba.
            </li>
            <li>
              Chia sẻ dữ liệu: chỉ với đơn vị vận chuyển, đối tác thanh toán, đơn vị tổ
              chức Sự kiện (trong phạm vi cần thiết) hoặc cơ quan nhà nước theo yêu cầu
              của pháp luật.
            </li>
            <li>
              Chúng tôi áp dụng biện pháp kỹ thuật và quản lý hợp lý để bảo vệ dữ liệu,
              nhưng không thể đảm bảo an toàn tuyệt đối trên môi trường Internet.
            </li>
            <li>
              Bằng việc đăng ký tài khoản, bạn đồng ý với việc thu thập và xử lý dữ liệu
              như trên.
            </li>
          </List>
        </Section>

        <Section id="hinh-anh" title={title["hinh-anh"]}>
          <List>
            <li>
              <strong>Ghi hình tại Sự kiện:</strong> Ban tổ chức (và đơn vị được Ban tổ
              chức ủy quyền) có thể chụp ảnh, quay video, ghi âm tại Sự kiện, trong đó có
              thể xuất hiện hình ảnh, giọng nói của người tham dự.
            </li>
            <li>
              <strong>Đồng ý của người tham dự:</strong> Bằng việc mua vé và tham dự Sự
              kiện, bạn đồng ý để Ban tổ chức sử dụng hình ảnh, video, âm thanh có xuất
              hiện bạn cho mục đích truyền thông, quảng bá của Ban tổ chức.
            </li>
            <li>
              <strong>Phạm vi sử dụng:</strong> Gồm website dvtmarvelvn.com, fanpage, mạng
              xã hội, kênh truyền thông của Ban tổ chức và các ấn phẩm quảng bá cho Sự
              kiện này cũng như các sự kiện sau của Ban tổ chức.
            </li>
            <li>
              <strong>Không bồi hoàn:</strong> Việc sử dụng nêu trên không phát sinh thù
              lao, phí bản quyền hay quyền lợi nào cho người được ghi hình.
            </li>
            <li>
              <strong>Giới hạn sử dụng:</strong> Ban tổ chức không bán hình ảnh, video của
              bạn cho bên thứ ba và không sử dụng theo cách xúc phạm danh dự, nhân phẩm
              của bạn.
            </li>
            <li>
              <strong>Người từ đủ 16 đến dưới 18 tuổi:</strong> Sự đồng ý tại khoản 2
              được hiểu là đã có sự đồng ý của cha mẹ hoặc người giám hộ hợp pháp theo
              mục 7.
            </li>
            <li>
              <strong>Từ chối ghi hình:</strong> Nếu không muốn xuất hiện trong hình ảnh,
              video, bạn cần thông báo cho Ban tổ chức tại quầy check-in trước khi vào Sự
              kiện hoặc gửi email tới{" "}
              <a
                href="mailto:support@dvtmarvelvn.com"
                className="text-accent underline-offset-2 hover:underline"
              >
                support@dvtmarvelvn.com
              </a>{" "}
              trước ngày diễn ra Sự kiện. Ban tổ chức sẽ cố gắng hạn chế ghi hình bạn
              nhưng không đảm bảo tránh được hoàn toàn tại khu vực đông người.
            </li>
            <li>
              <strong>Yêu cầu gỡ bỏ:</strong> Sau Sự kiện, bạn có thể gửi yêu cầu gỡ hình
              ảnh/video của mình tới fanpage Đa Vũ Trụ Marvel VN. Ban tổ chức sẽ xử lý
              trong vòng 10 ngày làm việc. Nội dung đã được chia sẻ lại bởi bên thứ ba
              ngoài sự kiểm soát của Ban tổ chức có thể không gỡ được hết.
            </li>
            <li>
              Việc xử lý hình ảnh, video được thực hiện theo mục 9 (Thu thập và bảo vệ dữ
              liệu cá nhân).
            </li>
          </List>
        </Section>

        <Section id="so-huu-tri-tue" title={title["so-huu-tri-tue"]}>
          <List>
            <li>
              Nội dung, giao diện, logo, hình ảnh của website thuộc quyền của chúng tôi
              hoặc bên cấp phép, không được sao chép khi chưa có sự đồng ý bằng văn bản.
            </li>
            <li>
              Marvel, Avengers và các nhãn hiệu liên quan thuộc sở hữu của chủ sở hữu
              tương ứng.
            </li>
          </List>
        </Section>

        <Section id="gioi-han" title={title["gioi-han"]}>
          <List>
            <li>
              Dịch vụ được cung cấp trên cơ sở “hiện có”. Chúng tôi nỗ lực duy trì website
              hoạt động ổn định nhưng không đảm bảo không gián đoạn hay không có lỗi.
            </li>
            <li>
              Trong phạm vi pháp luật cho phép, trách nhiệm tối đa của chúng tôi với bạn
              không vượt quá giá trị đơn hàng liên quan đến khiếu nại.
            </li>
          </List>
        </Section>

        <Section id="thay-doi" title={title["thay-doi"]}>
          <List>
            <li>
              Chúng tôi có thể cập nhật điều khoản này và sẽ đăng phiên bản mới trên
              website kèm ngày cập nhật mà không cần báo trước. Việc bạn tiếp tục sử dụng
              dịch vụ sau thời điểm đó được xem là chấp nhận điều khoản mới.
            </li>
          </List>
        </Section>
      </div>
    </div>
  );
}
