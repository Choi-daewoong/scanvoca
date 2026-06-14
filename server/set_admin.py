"""One-off: grant admin privileges to a user by email

사용법: python set_admin.py <email>
"""
import sys
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.core.config import settings
from app.models.user import User

if len(sys.argv) != 2:
    print("사용법: python set_admin.py <email>")
    sys.exit(1)

email = sys.argv[1]

engine = create_engine(settings.DATABASE_URL)
Session = sessionmaker(bind=engine)
db = Session()

try:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"사용자를 찾을 수 없습니다: {email}")
        sys.exit(1)

    user.is_admin = True
    db.commit()
    print(f"{email} 계정에 관리자 권한을 부여했습니다.")
finally:
    db.close()
