from dataclasses import dataclass, field

from app.schemas.chat import ChatAgentInfo


@dataclass(frozen=True, slots=True)
class ChatAgentDefinition:
    id: str
    name: str
    description: str
    default_tools: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)

    def to_info(self) -> ChatAgentInfo:
        return ChatAgentInfo(
            id=self.id,
            name=self.name,
            description=self.description,
            default_tools=self.default_tools,
            allowed_tools=self.allowed_tools,
        )


class ChatAgentRegistry:
    def __init__(self, agents: list[ChatAgentDefinition]) -> None:
        self._agents = {agent.id: agent for agent in agents}

    def get(self, agent_id: str) -> ChatAgentDefinition | None:
        return self._agents.get(agent_id)

    def list_agent_info(self) -> list[ChatAgentInfo]:
        return [agent.to_info() for agent in self._agents.values()]


def build_chat_agent_registry() -> ChatAgentRegistry:
    return ChatAgentRegistry(
        agents=[
            ChatAgentDefinition(
                id="analyst",
                name="Solon Analyst",
                description="Conversational finance workspace for variance analysis, planning questions, and board-ready explanations.",
                default_tools=["query_finance_db", "add_task_to_board"],
                allowed_tools=["query_finance_db", "render_chart", "add_task_to_board"],
            )
        ]
    )
