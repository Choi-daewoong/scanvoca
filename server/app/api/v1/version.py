"""Version check endpoints"""
from fastapi import APIRouter
from app.schemas.version import VersionCheckRequest, VersionCheckResponse
from app.core.config import settings
from packaging import version

router = APIRouter()


def compare_versions(current: str, minimum: str, latest: str) -> dict:
    """
    버전 비교 로직

    Returns:
        - is_supported: 현재 버전이 최소 지원 버전 이상인지
        - force_update: 강제 업데이트 필요 여부
        - recommended_update: 권장 업데이트 (최신 버전 아닐 때)
    """
    try:
        current_ver = version.parse(current)
        min_ver = version.parse(minimum)
        latest_ver = version.parse(latest)

        # 최소 버전보다 낮으면 강제 업데이트
        is_supported = current_ver >= min_ver
        force_update = not is_supported

        # 최신 버전이 아니면 권장 업데이트
        recommended_update = current_ver < latest_ver

        return {
            "is_supported": is_supported,
            "force_update": force_update,
            "recommended_update": recommended_update
        }
    except Exception:
        # 버전 파싱 실패 시 안전하게 업데이트 요구
        return {
            "is_supported": False,
            "force_update": True,
            "recommended_update": True
        }


@router.post("/check", response_model=VersionCheckResponse)
async def check_version(request: VersionCheckRequest):
    """
    앱 버전 체크

    - 앱 실행 시 호출하여 현재 버전이 지원되는지 확인
    - 최소 지원 버전보다 낮으면 강제 업데이트 요구
    """
    # 버전 비교
    result = compare_versions(
        request.current_version,
        settings.MIN_SUPPORTED_VERSION,
        settings.LATEST_VERSION
    )

    # 스토어 URL 선택
    store_url = settings.ANDROID_STORE_URL if request.platform == "android" else settings.IOS_STORE_URL

    # 메시지 생성
    if result["force_update"]:
        message = f"이전 버전(v{request.current_version})은 더 이상 지원되지 않습니다.\n최신 버전(v{settings.LATEST_VERSION})으로 업데이트 후 이용해주세요."
    elif result["recommended_update"]:
        message = f"새로운 버전(v{settings.LATEST_VERSION})이 출시되었습니다.\n업데이트하시면 더 나은 기능을 이용하실 수 있습니다."
    else:
        message = "최신 버전을 사용 중입니다."

    return VersionCheckResponse(
        is_supported=result["is_supported"],
        force_update=result["force_update"],
        recommended_update=result["recommended_update"],
        latest_version=settings.LATEST_VERSION,
        min_supported_version=settings.MIN_SUPPORTED_VERSION,
        update_message=message,
        update_url=store_url
    )


@router.get("/info")
async def get_version_info():
    """
    현재 서버가 요구하는 버전 정보 조회 (관리자용)
    """
    return {
        "latest_version": settings.LATEST_VERSION,
        "min_supported_version": settings.MIN_SUPPORTED_VERSION,
        "android_store_url": settings.ANDROID_STORE_URL,
        "ios_store_url": settings.IOS_STORE_URL
    }
