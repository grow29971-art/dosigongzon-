import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "도시공존 서비스 이용약관.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="px-5 pt-14 pb-12 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/signup"
          className="w-9 h-9 rounded-full bg-surface-alt flex items-center justify-center"
        >
          <ArrowLeft size={18} className="text-text-sub" />
        </Link>
        <h1 className="text-[20px] font-extrabold text-text-main">이용약관</h1>
      </div>

      <div className="space-y-6 text-[13px] text-text-sub leading-relaxed">
        {/* 제1장 총칙 */}
        <div className="text-[14px] font-extrabold text-primary">제1장 총칙</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제1조 (목적)</h2>
          <p>
            이 약관은 도시공존(이하 &quot;운영자&quot;)이 운영하는 길고양이 돌봄 시민 참여 플랫폼 &quot;도시공존&quot;(이하 &quot;서비스&quot;)의
            이용조건 및 절차, 운영자와 회원 간의 권리·의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제2조 (정의)</h2>
          <p className="mb-1">이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>&quot;서비스&quot;란 운영자가 제공하는 웹 및 모바일 플랫폼(dosigongzon.com)을 통해 이용할 수 있는 모든 서비스를 말합니다.</li>
            <li>&quot;회원&quot;이란 이 약관에 동의하고 회원가입을 한 자로서, 운영자와 서비스 이용계약을 체결한 자를 말합니다.</li>
            <li>&quot;아이디(ID)&quot;란 회원의 식별과 서비스 이용을 위하여 회원이 설정하고 운영자가 승인한 이메일 주소를 말합니다.</li>
            <li>&quot;비밀번호&quot;란 회원의 동일성 확인과 회원정보의 보호를 위하여 회원이 설정한 문자와 숫자의 조합을 말합니다.</li>
            <li>&quot;게시물&quot;이란 회원이 서비스를 이용함에 있어 서비스에 게시한 문자, 사진, 위치정보 등의 정보를 말합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제3조 (약관의 효력 및 변경)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>이 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다.</li>
            <li>운영자는 합리적인 사유가 발생할 경우 관련 법령에 위배되지 않는 범위 내에서 이 약관을 변경할 수 있으며, 약관이 변경된 경우에는 지체 없이 공지합니다.</li>
            <li>회원은 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용할 경우 약관의 변경사항에 동의한 것으로 봅니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제4조 (약관 외 준칙)</h2>
          <p>
            이 약관에서 정하지 아니한 사항과 이 약관의 해석에 관하여는 「전자상거래 등에서의 소비자보호에 관한 법률」,
            「약관의 규제에 관한 법률」, 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」 등 관련 법령에 따릅니다.
          </p>
        </section>

        {/* 제2장 서비스 이용계약 */}
        <div className="text-[14px] font-extrabold text-primary pt-2">제2장 서비스 이용계약</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제5조 (이용계약의 체결)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>이용계약은 회원이 되고자 하는 자(이하 &quot;가입신청자&quot;)가 이 약관의 내용에 동의한 후 회원가입 신청을 하고, 운영자가 이를 승낙함으로써 체결됩니다.</li>
            <li>회원가입은 이메일 가입 또는 소셜 계정(Google, 카카오) 연동 방식으로 할 수 있습니다.</li>
            <li>운영자는 다음 각 호에 해당하는 경우 가입신청을 거절하거나 사후에 이용계약을 해지할 수 있습니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>타인의 명의를 이용한 경우</li>
                <li>허위의 정보를 기재한 경우</li>
                <li>기타 회원으로 등록하는 것이 서비스 운영에 현저히 지장이 있다고 판단되는 경우</li>
              </ul>
            </li>
            <li>
              <b>만 14세 미만 가입 제한.</b> 정보통신망법 시행령 제16조에 따라 만 14세 미만은 일반 회원가입을 할 수 없습니다.
              만 14세 미만이 도시공존을 이용하고자 하는 경우, 법정대리인(보호자)이 서비스 운영자(grow29971@gmail.com)에게
              직접 메일로 보호자 동의 의사와 함께 가입을 신청해야 하며, 운영자가 동의 의사를 확인한 후에 가입을 처리합니다.
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제6조 (회원탈퇴 및 자격상실)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 언제든지 서비스 내 탈퇴 기능을 통하여 이용계약 해지를 신청할 수 있으며, 운영자는 즉시 처리합니다.</li>
            <li>회원이 다음 각 호의 사유에 해당하는 경우 운영자는 회원자격을 제한 또는 정지시킬 수 있습니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>가입 신청 시 허위 내용을 등록한 경우</li>
                <li>다른 사람의 서비스 이용을 방해하거나 그 정보를 도용하는 등 질서를 위협하는 경우</li>
                <li>서비스를 이용하여 법령 또는 이 약관이 금지하는 행위를 하는 경우</li>
                <li>동물 학대를 조장하거나 동물의 안전을 위협하는 행위를 하는 경우</li>
              </ul>
            </li>
          </ol>
        </section>

        {/* 제3장 서비스 이용 */}
        <div className="text-[14px] font-extrabold text-primary pt-2">제3장 서비스 이용</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제7조 (서비스의 제공 및 변경)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 다음과 같은 서비스를 제공합니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>길고양이 위치 등록 및 지도 서비스 (공개 범위: 전체 / 내 서클 / 나만 보기)</li>
                <li>Private Circle — 회원이 직접 승인한 이웃에게만 핀을 노출하는 서클 관리</li>
                <li>돌봄 커뮤니티 (게시판, 댓글, 1:1 쪽지)</li>
                <li>보호지침, 약품 가이드 등 돌봄 정보 제공</li>
                <li>동물병원·약국 위치 정보 제공</li>
                <li>학대 경보 및 긴급 신고 연계</li>
                <li>AI 집사 챗봇 상담 (참고용 정보 제공)</li>
                <li>푸시 알림 서비스</li>
              </ul>
            </li>
            <li>서비스는 무료로 제공되며, 운영자는 서비스의 내용을 변경할 수 있습니다. 이 경우 변경 내용과 적용일자를 사전에 공지합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제8조 (서비스의 중단)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 시스템 점검, 교체, 고장, 통신 두절 등의 사유가 발생한 경우 서비스의 제공을 일시적으로 중단할 수 있습니다.</li>
            <li>천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공을 제한하거나 일시 중단할 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제9조 (위치정보의 이용)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>서비스는 동물 보호를 목적으로 길고양이 위치를 <b>동(洞) 단위</b>로만 표기합니다. 정확한 골목·건물 단위 좌표는 회원에게도 제공되지 않습니다.</li>
            <li>등록 시 입력된 좌표에는 자동으로 <b>약 ±444m의 랜덤 오프셋</b>이 적용되어 저장되며, 비로그인 외부인에게는 추가로 <b>약 ±500m</b>의 결정적 퍼징이 적용됩니다(합산 최대 약 ±944m).</li>
            <li>비로그인 외부인에게는 개별 핀의 사진·이름·동 이름이 노출되지 않고, 동 단위 카운트만 표시됩니다.</li>
            <li>회원은 등록 시 공개 범위를 <b>전체 공개·내 서클·나만 보기</b> 중 선택할 수 있으며, 등록 후에도 본인 핀을 통해 언제든지 변경할 수 있습니다.</li>
            <li>업로드되는 사진은 EXIF(GPS 메타데이터 포함) 정보가 자동으로 제거된 후 저장됩니다.</li>
            <li>회원은 고양이의 정확한 위치 정보를 외부에 무단 공유하여 동물의 안전을 위험에 빠뜨리는 행위를 하여서는 안 됩니다.</li>
            <li><b>사용자 본인의 위치(GPS) 측위는 현재 사용하지 않습니다.</b> 지도 위치 지정은 이용자가 지도에서 직접 선택하는 방식이며, 사용자가 직접 입력한 활동 지역명(동·구) 등 비측위 데이터만 저장될 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제9조의2 (AI 집사 챗봇)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>AI 집사 챗봇은 Google Gemini 기반 자동 응답 시스템으로, <b>참고용 정보 제공만을 목적</b>으로 합니다.</li>
            <li>AI 응답은 <b>의료 진단·법률 자문이 아니며</b>, 응급·의료·법률 사안은 반드시 자격 있는 수의사·변호사 등 전문가의 직접 판단을 받아야 합니다.</li>
            <li>AI 응답의 정확성·완전성에 대해 운영자는 보증하지 않으며, 회원이 AI 응답을 신뢰하여 발생한 결과에 대한 책임은 회원 본인에게 있습니다.</li>
            <li>대화 내용은 도시공존 서버에 저장되지 않으며, 응답이 끝난 즉시 메모리에서 소실됩니다(상세는 개인정보처리방침 제5조의2-2 참조).</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제9조의3 (쇼핑몰 등 유료 서비스)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 서비스 내에서 실물 상품 및 후원형 상품을 판매하는 쇼핑몰을 운영할 수 있습니다.</li>
            <li>판매자 정보, 배송, 교환·반품·환불에 관한 세부 사항은 <a href="/shop/policy" className="text-primary underline">쇼핑몰 이용안내</a>에 따르며, 이는 본 약관의 일부를 구성합니다.</li>
            <li>결제는 전자결제대행사(토스페이먼츠)를 통해 처리되며, 운영자는 카드번호 등 결제수단 정보를 저장하지 않습니다.</li>
            <li>회원은 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조에 따라 상품을 받은 날부터 7일 이내에 청약철회를 할 수 있습니다. 단, 같은 법에 따라 청약철회가 제한되는 경우는 예외로 합니다.</li>
            <li>만 19세 미만의 회원이 법정대리인의 동의 없이 결제한 경우, 회원 본인 또는 법정대리인은 「민법」에 따라 해당 계약을 취소할 수 있습니다.</li>
            <li>쇼핑몰 수익의 일부는 길고양이 보호 활동에 사용되며, 누적 사용 현황은 서비스 내에 공개합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제9조의4 (포인트)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 출석 등 서비스 참여 활동에 대한 보상으로 포인트를 지급할 수 있으며, 포인트는 쇼핑몰 결제 시 1포인트당 1원으로 사용할 수 있습니다.</li>
            <li>포인트는 무상으로 지급되는 혜택으로서 현금으로 환급되지 않으며, 타인에게 양도할 수 없습니다.</li>
            <li>포인트를 사용한 주문이 취소·환불되는 경우, 사용한 포인트는 회원에게 자동으로 반환됩니다.</li>
            <li>부정한 방법(비정상적 반복 행위, 다중 계정, 시스템 악용 등)으로 적립된 포인트는 사전 통지 후 회수될 수 있으며, 관련 계정은 이용이 제한될 수 있습니다.</li>
            <li>회원 탈퇴 시 보유 포인트는 소멸되며, 복구되지 않습니다.</li>
            <li>운영자는 포인트 제도(적립 기준·사용 조건 등)를 변경할 수 있으며, 회원에게 불리한 변경은 제3조에 따라 사전 공지합니다.</li>
          </ol>
        </section>

        {/* 제4장 의무 */}
        <div className="text-[14px] font-extrabold text-primary pt-2">제4장 의무</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제10조 (운영자의 의무)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 관련 법령과 이 약관이 금지하는 행위를 하지 않으며, 지속적이고 안정적으로 서비스를 제공하기 위하여 최선을 다합니다.</li>
            <li>운영자는 회원의 개인정보 보호를 위한 보안 시스템을 갖추어야 하며, 개인정보처리방침을 공시하고 준수합니다.</li>
            <li>운영자는 서비스 이용과 관련한 회원의 불만사항을 접수한 경우 이를 신속하게 처리하여야 합니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제11조 (회원의 의무)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원은 다음 행위를 하여서는 안 됩니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>가입 신청 또는 변경 시 허위 내용을 등록하는 행위</li>
                <li>타인의 정보를 도용하는 행위</li>
                <li>서비스에서 얻은 정보를 운영자의 사전 승낙 없이 상업적으로 이용하는 행위</li>
                <li>운영자 및 제3자의 지식재산권을 침해하는 행위</li>
                <li>운영자 및 제3자의 명예를 손상시키거나 업무를 방해하는 행위</li>
                <li>동물 학대를 조장하거나 학대 정보를 유포하는 행위</li>
                <li>외설·폭력적 메시지, 기타 공서양속에 반하는 정보를 공개 또는 게시하는 행위</li>
                <li>기타 불법적이거나 부당한 행위</li>
              </ul>
            </li>
            <li>회원은 아이디와 비밀번호의 관리에 대한 책임을 지며, 이를 제3자에게 이용하게 해서는 안 됩니다.</li>
          </ol>
        </section>

        {/* 제5장 게시물 */}
        <div className="text-[14px] font-extrabold text-primary pt-2">제5장 게시물</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제12조 (게시물의 저작권 및 이용 허락)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원이 서비스 내에 게시한 게시물(글, 사진, 고양이 프로필, 돌봄 기록 등)의 저작권은 해당 회원에게 귀속됩니다.</li>
            <li>회원은 서비스 가입 시 다음 범위 내에서 운영자가 게시물을 이용할 수 있도록 <b>비독점적·무상·무기한</b>의 이용을 허락합니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>서비스 내 표시·공유·검색 노출</li>
                <li>SNS 공유 카드·OpenGraph 미리보기 등 외부 링크 공유 기능</li>
                <li>서비스 홍보·언론 보도 시 일부 인용(개인 식별 정보 제외, 또는 회원 동의를 받은 경우에 한함)</li>
                <li>서비스 개선·기술적 필요 범위 내 수정·복제·편집 (형식 변환·썸네일 생성 등)</li>
              </ul>
            </li>
            <li>회원은 본인이 권리를 보유하지 않은 저작물(타인의 사진·글 등)을 무단으로 게시해서는 안 됩니다. 이로 인해 제3자와 분쟁이 발생한 경우 <b>해당 게시 회원이 직접 책임</b>지며, 운영자는 분쟁에 개입할 의무가 없습니다.</li>
            <li>회원은 언제든지 자신의 게시물을 삭제할 수 있으며, 탈퇴 시 회원의 게시물은 원칙적으로 함께 삭제됩니다. 다만 다른 회원의 기록(예: 공동 돌봄 기록)과 결합된 경우 익명화 처리 후 유지될 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제13조 (게시물의 관리)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>회원의 게시물이 「정보통신망법」 및 「저작권법」 등 관련 법령에 위반되는 내용을 포함하는 경우, 권리자는 관련 법령이 정한 절차에 따라 해당 게시물의 게시중단 및 삭제 등을 요청할 수 있으며, 운영자는 관련 법령에 따라 조치를 취하여야 합니다.</li>
            <li>운영자는 권리자의 요청이 없는 경우에도 다음 각 호에 해당하는 게시물에 대해서는 사전 통보 없이 삭제 또는 비공개 처리할 수 있습니다.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>동물 학대, 허위 신고 등 서비스 운영 취지에 반하는 게시물</li>
                <li>스팸, 광고성 게시물</li>
                <li>타인의 명예를 훼손하거나 권리를 침해하는 게시물</li>
                <li>기타 관련 법령에 위반된다고 판단되는 게시물</li>
              </ul>
            </li>
            <li>회원이 게시물을 신고한 경우, 운영자는 접수일로부터 <b>3영업일 이내</b>에 검토를 시작하고 <b>7영업일 이내</b>에 처리 결과를 결정합니다. 불가피한 사유로 기한 내 처리가 어려운 경우 사유와 처리 예정일을 안내합니다.</li>
            <li>신고 처리 결과에 이의가 있는 경우, 결정 통지일로부터 <b>30일 이내</b>에 이의를 제기할 수 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제13조의2 (저작권 침해 신고 절차)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>본인의 저작물이 회원에 의해 무단으로 게시되었다고 판단되는 권리자는 「저작권법」 제103조에 따라 운영자에게 해당 게시물의 게시중단(전송 중단)을 요청할 수 있습니다.</li>
            <li>요청 시 다음 정보를 <b>grow29971@gmail.com</b>으로 보내주십시오.
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>침해받은 저작물의 정보(제목·URL·캡처 등)</li>
                <li>도시공존 내 침해 게시물의 URL 또는 식별 가능한 정보</li>
                <li>권리자 본인임을 증명할 수 있는 자료(주민등록증/등기·등록증명서 등 일부)</li>
                <li>침해 사실에 대한 진정한 신고임을 확인하는 서명·날인</li>
              </ul>
            </li>
            <li>운영자는 접수일로부터 <b>지체 없이(원칙 3영업일 이내)</b> 해당 게시물을 게시중단하고 권리자·게시자 양측에 통지합니다.</li>
            <li>게시자는 「저작권법」 제103조 제3항에 따라 정당한 권리가 있음을 소명하여 <b>재개 요청</b>을 할 수 있으며, 운영자는 권리자에게 통지 후 적법 절차에 따라 처리합니다.</li>
            <li>허위 신고로 타인에게 손해를 입힌 자는 「저작권법」 제103조 제6항에 따라 민·형사상 책임을 질 수 있습니다.</li>
          </ol>
        </section>

        {/* 제6장 손해배상 및 면책 */}
        <div className="text-[14px] font-extrabold text-primary pt-2">제6장 손해배상 및 면책</div>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제14조 (손해배상)</h2>
          <p>
            운영자 또는 회원이 이 약관의 규정을 위반하여 상대방에게 손해가 발생한 경우, 해당 당사자는 상대방에게 발생한 손해를 배상하여야 합니다.
          </p>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제15조 (면책조항)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적인 사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
            <li>운영자는 회원의 귀책사유로 인한 서비스 이용 장애에 대하여 책임을 지지 않습니다.</li>
            <li>운영자는 회원이 게재한 정보, 자료의 사실성, 신뢰도, 정확성에 대해서는 책임을 지지 않습니다.</li>
            <li>운영자는 회원 간 또는 회원과 제3자 간에 서비스를 매개로 한 분쟁에 대해 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임을 지지 않습니다.</li>
          </ol>
        </section>

        <section>
          <h2 className="text-[14px] font-bold text-text-main mb-2">제16조 (분쟁해결)</h2>
          <ol className="list-decimal pl-5 space-y-1">
            <li>운영자는 회원이 제기하는 정당한 의견이나 불만을 반영하고, 피해 보상 처리를 위하여 피해 보상 처리 기구를 운영합니다.</li>
            <li>운영자와 회원 간 발생한 분쟁에 관한 소송은 대한민국 법원을 관할 법원으로 합니다.</li>
            <li>운영자와 회원 간 제기된 소송에는 대한민국 법을 적용합니다.</li>
          </ol>
        </section>

        <div
          className="rounded-xl px-4 py-3 mt-4"
          style={{ backgroundColor: "#F5F3EE", border: "1px solid rgba(0,0,0,0.06)" }}
        >
          <p className="text-[11px] text-text-light"><b>부칙</b></p>
          <p className="text-[11px] text-text-light mt-1">제1조 (시행일) 이 약관은 2026년 4월 20일부터 시행합니다.</p>
          <p className="text-[11px] text-text-light mt-1">제2조 (개정) 2026년 5월 18일자로 위치정보 처리 기준 명확화, Private Circle 추가, AI 챗봇 면책 조항 신설, 저작권 침해 신고 절차 명시.</p>
        </div>
      </div>
    </div>
  );
}
