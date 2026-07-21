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


def _send_plain_email_sync(to_email: str, subject: str, text_body: str) -> None:
    """Synchronous plain-text email send (no HTML template) - runs in executor."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError("SMTP credentials not configured. Set SMTP_USER and SMTP_PASSWORD in .env")

    msg = MIMEText(text_body, "plain", "utf-8")
    msg["Subject"] = Header(subject, "utf-8")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_USER, to_email, msg.as_string())

    logger.info(f"Email sent to {to_email}")


async def send_auto_publish_failure_email(reason: str, detail: str = "") -> bool:
    """Notify the admin that an automated blog publish run failed (best-effort).

    Sends a simple plain-text mail (deliberately NOT the OTP HTML template) to
    settings.ADMIN_NOTIFY_EMAIL. Never raises — a notification failure must not break the
    auto-publish response. Returns True if a mail was sent, False if skipped/failed.

    reason is a machine code (e.g. "generation_failed"); detail is optional free text.
    """
    to_email = (settings.ADMIN_NOTIFY_EMAIL or "").strip()
    if not to_email:
        logger.warning("Auto-publish failure not emailed: ADMIN_NOTIFY_EMAIL is not set")
        return False

    subject = f"[Scan Voca] 자동 블로그 발행 실패: {reason}"
    body = (
        "자동 블로그 발행 파이프라인에서 문제가 발생했습니다.\n\n"
        f"사유(reason): {reason}\n"
        f"상세: {detail or '-'}\n\n"
        "관리자 페이지에서 확인해 주세요."
    )
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_plain_email_sync, to_email, subject, body)
        return True
    except Exception as e:  # noqa: BLE001 - notification must never break the caller
        logger.error(f"Failed to send auto-publish failure email: {e}")
        return False


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
