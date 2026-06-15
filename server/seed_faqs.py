"""
Pre-seed script: 자주 묻는 질문(FAQ) 게시글을 미리 등록한다.

관리자(is_admin=True) 계정 1명을 찾아 board_type="faq"로 게시글을 생성한다.
이미 동일한 제목의 FAQ가 존재하면 건너뛴다 (재실행 안전).

사용법:
    python seed_faqs.py
"""
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.post import Post
from app.models.user import User
from app.schemas.post import PostCreate
from app.services.post_service import PostService

FAQS: list[tuple[str, str]] = [
    (
        "OCR로 스캔한 단어 순서가 이상하게 나와요",
        "이미지 속에서 단어가 등장하는 순서대로 추출되도록 되어 있습니다. "
        "순서가 어색하게 느껴진다면 사진이 흐릿하거나 단어가 여러 줄/단에 걸쳐 배치된 경우일 수 있어요. "
        "밝은 곳에서 또렷하게 촬영하면 인식 정확도와 순서가 개선됩니다.",
    ),
    (
        "AI가 만들어주는 단어 뜻과 예문은 어떻게 생성되나요?",
        "단어를 등록하면 AI가 의미, 발음, 예문 등을 자동으로 생성해줍니다. "
        "생성된 내용은 학습 참고용이며, 시험 대비 등 정확한 학습이 필요한 경우 "
        "교과서나 사전과 함께 확인하는 것을 권장합니다.",
    ),
    (
        "구글 계정으로 로그인했는데 비밀번호를 잊어버렸어요",
        "구글 로그인으로 가입한 계정은 별도의 비밀번호가 없습니다. "
        "로그인 화면에서 '구글로 로그인'을 이용해주세요. "
        "이메일로 직접 가입한 계정이라면 로그인 화면의 '비밀번호 찾기'에서 "
        "이메일로 발송되는 인증코드(OTP)를 통해 비밀번호를 재설정할 수 있습니다.",
    ),
    (
        "비밀번호 재설정 인증코드(OTP) 이메일이 안 와요",
        "먼저 스팸/프로모션 메일함을 확인해주세요. "
        "인증코드는 발송 후 일정 시간이 지나면 만료되며, "
        "짧은 시간 동안 여러 번 요청하면 보안을 위해 잠시 제한될 수 있습니다. "
        "몇 분 후 다시 시도해주세요.",
    ),
    (
        "단어장은 몇 개까지 만들 수 있고, 다른 사람과 공유할 수 있나요?",
        "단어장 개수에는 별도 제한이 없습니다. "
        "게시판의 '단어장 공유' 탭에서 본인의 단어장을 공유 게시글로 등록하면, "
        "다른 사용자가 게시글의 '단어장 가져오기' 버튼으로 자신의 단어장 목록에 복사해갈 수 있습니다.",
    ),
    (
        "학습 모드, 퀴즈 모드, 시험 모드는 어떻게 다른가요?",
        "학습 모드는 단어의 뜻과 예문을 차례로 보며 익히는 모드입니다. "
        "퀴즈 모드는 객관식으로 단어의 의미를 맞추는 모드이고, "
        "시험 모드는 스펠링을 직접 입력해 정답 여부를 채점하는 모드입니다. "
        "단어장 상세 화면에서 원하는 모드를 선택해 학습할 수 있습니다.",
    ),
    (
        "포인트는 어떻게 얻고, 어디에 사용되나요?",
        "게시글 작성, 다른 사람의 좋아요 받기, 내가 공유한 단어장을 다른 사람이 가져가기 등의 "
        "활동을 하면 포인트가 적립됩니다. "
        "현재는 활동 기록 확인용으로 제공되며, 추후 포인트를 활용한 추가 기능이 도입될 예정입니다.",
    ),
    (
        "닉네임(표시 이름)은 어떻게 바꾸나요?",
        "설정 화면에서 닉네임을 변경할 수 있습니다. "
        "변경한 닉네임은 게시판 글의 작성자 이름으로도 함께 표시됩니다.",
    ),
    (
        "앱을 사용하다가 로그인이 자꾸 풀려요",
        "로그인 시 발급되는 토큰은 일정 시간이 지나면 만료되며, "
        "앱 사용 중에는 자동으로 갱신됩니다. "
        "다만 오랫동안 앱을 사용하지 않았거나 다른 기기에서 다시 로그인한 경우에는 "
        "보안을 위해 재로그인이 필요할 수 있습니다.",
    ),
    (
        "Q&A 게시판에 올린 질문은 다른 사람도 볼 수 있나요?",
        "질문을 작성할 때 '공개'와 '비공개'를 선택할 수 있습니다. "
        "공개로 작성하면 다른 사용자도 질문과 답변을 볼 수 있고, "
        "비공개로 작성하면 작성자 본인과 관리자만 확인할 수 있습니다.",
    ),
]


def main() -> None:
    db = SessionLocal()
    try:
        admin = db.scalar(select(User).where(User.is_admin == True))  # noqa: E712
        if not admin:
            print("관리자(is_admin=True) 계정을 찾을 수 없습니다. FAQ 시드를 건너뜁니다.")
            return

        existing_titles = set(
            db.scalars(select(Post.title).where(Post.board_type == "faq")).all()
        )

        created = 0
        for title, content in FAQS:
            if title in existing_titles:
                continue
            PostService.create_post(
                db,
                admin.id,
                PostCreate(
                    title=title,
                    content=content,
                    content_format="plain",
                    board_type="faq",
                ),
            )
            created += 1

        print(f"FAQ {created}개 생성 완료 (이미 존재: {len(existing_titles)}개)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
