"""Version schema"""
from pydantic import BaseModel


class AppVersion(BaseModel):
    """App version information"""
    version: str  # 현재 최신 버전 (예: "1.0.0")
    min_version: str  # 최소 지원 버전 (예: "1.0.0")
    force_update: bool  # 강제 업데이트 필요 여부
    update_message: str  # 업데이트 안내 메시지
    update_url: str  # 플레이스토어 URL

    class Config:
        json_schema_extra = {
            "example": {
                "version": "1.2.0",
                "min_version": "1.0.0",
                "force_update": True,
                "update_message": "새로운 기능이 추가되었습니다. 업데이트 후 이용해주세요.",
                "update_url": "https://play.google.com/store/apps/details?id=com.twostwo.scanvoca"
            }
        }


class VersionCheckRequest(BaseModel):
    """Version check request"""
    current_version: str  # 앱의 현재 버전
    platform: str  # "android" or "ios"

    class Config:
        json_schema_extra = {
            "example": {
                "current_version": "1.0.0",
                "platform": "android"
            }
        }


class VersionCheckResponse(BaseModel):
    """Version check response"""
    is_supported: bool  # 현재 버전이 지원되는지
    force_update: bool  # 강제 업데이트 필요 여부
    recommended_update: bool  # 권장 업데이트 (선택적)
    latest_version: str  # 최신 버전
    min_supported_version: str  # 최소 지원 버전
    update_message: str  # 업데이트 메시지
    update_url: str  # 다운로드 URL

    class Config:
        json_schema_extra = {
            "example": {
                "is_supported": False,
                "force_update": True,
                "recommended_update": True,
                "latest_version": "1.2.0",
                "min_supported_version": "1.0.0",
                "update_message": "이전 버전은 더 이상 지원되지 않습니다. 업데이트 후 이용해주세요.",
                "update_url": "https://play.google.com/store/apps/details?id=com.twostwo.scanvoca"
            }
        }
