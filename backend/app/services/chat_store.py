from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatConversation, ChatMessageRecord
from app.models.user import User
from app.schemas.chat import ChatMessage


async def get_conversation_for_user(
    session: AsyncSession,
    *,
    conversation_id: str,
    user_id: int,
) -> ChatConversation | None:
    statement: Select[tuple[ChatConversation]] = select(ChatConversation).where(
        ChatConversation.id == conversation_id,
        ChatConversation.user_id == user_id,
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_conversation(
    session: AsyncSession,
    *,
    user: User,
    agent_name: str,
) -> ChatConversation:
    conversation = ChatConversation(user_id=user.id, agent_name=agent_name)
    session.add(conversation)
    await session.flush()
    return conversation


async def list_conversations_for_user(
    session: AsyncSession,
    *,
    user_id: int,
    agent_name: str | None = None,
    limit: int = 20,
) -> list[ChatConversation]:
    statement: Select[tuple[ChatConversation]] = (
        select(ChatConversation)
        .where(ChatConversation.user_id == user_id)
        .order_by(ChatConversation.created_at.desc())
        .limit(limit)
    )
    if agent_name is not None:
        statement = statement.where(ChatConversation.agent_name == agent_name)

    result = await session.execute(statement)
    return list(result.scalars().all())


async def list_messages_for_conversation(
    session: AsyncSession,
    *,
    conversation_id: str,
) -> list[ChatMessageRecord]:
    statement: Select[tuple[ChatMessageRecord]] = (
        select(ChatMessageRecord)
        .where(ChatMessageRecord.conversation_id == conversation_id)
        .order_by(ChatMessageRecord.created_at.asc(), ChatMessageRecord.id.asc())
    )
    result = await session.execute(statement)
    return list(result.scalars().all())


def append_message(
    session: AsyncSession,
    *,
    conversation_id: str,
    role: str,
    agent_name: str | None,
    message: str,
    message_type: str,
) -> ChatMessageRecord:
    record = ChatMessageRecord(
        conversation_id=conversation_id,
        role=role,
        agent_name=agent_name,
        message=message,
        message_type=message_type,
    )
    session.add(record)
    return record


def to_chat_message(record: ChatMessageRecord) -> ChatMessage:
    return ChatMessage(
        role=record.role,  # type: ignore[arg-type]
        content=record.message,
        name=record.agent_name,
    )


async def list_llm_messages_for_conversation(
    session: AsyncSession,
    *,
    conversation_id: str,
) -> list[ChatMessage]:
    records = await list_messages_for_conversation(session, conversation_id=conversation_id)
    return [
        to_chat_message(record)
        for record in records
        if record.message_type == "message" and record.role in {"system", "user", "assistant"}
    ]
