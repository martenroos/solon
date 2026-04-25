import asyncio
import json
from typing import Any, Protocol
from urllib import error, request

from app.config import Settings
from app.llm.types import LLMMessage, LLMRequest, LLMResponse, LLMToolCall, LLMToolDefinition


class LLMConfigurationError(RuntimeError):
    pass


class LLMProviderError(RuntimeError):
    pass


class LLMProvider(Protocol):
    async def generate(self, llm_request: LLMRequest) -> LLMResponse:
        ...


class OpenAIChatCompletionsProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def generate(self, llm_request: LLMRequest) -> LLMResponse:
        api_key = self._settings.llm_api_key
        if api_key is None or not api_key.get_secret_value():
            raise LLMConfigurationError("OPENAI_API_KEY or LLM_API_KEY is not configured.")
        if not self._settings.llm_model:
            raise LLMConfigurationError("OPENAI_MODEL or LLM_MODEL is not configured.")

        payload: dict[str, Any] = {
            "model": self._settings.llm_model,
            "messages": self._serialize_messages(llm_request),
        }
        temperature = llm_request.temperature
        if temperature is None:
            temperature = self._settings.llm_temperature
        if temperature is not None:
            payload["temperature"] = temperature

        max_output_tokens = llm_request.max_output_tokens or self._settings.llm_max_output_tokens
        if max_output_tokens:
            payload["max_tokens"] = max_output_tokens

        if llm_request.tools:
            payload["tools"] = [self._serialize_tool(tool) for tool in llm_request.tools]
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {api_key.get_secret_value()}",
            "Content-Type": "application/json",
        }
        url = f"{self._settings.llm_base_url.rstrip('/')}/chat/completions"

        try:
            response = await asyncio.to_thread(
                self._post_json,
                url,
                headers,
                payload,
                self._settings.llm_request_timeout_seconds,
            )
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise LLMProviderError(f"LLM request failed with status {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise LLMProviderError(f"Unable to reach LLM provider: {exc.reason}") from exc

        try:
            choice = response["choices"][0]
            message = choice["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("LLM provider returned an unexpected response shape.") from exc

        return LLMResponse(
            message=LLMMessage(
                role="assistant",
                content=self._extract_text(message.get("content")),
                tool_calls=self._extract_tool_calls(message.get("tool_calls", [])),
            ),
            model=response.get("model"),
            finish_reason=choice.get("finish_reason"),
        )

    def _serialize_messages(self, llm_request: LLMRequest) -> list[dict[str, Any]]:
        messages: list[dict[str, Any]] = []
        if llm_request.system_prompt:
            messages.append({"role": "system", "content": llm_request.system_prompt})

        for message in llm_request.messages:
            serialized: dict[str, Any] = {
                "role": message.role,
                "content": message.content,
            }
            if message.name:
                serialized["name"] = message.name
            if message.tool_call_id:
                serialized["tool_call_id"] = message.tool_call_id
            if message.tool_calls:
                serialized["tool_calls"] = [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.name,
                            "arguments": json.dumps(tool_call.arguments),
                        },
                    }
                    for tool_call in message.tool_calls
                ]
            messages.append(serialized)

        return messages

    def _serialize_tool(self, tool: LLMToolDefinition) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description,
                "parameters": tool.input_schema,
            },
        }

    def _extract_text(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        parts.append(text)
            return "\n".join(part for part in parts if part)
        return ""

    def _extract_tool_calls(self, tool_calls: list[dict[str, Any]]) -> list[LLMToolCall]:
        parsed_calls: list[LLMToolCall] = []
        for tool_call in tool_calls:
            function_payload = tool_call.get("function", {})
            raw_arguments = function_payload.get("arguments") or "{}"
            arguments: dict[str, Any]
            try:
                decoded = json.loads(raw_arguments)
                arguments = decoded if isinstance(decoded, dict) else {"value": decoded}
            except json.JSONDecodeError:
                arguments = {"raw_arguments": raw_arguments}

            parsed_calls.append(
                LLMToolCall(
                    id=tool_call.get("id", ""),
                    name=function_payload.get("name", ""),
                    arguments=arguments,
                )
            )
        return parsed_calls

    def _post_json(
        self,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        timeout_seconds: float,
    ) -> dict[str, Any]:
        http_request = request.Request(
            url=url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with request.urlopen(http_request, timeout=timeout_seconds) as response:
            body = response.read().decode("utf-8")
        return json.loads(body)


class AzureOpenAIChatCompletionsProvider:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def generate(self, llm_request: LLMRequest) -> LLMResponse:
        api_key = self._settings.azure_openai_api_key
        endpoint = self._settings.azure_openai_endpoint
        deployment = self._settings.azure_openai_deployment or self._settings.llm_model

        if api_key is None or not api_key.get_secret_value():
            raise LLMConfigurationError("AZURE_OPENAI_API_KEY is not configured.")
        if not endpoint:
            raise LLMConfigurationError("AZURE_OPENAI_ENDPOINT is not configured.")
        if not deployment:
            raise LLMConfigurationError(
                "AZURE_OPENAI_DEPLOYMENT or OPENAI_MODEL/LLM_MODEL is not configured."
            )

        payload: dict[str, Any] = {
            "messages": self._serialize_messages(llm_request),
        }
        temperature = llm_request.temperature
        if temperature is None:
            temperature = self._settings.llm_temperature
        if temperature is not None:
            payload["temperature"] = temperature

        max_output_tokens = llm_request.max_output_tokens or self._settings.llm_max_output_tokens
        if max_output_tokens:
            payload["max_tokens"] = max_output_tokens

        if llm_request.tools:
            payload["tools"] = [self._serialize_tool(tool) for tool in llm_request.tools]
            payload["tool_choice"] = "auto"

        headers = {
            "api-key": api_key.get_secret_value(),
            "Content-Type": "application/json",
        }
        base_endpoint = endpoint.rstrip("/")
        api_version = self._settings.azure_openai_api_version
        url = (
            f"{base_endpoint}/openai/deployments/{deployment}/chat/completions"
            f"?api-version={api_version}"
        )

        try:
            response = await asyncio.to_thread(
                self._post_json,
                url,
                headers,
                payload,
                self._settings.llm_request_timeout_seconds,
            )
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            raise LLMProviderError(f"LLM request failed with status {exc.code}: {detail}") from exc
        except error.URLError as exc:
            raise LLMProviderError(f"Unable to reach LLM provider: {exc.reason}") from exc

        try:
            choice = response["choices"][0]
            message = choice["message"]
        except (KeyError, IndexError, TypeError) as exc:
            raise LLMProviderError("LLM provider returned an unexpected response shape.") from exc

        return LLMResponse(
            message=LLMMessage(
                role="assistant",
                content=self._extract_text(message.get("content")),
                tool_calls=self._extract_tool_calls(message.get("tool_calls", [])),
            ),
            model=response.get("model", deployment),
            finish_reason=choice.get("finish_reason"),
        )

    def _serialize_messages(self, llm_request: LLMRequest) -> list[dict[str, Any]]:
        return OpenAIChatCompletionsProvider._serialize_messages(self, llm_request)

    def _serialize_tool(self, tool: LLMToolDefinition) -> dict[str, Any]:
        return OpenAIChatCompletionsProvider._serialize_tool(self, tool)

    def _extract_text(self, content: Any) -> str:
        return OpenAIChatCompletionsProvider._extract_text(self, content)

    def _extract_tool_calls(self, tool_calls: list[dict[str, Any]]) -> list[LLMToolCall]:
        return OpenAIChatCompletionsProvider._extract_tool_calls(self, tool_calls)

    def _post_json(
        self,
        url: str,
        headers: dict[str, str],
        payload: dict[str, Any],
        timeout_seconds: float,
    ) -> dict[str, Any]:
        return OpenAIChatCompletionsProvider._post_json(self, url, headers, payload, timeout_seconds)


def build_llm_provider(settings: Settings) -> LLMProvider:
    provider = settings.llm_provider.lower()
    if provider == "openai":
        return OpenAIChatCompletionsProvider(settings)
    if provider in {"azure", "azure_openai"}:
        return AzureOpenAIChatCompletionsProvider(settings)
    raise LLMConfigurationError(f"Unsupported LLM provider: {settings.llm_provider}")
