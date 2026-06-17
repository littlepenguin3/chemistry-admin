from __future__ import annotations

from fastapi import APIRouter, Depends

from server.app.auth import AuthUser, require_roles
from server.app.platform_settings import (
    AIConfigurationResponse,
    AIConfigurationUpdate,
    LearningBehaviorSettings,
    PlatformSettingsResponse,
    get_ai_configuration_response,
    get_learning_behavior_settings,
    save_ai_configuration,
    save_learning_behavior_settings,
)


router = APIRouter(prefix="/api/admin", tags=["admin-platform"])


@router.get("/platform-settings", response_model=PlatformSettingsResponse)
async def admin_get_platform_settings(
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> PlatformSettingsResponse:
    return PlatformSettingsResponse(settings=get_learning_behavior_settings(), can_edit=user.role == "admin")


@router.put("/platform-settings", response_model=PlatformSettingsResponse)
async def admin_update_platform_settings(
    payload: LearningBehaviorSettings,
    user: AuthUser = Depends(require_roles("admin")),
) -> PlatformSettingsResponse:
    saved = save_learning_behavior_settings(payload, user.id)
    return PlatformSettingsResponse(settings=saved, can_edit=True)


@router.get("/ai-configuration", response_model=AIConfigurationResponse)
async def admin_get_ai_configuration(
    user: AuthUser = Depends(require_roles("admin", "teacher")),
) -> AIConfigurationResponse:
    return get_ai_configuration_response(can_edit=user.role == "admin")


@router.put("/ai-configuration", response_model=AIConfigurationResponse)
async def admin_update_ai_configuration(
    payload: AIConfigurationUpdate,
    user: AuthUser = Depends(require_roles("admin")),
) -> AIConfigurationResponse:
    return save_ai_configuration(payload, user.id)
