import json
from dataclasses import dataclass
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.llm import (
    FINANCE_WAREHOUSE_QUERY_GUIDE,
    ChatTool,
    LLMMessage,
    LLMProvider,
    LLMProviderError,
    LLMRequest,
    LLMToolCall,
    LLMToolDefinition,
    ToolExecutionContext,
    ToolRegistry,
)
from app.models.user import User
from app.schemas.chat import (
    ChatArtifact,
    ChatCapabilitiesResponse,
    ChatMessage,
    ChatRequest,
    ChatResponse,
    ChatToolCall,
    ConversationListItem,
    ConversationListResponse,
    ConversationResponse,
    StoredConversationMessage,
)
from app.services.chat_agents import ChatAgentRegistry
from app.services.chat_store import (
    append_message,
    create_conversation,
    get_conversation_for_user,
    list_conversations_for_user,
    list_llm_messages_for_conversation,
    list_messages_for_conversation,
)


class ChatUnsupportedModeError(RuntimeError):
    pass


@dataclass(slots=True)
class ChatRunResult:
    conversation_id: str
    message: ChatMessage
    tool_calls: list[ChatToolCall]
    artifacts: list[ChatArtifact]
    model: str | None


class ChatOrchestrator:
    def __init__(
        self,
        settings: Settings,
        provider: LLMProvider,
        tool_registry: ToolRegistry,
        agent_registry: ChatAgentRegistry,
    ) -> None:
        self._settings = settings
        self._provider = provider
        self._tool_registry = tool_registry
        self._agent_registry = agent_registry

    def get_capabilities(self) -> ChatCapabilitiesResponse:
        return ChatCapabilitiesResponse(
            provider=self._settings.llm_provider,
            default_model=self._settings.llm_model,
            supported_execution_modes=["single_agent"],
            available_agents=self._agent_registry.list_agent_info(),
            available_tools=self._tool_registry.list_tool_info(),
        )

    async def respond_with_persistence(
        self,
        request: ChatRequest,
        user: User,
        session: AsyncSession,
    ) -> ChatResponse:
        if request.execution_mode != "single_agent":
            raise ChatUnsupportedModeError(
                f"Execution mode '{request.execution_mode}' is not implemented yet."
            )

        conversation = await self._resolve_conversation(request, user, session)
        await self._persist_incoming_messages(request, conversation.id, session)
        run_result = await self._run_single_agent(request, user, conversation.id, session)
        await session.commit()
        return ChatResponse(
            conversation_id=run_result.conversation_id,
            agent=request.agent,
            execution_mode=request.execution_mode,
            message=run_result.message,
            tool_calls=run_result.tool_calls,
            artifacts=run_result.artifacts,
            model=run_result.model,
            metadata={
                "user_id": user.id,
                "provider": self._settings.llm_provider,
                "requested_tools": request.tools,
                "agent_default_tools": agent_definition.default_tools if (agent_definition := self._agent_registry.get(request.agent)) else [],
                "tool_loop_enabled": True,
            },
        )

    async def get_conversation(
        self,
        *,
        conversation_id: str,
        user: User,
        session: AsyncSession,
    ) -> ConversationResponse:
        conversation = await get_conversation_for_user(
            session,
            conversation_id=conversation_id,
            user_id=user.id,
        )
        if conversation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found.",
            )

        records = await list_messages_for_conversation(session, conversation_id=conversation_id)
        return ConversationResponse(
            conversation_id=conversation.id,
            agent=conversation.agent_name,
            messages=[
                StoredConversationMessage(
                    id=record.id,
                    role=record.role,  # type: ignore[arg-type]
                    agent_name=record.agent_name,
                    type=record.message_type,
                    message=record.message,
                    artifact=self._parse_artifact(record.message_type, record.message),
                    created_at=record.created_at.isoformat(),
                )
                for record in records
            ],
        )

    async def list_conversations(
        self,
        *,
        user: User,
        session: AsyncSession,
        agent: str | None = None,
    ) -> ConversationListResponse:
        conversations = await list_conversations_for_user(
            session,
            user_id=user.id,
            agent_name=agent,
        )

        items: list[ConversationListItem] = []
        for conversation in conversations:
            records = await list_messages_for_conversation(session, conversation_id=conversation.id)
            user_message = next((record for record in records if record.role == "user"), None)
            last_message = next(
                (record for record in reversed(records) if record.message_type == "message"),
                None,
            )

            title_source = user_message.message if user_message is not None else "New conversation"
            preview_source = last_message.message if last_message is not None else None
            items.append(
                ConversationListItem(
                    conversation_id=conversation.id,
                    agent=conversation.agent_name,
                    title=title_source[:72].strip(),
                    preview=preview_source[:120].strip() if preview_source is not None else None,
                    created_at=conversation.created_at.isoformat(),
                )
            )

        return ConversationListResponse(conversations=items)

    async def _run_single_agent(
        self,
        request: ChatRequest,
        user: User,
        conversation_id: str,
        session: AsyncSession,
    ) -> ChatRunResult:
        agent_definition = self._agent_registry.get(request.agent)
        if agent_definition is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent '{request.agent}' is not registered.",
            )

        allowed_tool_names = set(agent_definition.allowed_tools)
        selected_tool_names = list(dict.fromkeys([*agent_definition.default_tools, *request.tools]))
        invalid_tool_names = [name for name in selected_tool_names if name not in allowed_tool_names]
        if invalid_tool_names:
            invalid_tools = ", ".join(sorted(invalid_tool_names))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Agent '{request.agent}' cannot use tools: {invalid_tools}.",
            )

        active_tools = self._tool_registry.list_tools(selected_tool_names)
        tool_definitions = [
            LLMToolDefinition(
                name=tool.name,
                description=tool.description,
                input_schema=tool.input_schema,
            )
            for tool in active_tools
        ]
        stored_messages = await list_llm_messages_for_conversation(
            session,
            conversation_id=conversation_id,
        )
        messages = [
            LLMMessage(
                role=message.role,
                content=message.content,
                name=message.name,
                tool_call_id=message.tool_call_id,
            )
            for message in stored_messages
        ]
        executed_tool_calls: list[ChatToolCall] = []
        emitted_artifacts: list[ChatArtifact] = []
        final_model: str | None = None
        context = ToolExecutionContext(user=user, metadata=request.metadata)
        system_prompt = request.system_prompt or self._settings.llm_system_prompt
        if any(tool.name == "query_finance_db" for tool in active_tools):
            system_prompt = (
                f"{system_prompt}\n\n"
                f"{FINANCE_WAREHOUSE_QUERY_GUIDE}\n\n"
                "When using query_finance_db, inspect the returned rows before answering. "
                "If a query fails with a type mismatch, repair the SQL by switching to the mart view that already exposes the needed labels and amounts; do not ask the user whether to proceed with a text-only summary until one repaired query has also failed. "
                "If the result is empty, say that the query returned no matching rows and adjust once if a clear better query is available."
            )
        if any(tool.name == "render_chart" for tool in active_tools):
            system_prompt = (
                f"{system_prompt}\n\n"
                "When using render_chart, only call it if you can provide real populated data.\n"
                "For line, bar, and area charts:\n"
                "- include x_key\n"
                "- include at least one series\n"
                "- each data row must contain the x_key field and numeric values for every series key\n"
                "- either send a populated data array or source_query_sql so the tool can load data\n"
                "For pie charts:\n"
                "- include label_key and value_key\n"
                "- each data row must contain the label field and a numeric value field\n"
                "- either send a populated data array or source_query_sql so the tool can load data\n"
                "When the chart is based on query_finance_db, include source_query_sql with the exact SQL used so the chart can be refreshed from live data. "
                "If you do not have concrete chart data or a source query, answer normally without calling render_chart."
            )
        if any(tool.name == "add_task_to_board" for tool in active_tools):
            system_prompt = (
                f"{system_prompt}\n\n"
                "When using add_task_to_board, add tasks only for explicit user requests to capture work "
                "or for clearly actionable follow-ups identified in the conversation. "
                "Do not add tasks for every answer. Keep task titles concise, start with a verb, "
                "and use owner_name='Unassigned' when no assignee is clear."
            )

        for _ in range(self._settings.llm_max_tool_round_trips):
            llm_response = await self._provider.generate(
                LLMRequest(
                    messages=messages,
                    system_prompt=system_prompt,
                    tools=tool_definitions,
                    temperature=request.temperature,
                    max_output_tokens=request.max_output_tokens,
                )
            )
            final_model = llm_response.model

            if not llm_response.message.tool_calls:
                assistant_content = llm_response.message.content.strip() or "No response generated."
                append_message(
                    session,
                    conversation_id=conversation_id,
                    role="assistant",
                    agent_name=request.agent,
                    message=assistant_content,
                    message_type="message",
                )
                return ChatRunResult(
                    conversation_id=conversation_id,
                    message=ChatMessage(role="assistant", content=assistant_content),
                    tool_calls=executed_tool_calls,
                    artifacts=emitted_artifacts,
                    model=final_model,
                )

            messages.append(
                LLMMessage(
                    role="assistant",
                    content=llm_response.message.content,
                    tool_calls=llm_response.message.tool_calls,
                )
            )
            tool_results = await self._execute_tool_calls(
                llm_response.message.tool_calls,
                active_tools,
                context,
                conversation_id,
                request.agent,
                session,
            )
            executed_tool_calls.extend(tool_results["tool_calls"])
            emitted_artifacts.extend(tool_results["artifacts"])
            messages.extend(tool_results["messages"])

        fallback_message = self._build_tool_limit_message(executed_tool_calls)
        append_message(
            session,
            conversation_id=conversation_id,
            role="assistant",
            agent_name=request.agent,
            message=fallback_message,
            message_type="message",
        )
        return ChatRunResult(
            conversation_id=conversation_id,
            message=ChatMessage(role="assistant", content=fallback_message),
            tool_calls=executed_tool_calls,
            artifacts=emitted_artifacts,
            model=final_model,
        )

    async def _execute_tool_calls(
        self,
        tool_calls: list[LLMToolCall],
        active_tools: list[ChatTool],
        context: ToolExecutionContext,
        conversation_id: str,
        agent_name: str,
        session: AsyncSession,
    ) -> dict[str, list[Any]]:
        tools_by_name = {tool.name: tool for tool in active_tools}
        tool_messages: list[LLMMessage] = []
        executed_tool_calls: list[ChatToolCall] = []
        emitted_artifacts: list[ChatArtifact] = []

        for tool_call in tool_calls:
            tool = tools_by_name.get(tool_call.name)
            if tool is None:
                error_message = f"Tool '{tool_call.name}' is not registered."
                executed_tool_calls.append(
                    ChatToolCall(
                        id=tool_call.id,
                        name=tool_call.name,
                        arguments=tool_call.arguments,
                        status="failed",
                        error=error_message,
                    )
                )
                tool_messages.append(
                    LLMMessage(
                        role="tool",
                        content=json.dumps({"error": error_message}),
                        name=tool_call.name,
                        tool_call_id=tool_call.id,
                    )
                )
                append_message(
                    session,
                    conversation_id=conversation_id,
                    role="tool",
                    agent_name=agent_name,
                    message=json.dumps({"error": error_message}),
                    message_type="tool",
                )
                continue

            try:
                output = await tool.execute(tool_call.arguments, context)
                executed_tool_calls.append(
                    ChatToolCall(
                        id=tool_call.id,
                        name=tool_call.name,
                        arguments=tool_call.arguments,
                        status="completed",
                        output=output,
                    )
                )
                tool_messages.append(
                    LLMMessage(
                        role="tool",
                        content=json.dumps({"result": output}),
                        name=tool_call.name,
                        tool_call_id=tool_call.id,
                    )
                )
                append_message(
                    session,
                    conversation_id=conversation_id,
                    role="tool",
                    agent_name=agent_name,
                    message=json.dumps({"result": output}),
                    message_type="tool",
                )
                emitted_messages = context.consume_emitted_messages()
                for emitted_message in emitted_messages:
                    append_message(
                        session,
                        conversation_id=conversation_id,
                        role="assistant",
                        agent_name=agent_name,
                        message=emitted_message.message,
                        message_type=emitted_message.message_type,
                    )
                    if emitted_message.artifact is not None:
                        emitted_artifacts.append(emitted_message.artifact)
            except Exception as exc:  # noqa: BLE001
                error_message = str(exc) or "Tool execution failed."
                executed_tool_calls.append(
                    ChatToolCall(
                        id=tool_call.id,
                        name=tool_call.name,
                        arguments=tool_call.arguments,
                        status="failed",
                        error=error_message,
                    )
                )
                tool_messages.append(
                    LLMMessage(
                        role="tool",
                        content=json.dumps({"error": error_message}),
                        name=tool_call.name,
                        tool_call_id=tool_call.id,
                    )
                )
                append_message(
                    session,
                    conversation_id=conversation_id,
                    role="tool",
                    agent_name=agent_name,
                    message=json.dumps({"error": error_message}),
                    message_type="tool",
                )
                context.consume_emitted_messages()

        return {
            "tool_calls": executed_tool_calls,
            "artifacts": emitted_artifacts,
            "messages": tool_messages,
        }

    def _build_tool_limit_message(self, executed_tool_calls: list[ChatToolCall]) -> str:
        failed_calls = [call for call in executed_tool_calls if call.status == "failed"]
        if failed_calls:
            latest_error = failed_calls[-1].error or "Tool execution failed."
            latest_tool_name = failed_calls[-1].name
            if latest_tool_name == "query_finance_db":
                return (
                    "I could not complete the database query workflow. "
                    f"The latest tool error was: {latest_error}"
                )
            return (
                "I could not complete the tool workflow. "
                f"The latest tool error was: {latest_error}"
            )
        return (
            "I could not complete the tool workflow within the configured limit. "
            "Please retry with a more specific request or without chart generation."
        )

    def _parse_artifact(self, message_type: str, message: str) -> ChatArtifact | None:
        if message_type not in {"chart", "task"}:
            return None
        try:
            return ChatArtifact.model_validate_json(message)
        except Exception:  # noqa: BLE001
            return None

    async def _resolve_conversation(
        self,
        request: ChatRequest,
        user: User,
        session: AsyncSession,
    ):
        if request.conversation_id:
            conversation = await get_conversation_for_user(
                session,
                conversation_id=request.conversation_id,
                user_id=user.id,
            )
            if conversation is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found.",
                )
            return conversation

        return await create_conversation(
            session,
            user=user,
            agent_name=request.agent,
        )

    async def _persist_incoming_messages(
        self,
        request: ChatRequest,
        conversation_id: str,
        session: AsyncSession,
    ) -> None:
        for message in request.messages:
            append_message(
                session,
                conversation_id=conversation_id,
                role=message.role,
                agent_name=message.name or (request.agent if message.role != "user" else None),
                message=message.content,
                message_type="message",
            )
