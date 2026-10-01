from __future__ import annotations

from app.schemas.finance import FinanceInsightCardResponse, FinancePriorityResponse


# card id -> (dashboard priority title, ranking weight)
PRIORITY_SIGNALS: dict[str, tuple[str, int]] = {
    "liquidity-gap-forecast": ("Liquidity gap forecast", 40),
    "data-freshness": ("Data freshness", 38),
    "budget-vs-actual": ("Budget variance", 36),
    "overdue-risk": ("Overdue invoice risk", 34),
    "abnormal-journal-amounts": ("Abnormal journal lines", 32),
    "duplicate-postings": ("Duplicate posting risk", 31),
    "gross-margin": ("Gross margin movement", 30),
    "net-profit-margin": ("Net profit margin", 29),
    "ebitda-trend": ("EBITDA trend", 29),
    "margin-compression-warning": ("Margin compression warning", 28),
    "budget-exhaustion-date": ("Budget exhaustion date", 27),
    "month-end-close-variance": ("Month-end close variance", 26),
    "expected-bad-debt-risk": ("Expected bad debt risk", 25),
    "cash-collection-forecast": ("Cash collection forecast", 24),
    "supplier-payment-forecast": ("Supplier payment forecast", 24),
    "revenue-trend": ("Revenue trend", 20),
}


def build_dashboard_priorities_from_cards(cards: list[FinanceInsightCardResponse]) -> list[FinancePriorityResponse]:
    ranked = sorted(cards, key=dashboard_priority_score, reverse=True)
    priorities = [
        FinancePriorityResponse(title=dashboard_priority_title(card), detail=dashboard_priority_detail(card), severity=card.status)
        for card in ranked
        if card.status in {"Alert", "Watch"}
    ]
    if len(priorities) < 4:
        priorities.extend(
            FinancePriorityResponse(title=dashboard_priority_title(card), detail=dashboard_priority_detail(card), severity=card.status)
            for card in ranked
            if card.status == "On track"
        )
    return priorities[:4]


def dashboard_priority_score(card: FinanceInsightCardResponse) -> float:
    status_score = {"Alert": 300, "Watch": 200, "On track": 100}[card.status]
    confidence_score = (card.confidence or 0.75) * 20
    evidence_score = min(evidence_row_count(card.evidence), 5) * 4
    _, weight = PRIORITY_SIGNALS.get(card.id, (None, 10))
    return status_score + weight + confidence_score + evidence_score


def dashboard_priority_title(card: FinanceInsightCardResponse) -> str:
    title, _ = PRIORITY_SIGNALS.get(card.id, (card.id.replace("-", " ").title(), 0))
    return f"{title}: {card.metric}"


def dashboard_priority_detail(card: FinanceInsightCardResponse) -> str:
    analyst_logic = card.evidence.get("analyst_logic") if card.evidence else None
    if isinstance(analyst_logic, str):
        return f"{card.delta}. {analyst_logic}"
    return card.explanation or card.delta


def evidence_row_count(evidence: dict | None) -> int:
    if not evidence:
        return 0
    return sum(len(value) for value in evidence.values() if isinstance(value, list))


def build_dashboard_actions_from_priorities(priorities: list[FinancePriorityResponse]) -> list[str]:
    actions = []
    for priority in priorities[:3]:
        title = priority.title.split(":", 1)[0]
        if priority.severity == "Alert":
            actions.append(f"Investigate {title.lower()} today.")
        elif priority.severity == "Watch":
            actions.append(f"Review {title.lower()} drivers.")
        else:
            actions.append(f"Monitor {title.lower()}.")
    return actions or ["Keep monitoring finance performance and data freshness."]


def build_dashboard_summary_from_priorities(default_summary: str, priorities: list[FinancePriorityResponse]) -> str:
    urgent = [priority for priority in priorities if priority.severity == "Alert"]
    watch = [priority for priority in priorities if priority.severity == "Watch"]
    if urgent:
        names = ", ".join(priority.title.split(":", 1)[0].lower() for priority in urgent[:2])
        return f"Today's highest-priority insight signals are {names}. {default_summary}"
    if watch:
        names = ", ".join(priority.title.split(":", 1)[0].lower() for priority in watch[:2])
        return f"Today is mainly a watch-list day around {names}. {default_summary}"
    return default_summary


def build_needs_attention_from_priorities(priorities: list[FinancePriorityResponse]) -> str:
    attention = [priority.title.split(":", 1)[0] for priority in priorities if priority.severity in {"Alert", "Watch"}]
    return ", ".join(attention) if attention else "No material insight signals need attention in the latest analytics run."
