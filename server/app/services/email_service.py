"""Email service for sending transactional emails via Gmail SMTP"""
import smtplib
import asyncio
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.header import Header
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_email_sync(to_email: str, subject: str, html_body: str) -> None:
    """Synchronous email send - runs in executor to avoid blocking event loop"""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD in .env")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email

    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())

    logger.info(f"Email sent to {to_email}")


async def send_password_reset_email(to_email: str, otp: str) -> None:
    """Send password reset OTP email (async, non-blocking)"""
    subject = "[Scan Voca] 비밀번호 재설정 인증 코드"

    html_body = f"""
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px;">
    <h2 style="color: #333333; text-align: center; margin-bottom: 8px;">비밀번호 재설정</h2>
    <p style="color: #666666; text-align: center; margin-bottom: 32px;">
      아래 6자리 인증 코드를 앱에 입력해주세요.
    </p>
    <div style="background: #f0f4ff; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px;">
      <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #4A6CF7;">{otp}</span>
    </div>
    <p style="color: #999999; font-size: 13px; text-align: center;">
      이 코드는 <strong>{settings.PASSWORD_RESET_OTP_EXPIRE_MINUTES}분</strong> 동안 유효합니다.<br>
      본인이 요청하지 않은 경우 이 이메일을 무시하세요.
    </p>
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 24px 0;">
    <p style="color: #cccccc; font-size: 12px; text-align: center;">Scan Voca</p>
  </div>
</body>
</html>
"""

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _send_email_sync, to_email, subject, html_body)
