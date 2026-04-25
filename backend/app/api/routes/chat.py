from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status

from app.api.deps import get_session, require_internal_api_key, require_verified_user
from app.config import get_settings
from app.llm import LLMConfigurationError, LLMProviderError, build_llm_provider, build_tool_registry
from app.models.user import User
from app.schemas.chat import (
    ChatCapabilitiesResponse,
    ConversationListResponse,
    ChatRequest,
    ChatResponse,
    ConversationResponse,
)
from app.services.chat import ChatOrchestrator, ChatUnsupportedModeError
from app.services.chat_agents import build_chat_agent_registry
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(dependencies=[Depends(require_internal_api_key)])


@lru_cache
def get_chat_orchestrator() -> ChatOrchestrator:
    settings = get_settings()
    provider = build_llm_provider(settings)
    tool_registry = build_tool_registry()
    agent_registry = build_chat_agent_registry()
    return ChatOrchestrator(
        settings=settings,
        provider=provider,
        tool_registry=tool_registry,
        agent_registry=agent_registry,
    )


@router.get("/capabilities", response_model=ChatCapabilitiesResponse)
async def get_chat_capabilities(
    _: User = Depends(require_verified_user),
) -> ChatCapabilitiesResponse:
    orchestrator = get_chat_orchestrator()
    return orchestrator.get_capabilities()


@router.post("/respond", response_model=ChatResponse)
async def respond(
    payload: ChatRequest,
    user: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> ChatResponse:
    orchestrator = get_chat_orchestrator()
    try:
        return await orchestrator.respond_with_persistence(payload, user, session)
    except ChatUnsupportedModeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except LLMConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except LLMProviderError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    agent: str | None = Query(default=None, min_length=1),
    user: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> ConversationListResponse:
    orchestrator = get_chat_orchestrator()
    return await orchestrator.list_conversations(
        user=user,
        session=session,
        agent=agent,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str = Path(..., min_length=1),
    user: User = Depends(require_verified_user),
    session: AsyncSession = Depends(get_session),
) -> ConversationResponse:
    orchestrator = get_chat_orchestrator()
    return await orchestrator.get_conversation(
        conversation_id=conversation_id,
        user=user,
        session=session,
    )
