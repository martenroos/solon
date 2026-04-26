"""Seed realistic demo finance data into the warehouse.

Run from ``backend`` after migrations:

    python -m app.scripts.seed_finance_demo
"""

from __future__ import annotations

import argparse
import asyncio
import calendar
import json
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.db import engine


COMPANY_CODE = "SOLON-DEMO"
SOURCE_CODE = "demo_finance"
BASE_CURRENCY = "EUR"


@dataclass(frozen=True)
class Account:
    code: str
    name: str
    account_type: str
    account_class: str
    normal_side: str
    group1: str
    group2: str
    is_control: bool = False
    allows_counterparty: bool = False
    allows_org_unit: bool = False
    is_bank: bool = False


ACCOUNTS = [
    Account("1000", "Rabobank Current Account", "balance_sheet", "asset", "debit", "Cash", "Bank", is_bank=True),
    Account("1200", "Trade Receivables", "balance_sheet", "asset", "debit", "Working Capital", "Receivables", True, True),
    Account("1300", "VAT Receivable", "balance_sheet", "asset", "debit", "Tax", "VAT"),
    Account("2000", "Trade Payables", "balance_sheet", "liability", "credit", "Working Capital", "Payables", True, True),
    Account("2100", "VAT Payable", "balance_sheet", "liability", "credit", "Tax", "VAT"),
    Account("3000", "Share Capital", "balance_sheet", "equity", "credit", "Equity", "Capital"),
    Account("4000", "Subscription Revenue", "profit_and_loss", "revenue", "credit", "Revenue", "Recurring"),
    Account("4010", "Implementation Revenue", "profit_and_loss", "revenue", "credit", "Revenue", "Services"),
    Account("5000", "Cloud Hosting", "profit_and_loss", "expense", "debit", "Cost of Sales", "Infrastructure", allows_org_unit=True),
    Account("5100", "Contractors", "profit_and_loss", "expense", "debit", "Cost of Sales", "Delivery", allows_org_unit=True),
    Account("6000", "Salaries", "profit_and_loss", "expense", "debit", "Operating Expenses", "People", allows_org_unit=True),
    Account("6100", "Office Rent", "profit_and_loss", "expense", "debit", "Operating Expenses", "Facilities", allows_org_unit=True),
    Account("6200", "Marketing", "profit_and_loss", "expense", "debit", "Operating Expenses", "Go To Market", allows_org_unit=True),
    Account("6300", "Software Subscriptions", "profit_and_loss", "expense", "debit", "Operating Expenses", "Tools", allows_org_unit=True),
]

CUSTOMERS = [
    ("CUST-001", "Northwind Logistics BV", "Amsterdam", 30, Decimal("45000")),
    ("CUST-002", "Blue Harbor Retail Group", "Rotterdam", 30, Decimal("35000")),
    ("CUST-003", "Vantage Manufacturing NL", "Eindhoven", 45, Decimal("60000")),
    ("CUST-004", "Helio Health Services", "Utrecht", 30, Decimal("25000")),
    ("CUST-005", "Atlas Advisory Partners", "The Hague", 14, Decimal("18000")),
]

SUPPLIERS = [
    ("SUP-001", "CloudGrid Europe", "Dublin", 14),
    ("SUP-002", "Studio North Marketing", "Amsterdam", 30),
    ("SUP-003", "Werkplek Amsterdam", "Amsterdam", 30),
    ("SUP-004", "TalentBridge Contractors", "Utrecht", 21),
    ("SUP-005", "StackDesk Software", "Berlin", 14),
]

ORG_UNITS = [
    ("SALES", "Sales", "department", "Mila de Vries"),
    ("CS", "Customer Success", "department", "Jonas Meijer"),
    ("ENG", "Engineering", "department", "Nora Bakker"),
    ("OPS", "Operations", "department", "Sven Jansen"),
]

JOURNALS = [
    ("SALES", "Sales Journal", "sales"),
    ("PURCHASE", "Purchase Journal", "purchase"),
    ("BANK", "Bank Journal", "bank"),
    ("GENERAL", "General Journal", "general"),
]

DOCUMENT_TYPES = [
    ("SALES_INVOICE", "Sales Invoice", "sales", "Customer invoice raised from the source ledger"),
    ("PURCHASE_INVOICE", "Purchase Invoice", "purchase", "Supplier invoice received from the source ledger"),
    ("BANK_PAYMENT", "Bank Payment", "cash", "Outgoing payment through the bank"),
    ("BANK_RECEIPT", "Bank Receipt", "cash", "Incoming receipt through the bank"),
    ("MANUAL_JOURNAL", "Manual Journal", "general", "Manual accounting entry"),
]

TAX_CODES = [
    ("VAT21", "VAT 21%", "sales_purchase", Decimal("21.0000"), Decimal("100.0000")),
    ("VAT9", "VAT 9%", "sales_purchase", Decimal("9.0000"), Decimal("100.0000")),
    ("VAT0", "VAT 0%", "sales_purchase", Decimal("0.0000"), Decimal("100.0000")),
]


def money(value: Decimal | int | str) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"))


def fiscal_year_period(value: date) -> tuple[int, int]:
    return value.year, value.month


def month_end(value: date) -> date:
    return date(value.year, value.month, calendar.monthrange(value.year, value.month)[1])


def date_range(start: date, end: date) -> list[date]:
    values: list[date] = []
    current = start
    while current <= end:
        values.append(current)
        current += timedelta(days=1)
    return values


async def scalar(conn: AsyncConnection, sql: str, params: dict[str, Any]) -> Any:
    return (await conn.execute(text(sql), params)).scalar_one()


async def execute(conn: AsyncConnection, sql: str, params: dict[str, Any] | list[dict[str, Any]] | None = None) -> None:
    await conn.execute(text(sql), params or {})


async def reset_demo_data(conn: AsyncConnection) -> None:
    params = {"company_code": COMPANY_CODE, "source_code": SOURCE_CODE}
    await execute(
        conn,
        """
        DELETE FROM core.fact_open_item_snapshot
        WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)
        """,
        params,
    )
    await execute(conn, "DELETE FROM core.fact_sales_invoice WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.fact_purchase_invoice WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.fact_budget WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.fact_journal_entry_line WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.fact_journal_entry WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM raw.raw_object WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM meta.sync_cursor WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM meta.sync_run WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.map_source_tax_code WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.map_source_journal WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.map_source_org_unit WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.map_source_ledger_account WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.map_source_counterparty WHERE company_source_connection_id IN (SELECT company_source_connection_id FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code))", params)
    await execute(conn, "DELETE FROM core.dim_tax_code WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.dim_journal WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.dim_org_unit WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.dim_ledger_account WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.dim_counterparty WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM meta.company_source_connection WHERE company_id IN (SELECT company_id FROM core.dim_company WHERE company_code = :company_code)", params)
    await execute(conn, "DELETE FROM core.dim_company WHERE company_code = :company_code", params)
    await execute(conn, "DELETE FROM meta.source_system WHERE source_code = :source_code", params)


async def seed_reference_data(conn: AsyncConnection, start_year: int, end_year: int) -> dict[str, Any]:
    await execute(
        conn,
        """
        INSERT INTO core.dim_currency (currency_code, currency_name, currency_symbol, decimal_places, is_active)
        VALUES (:code, :name, :symbol, 2, true)
        ON CONFLICT (currency_code) DO UPDATE
        SET currency_name = EXCLUDED.currency_name,
            currency_symbol = EXCLUDED.currency_symbol,
            decimal_places = EXCLUDED.decimal_places,
            is_active = true
        """,
        [
            {"code": "EUR", "name": "Euro", "symbol": "EUR"},
            {"code": "USD", "name": "US Dollar", "symbol": "$"},
            {"code": "GBP", "name": "Pound Sterling", "symbol": "GBP"},
        ],
    )

    for doc_code, name, category, description in DOCUMENT_TYPES:
        await execute(
            conn,
            """
            INSERT INTO core.dim_document_type (document_type_code, document_type_name, document_category, description)
            VALUES (:code, :name, :category, :description)
            ON CONFLICT (document_type_code) DO UPDATE
            SET document_type_name = EXCLUDED.document_type_name,
                document_category = EXCLUDED.document_category,
                description = EXCLUDED.description
            """,
            {"code": doc_code, "name": name, "category": category, "description": description},
        )

    rows = []
    for value in date_range(date(start_year, 1, 1), date(end_year, 12, 31)):
        rows.append(
            {
                "date_key": value,
                "year_number": value.year,
                "quarter_number": ((value.month - 1) // 3) + 1,
                "month_number": value.month,
                "month_name": value.strftime("%B"),
                "week_number": value.isocalendar().week,
                "day_of_month": value.day,
                "day_of_week_iso": value.isoweekday(),
                "day_name": value.strftime("%A"),
                "is_weekend": value.isoweekday() >= 6,
                "is_month_end": value == month_end(value),
                "fiscal_year_number": value.year,
                "fiscal_period_number": value.month,
                "fiscal_quarter_number": ((value.month - 1) // 3) + 1,
            }
        )
    await execute(
        conn,
        """
        INSERT INTO core.dim_date (
            date_key, year_number, quarter_number, month_number, month_name, week_number,
            day_of_month, day_of_week_iso, day_name, is_weekend, is_month_end,
            fiscal_year_number, fiscal_period_number, fiscal_quarter_number
        )
        VALUES (
            :date_key, :year_number, :quarter_number, :month_number, :month_name, :week_number,
            :day_of_month, :day_of_week_iso, :day_name, :is_weekend, :is_month_end,
            :fiscal_year_number, :fiscal_period_number, :fiscal_quarter_number
        )
        ON CONFLICT (date_key) DO UPDATE
        SET year_number = EXCLUDED.year_number,
            quarter_number = EXCLUDED.quarter_number,
            month_number = EXCLUDED.month_number,
            month_name = EXCLUDED.month_name,
            week_number = EXCLUDED.week_number,
            day_of_month = EXCLUDED.day_of_month,
            day_of_week_iso = EXCLUDED.day_of_week_iso,
            day_name = EXCLUDED.day_name,
            is_weekend = EXCLUDED.is_weekend,
            is_month_end = EXCLUDED.is_month_end,
            fiscal_year_number = EXCLUDED.fiscal_year_number,
            fiscal_period_number = EXCLUDED.fiscal_period_number,
            fiscal_quarter_number = EXCLUDED.fiscal_quarter_number
        """,
        rows,
    )

    return {
        "document_types": {
            code: await scalar(conn, "SELECT document_type_id FROM core.dim_document_type WHERE document_type_code = :code", {"code": code})
            for code, *_ in DOCUMENT_TYPES
        }
    }


async def seed_company_structure(conn: AsyncConnection) -> dict[str, Any]:
    source_id = await scalar(
        conn,
        """
        INSERT INTO meta.source_system (source_code, source_name, source_family, api_version, is_active)
        VALUES (:source_code, 'Demo Finance Connector', 'seed', 'v1', true)
        RETURNING source_system_id
        """,
        {"source_code": SOURCE_CODE},
    )
    company_id = await scalar(
        conn,
        """
        INSERT INTO core.dim_company (
            company_code, company_name, legal_entity_name, country_code, base_currency_code, fiscal_year_start_month, is_active
        )
        VALUES (:code, 'Solon Analytics Demo BV', 'Solon Analytics Demo B.V.', 'NL', :currency, 1, true)
        RETURNING company_id
        """,
        {"code": COMPANY_CODE, "currency": BASE_CURRENCY},
    )
    connection_id = await scalar(
        conn,
        """
        INSERT INTO meta.company_source_connection (
            company_id, source_system_id, source_tenant_key, source_company_key, connection_name,
            is_primary_for_company, connection_status, first_connected_at, last_successful_sync_at
        )
        VALUES (
            :company_id, :source_id, 'demo-tenant', 'solon-demo-bv', 'Demo finance ledger',
            true, 'active', :connected_at, :synced_at
        )
        RETURNING company_source_connection_id
        """,
        {
            "company_id": company_id,
            "source_id": source_id,
            "connected_at": datetime(2025, 1, 2, 9, 30, tzinfo=UTC),
            "synced_at": datetime.now(UTC),
        },
    )

    context: dict[str, Any] = {"source_id": source_id, "company_id": company_id, "connection_id": connection_id}

    context["accounts"] = {}
    for account in ACCOUNTS:
        account_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_ledger_account (
                company_id, account_code, account_name, account_type, account_class, normal_balance_side,
                reporting_group_lvl1, reporting_group_lvl2, is_control_account, allows_counterparty,
                allows_org_unit, is_bank_account, is_active
            )
            VALUES (
                :company_id, :code, :name, :account_type, :account_class, :normal_side,
                :group1, :group2, :is_control, :allows_counterparty, :allows_org_unit, :is_bank, true
            )
            RETURNING ledger_account_id
            """,
            {"company_id": company_id, **account.__dict__},
        )
        context["accounts"][account.code] = account_id
        await execute(
            conn,
            """
            INSERT INTO core.map_source_ledger_account (company_source_connection_id, source_record_id, source_code, ledger_account_id)
            VALUES (:connection_id, :source_record_id, :source_code, :account_id)
            """,
            {"connection_id": connection_id, "source_record_id": f"gl-{account.code}", "source_code": account.code, "account_id": account_id},
        )

    context["org_units"] = {}
    for code, name, unit_type, manager in ORG_UNITS:
        org_unit_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_org_unit (company_id, org_unit_code, org_unit_name, org_unit_type, manager_name, is_active)
            VALUES (:company_id, :code, :name, :unit_type, :manager, true)
            RETURNING org_unit_id
            """,
            {"company_id": company_id, "code": code, "name": name, "unit_type": unit_type, "manager": manager},
        )
        context["org_units"][code] = org_unit_id
        await execute(
            conn,
            "INSERT INTO core.map_source_org_unit (company_source_connection_id, source_record_id, source_code, org_unit_id) VALUES (:connection_id, :record_id, :code, :org_unit_id)",
            {"connection_id": connection_id, "record_id": f"dept-{code.lower()}", "code": code, "org_unit_id": org_unit_id},
        )

    context["journals"] = {}
    for code, name, journal_type in JOURNALS:
        journal_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_journal (company_id, journal_code, journal_name, journal_type, currency_code, is_active)
            VALUES (:company_id, :code, :name, :journal_type, :currency, true)
            RETURNING journal_id
            """,
            {"company_id": company_id, "code": code, "name": name, "journal_type": journal_type, "currency": BASE_CURRENCY},
        )
        context["journals"][code] = journal_id
        await execute(
            conn,
            "INSERT INTO core.map_source_journal (company_source_connection_id, source_record_id, source_code, journal_id) VALUES (:connection_id, :record_id, :code, :journal_id)",
            {"connection_id": connection_id, "record_id": f"journal-{code.lower()}", "code": code, "journal_id": journal_id},
        )

    context["tax_codes"] = {}
    for tax_code, tax_name, tax_type, rate, recoverability in TAX_CODES:
        tax_code_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_tax_code (company_id, tax_code, tax_name, tax_type, tax_rate_pct, recoverability_pct, is_active)
            VALUES (:company_id, :tax_code, :tax_name, :tax_type, :rate, :recoverability, true)
            RETURNING tax_code_id
            """,
            {"company_id": company_id, "tax_code": tax_code, "tax_name": tax_name, "tax_type": tax_type, "rate": rate, "recoverability": recoverability},
        )
        context["tax_codes"][tax_code] = tax_code_id
        await execute(
            conn,
            "INSERT INTO core.map_source_tax_code (company_source_connection_id, source_record_id, source_code, tax_code_id) VALUES (:connection_id, :record_id, :code, :tax_code_id)",
            {"connection_id": connection_id, "record_id": f"tax-{tax_code.lower()}", "code": tax_code, "tax_code_id": tax_code_id},
        )

    context["customers"] = {}
    for code, name, city, terms, limit in CUSTOMERS:
        customer_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_counterparty (
                company_id, company_source_connection_id, counterparty_code, counterparty_name, display_name,
                counterparty_type, is_customer, is_supplier, status, country_code, city, payment_terms_days, credit_limit_amount
            )
            VALUES (:company_id, :connection_id, :code, :name, :name, 'organization', true, false, 'active', 'NL', :city, :terms, :limit)
            RETURNING counterparty_id
            """,
            {"company_id": company_id, "connection_id": connection_id, "code": code, "name": name, "city": city, "terms": terms, "limit": limit},
        )
        context["customers"][code] = customer_id
        await execute(
            conn,
            "INSERT INTO core.map_source_counterparty (company_source_connection_id, source_record_id, source_code, counterparty_id) VALUES (:connection_id, :record_id, :code, :counterparty_id)",
            {"connection_id": connection_id, "record_id": f"customer-{code.lower()}", "code": code, "counterparty_id": customer_id},
        )

    context["suppliers"] = {}
    for code, name, city, terms in SUPPLIERS:
        supplier_id = await scalar(
            conn,
            """
            INSERT INTO core.dim_counterparty (
                company_id, company_source_connection_id, counterparty_code, counterparty_name, display_name,
                counterparty_type, is_customer, is_supplier, status, country_code, city, payment_terms_days
            )
            VALUES (:company_id, :connection_id, :code, :name, :name, 'organization', false, true, 'active', 'NL', :city, :terms)
            RETURNING counterparty_id
            """,
            {"company_id": company_id, "connection_id": connection_id, "code": code, "name": name, "city": city, "terms": terms},
        )
        context["suppliers"][code] = supplier_id
        await execute(
            conn,
            "INSERT INTO core.map_source_counterparty (company_source_connection_id, source_record_id, source_code, counterparty_id) VALUES (:connection_id, :record_id, :code, :counterparty_id)",
            {"connection_id": connection_id, "record_id": f"supplier-{code.lower()}", "code": code, "counterparty_id": supplier_id},
        )

    return context


async def insert_journal_entry(
    conn: AsyncConnection,
    context: dict[str, Any],
    document_types: dict[str, Any],
    *,
    record_id: str,
    source_object_type: str,
    journal_code: str,
    document_type_code: str,
    document_number: str,
    posting_date: date,
    due_date: date | None,
    description: str,
    lines: list[dict[str, Any]],
) -> Any:
    fiscal_year, fiscal_period = fiscal_year_period(posting_date)
    journal_entry_id = await scalar(
        conn,
        """
        INSERT INTO core.fact_journal_entry (
            company_id, company_source_connection_id, source_record_id, source_object_type,
            journal_id, document_type_id, entry_number, document_number, posting_date,
            document_date, due_date, fiscal_year_number, fiscal_period_number,
            entry_currency_code, base_currency_code, description, status
        )
        VALUES (
            :company_id, :connection_id, :record_id, :object_type, :journal_id, :document_type_id,
            :entry_number, :document_number, :posting_date, :document_date, :due_date,
            :fiscal_year, :fiscal_period, :currency, :currency, :description, 'posted'
        )
        RETURNING journal_entry_id
        """,
        {
            "company_id": context["company_id"],
            "connection_id": context["connection_id"],
            "record_id": record_id,
            "object_type": source_object_type,
            "journal_id": context["journals"][journal_code],
            "document_type_id": document_types[document_type_code],
            "entry_number": record_id.upper(),
            "document_number": document_number,
            "posting_date": posting_date,
            "document_date": posting_date,
            "due_date": due_date,
            "fiscal_year": fiscal_year,
            "fiscal_period": fiscal_period,
            "currency": BASE_CURRENCY,
            "description": description,
        },
    )

    for index, line in enumerate(lines, start=1):
        debit = money(line.get("debit", 0))
        credit = money(line.get("credit", 0))
        await execute(
            conn,
            """
            INSERT INTO core.fact_journal_entry_line (
                journal_entry_id, company_id, company_source_connection_id, source_record_id, source_line_id,
                line_number, ledger_account_id, counterparty_id, org_unit_id, tax_code_id, document_type_id,
                posting_date, document_date, due_date, fiscal_year_number, fiscal_period_number,
                debit_amount_base, credit_amount_base, signed_amount_base, transaction_currency_code,
                transaction_amount, base_currency_code, tax_amount_base, description, source_document_number
            )
            VALUES (
                :journal_entry_id, :company_id, :connection_id, :record_id, :line_id, :line_number,
                :account_id, :counterparty_id, :org_unit_id, :tax_code_id, :document_type_id,
                :posting_date, :posting_date, :due_date, :fiscal_year, :fiscal_period,
                :debit, :credit, :signed, :currency, :transaction_amount, :currency,
                :tax_amount, :description, :document_number
            )
            """,
            {
                "journal_entry_id": journal_entry_id,
                "company_id": context["company_id"],
                "connection_id": context["connection_id"],
                "record_id": record_id,
                "line_id": f"{record_id}-{index:03d}",
                "line_number": index,
                "account_id": context["accounts"][line["account"]],
                "counterparty_id": line.get("counterparty_id"),
                "org_unit_id": line.get("org_unit_id"),
                "tax_code_id": line.get("tax_code_id"),
                "document_type_id": document_types[document_type_code],
                "posting_date": posting_date,
                "due_date": due_date,
                "fiscal_year": fiscal_year,
                "fiscal_period": fiscal_period,
                "debit": debit,
                "credit": credit,
                "signed": debit - credit,
                "currency": BASE_CURRENCY,
                "transaction_amount": debit if debit > 0 else credit,
                "tax_amount": line.get("tax_amount"),
                "description": line.get("description", description),
                "document_number": document_number,
            },
        )

    await execute(
        conn,
        """
        INSERT INTO raw.raw_object (
            company_id, source_system_id, company_source_connection_id, object_type,
            source_endpoint, source_record_id, source_updated_at, source_created_at, payload_json
        )
        VALUES (
            :company_id, :source_id, :connection_id, :object_type,
            '/demo/finance', :record_id, :updated_at, :created_at, CAST(:payload AS jsonb)
        )
        """,
        {
            "company_id": context["company_id"],
            "source_id": context["source_id"],
            "connection_id": context["connection_id"],
            "object_type": source_object_type,
            "record_id": record_id,
            "updated_at": datetime.combine(posting_date, datetime.min.time(), tzinfo=UTC),
            "created_at": datetime.combine(posting_date, datetime.min.time(), tzinfo=UTC),
            "payload": json.dumps(
                {
                    "document_number": document_number,
                    "posting_date": posting_date.isoformat(),
                    "description": description,
                    "line_count": len(lines),
                    "source": "seed_finance_demo",
                }
            ),
        },
    )
    return journal_entry_id


async def seed_transactions(conn: AsyncConnection, context: dict[str, Any], document_types: dict[str, Any], year: int) -> dict[str, int]:
    sales_invoices: list[dict[str, Any]] = []
    purchase_invoices: list[dict[str, Any]] = []
    snapshot_at = datetime(year, 12, 31, 23, 0, tzinfo=UTC)

    for month in range(1, 13):
        posting_date = date(year, month, min(25, calendar.monthrange(year, month)[1]))
        for index, customer_code in enumerate(["CUST-001", "CUST-002", "CUST-003", "CUST-004"], start=1):
            base = money(Decimal(7200 + month * 180 + index * 650))
            implementation = money(Decimal(2500 if (month + index) % 4 == 0 else 0))
            subtotal = base + implementation
            tax = money(subtotal * Decimal("0.21"))
            total = subtotal + tax
            invoice_number = f"SINV-{year}{month:02d}-{index:03d}"
            customer_id = context["customers"][customer_code]
            org_unit_id = context["org_units"]["SALES" if index % 2 else "CS"]
            journal_entry_id = await insert_journal_entry(
                conn,
                context,
                document_types,
                record_id=f"sales-{year}-{month:02d}-{index:03d}",
                source_object_type="sales_invoice",
                journal_code="SALES",
                document_type_code="SALES_INVOICE",
                document_number=invoice_number,
                posting_date=posting_date,
                due_date=posting_date + timedelta(days=30),
                description=f"Monthly subscription and services for {customer_code}",
                lines=[
                    {"account": "1200", "debit": total, "counterparty_id": customer_id, "description": "Trade receivable"},
                    {"account": "4000", "credit": base, "counterparty_id": customer_id, "org_unit_id": org_unit_id, "tax_code_id": context["tax_codes"]["VAT21"], "description": "Subscription revenue"},
                    {"account": "4010", "credit": implementation, "counterparty_id": customer_id, "org_unit_id": org_unit_id, "tax_code_id": context["tax_codes"]["VAT21"], "description": "Implementation revenue"},
                    {"account": "2100", "credit": tax, "tax_code_id": context["tax_codes"]["VAT21"], "tax_amount": tax, "description": "VAT payable"},
                ],
            )
            sales_invoice_id = await scalar(
                conn,
                """
                INSERT INTO core.fact_sales_invoice (
                    company_id, company_source_connection_id, source_record_id, customer_id, journal_id,
                    invoice_number, invoice_date, due_date, posting_date, fiscal_year_number, fiscal_period_number,
                    currency_code, amount_excl_tax_base, tax_amount_base, amount_incl_tax_base, status,
                    description, journal_entry_id
                )
                VALUES (
                    :company_id, :connection_id, :record_id, :customer_id, :journal_id,
                    :invoice_number, :invoice_date, :due_date, :posting_date, :fiscal_year, :fiscal_period,
                    :currency, :subtotal, :tax, :total, :status, :description, :journal_entry_id
                )
                RETURNING sales_invoice_id
                """,
                {
                    "company_id": context["company_id"],
                    "connection_id": context["connection_id"],
                    "record_id": f"sales-{year}-{month:02d}-{index:03d}",
                    "customer_id": customer_id,
                    "journal_id": context["journals"]["SALES"],
                    "invoice_number": invoice_number,
                    "invoice_date": posting_date,
                    "due_date": posting_date + timedelta(days=30),
                    "posting_date": posting_date,
                    "fiscal_year": year,
                    "fiscal_period": month,
                    "currency": BASE_CURRENCY,
                    "subtotal": subtotal,
                    "tax": tax,
                    "total": total,
                    "status": "open" if month >= 11 else "paid",
                    "description": f"Invoice {invoice_number}",
                    "journal_entry_id": journal_entry_id,
                },
            )
            sales_invoices.append({"id": sales_invoice_id, "record_id": f"sales-{year}-{month:02d}-{index:03d}", "customer_id": customer_id, "invoice_number": invoice_number, "invoice_date": posting_date, "due_date": posting_date + timedelta(days=30), "total": total, "month": month})

        purchases = [
            ("SUP-001", "5000", "ENG", Decimal(2600 + month * 55), "Cloud hosting"),
            ("SUP-002", "6200", "SALES", Decimal(1800 + month * 45), "Marketing campaign"),
            ("SUP-003", "6100", "OPS", Decimal(3200), "Office rent"),
            ("SUP-004", "5100", "CS", Decimal(4200 + month * 80), "Contractor delivery"),
            ("SUP-005", "6300", "ENG", Decimal(950 + month * 20), "Software subscriptions"),
        ]
        for index, (supplier_code, account_code, org_code, amount_value, description) in enumerate(purchases, start=1):
            subtotal = money(amount_value)
            tax = money(subtotal * Decimal("0.21"))
            total = subtotal + tax
            invoice_number = f"PINV-{year}{month:02d}-{index:03d}"
            supplier_id = context["suppliers"][supplier_code]
            journal_entry_id = await insert_journal_entry(
                conn,
                context,
                document_types,
                record_id=f"purchase-{year}-{month:02d}-{index:03d}",
                source_object_type="purchase_invoice",
                journal_code="PURCHASE",
                document_type_code="PURCHASE_INVOICE",
                document_number=invoice_number,
                posting_date=posting_date - timedelta(days=8),
                due_date=posting_date + timedelta(days=22),
                description=f"{description} from {supplier_code}",
                lines=[
                    {"account": account_code, "debit": subtotal, "counterparty_id": supplier_id, "org_unit_id": context["org_units"][org_code], "tax_code_id": context["tax_codes"]["VAT21"], "description": description},
                    {"account": "1300", "debit": tax, "tax_code_id": context["tax_codes"]["VAT21"], "tax_amount": tax, "description": "VAT receivable"},
                    {"account": "2000", "credit": total, "counterparty_id": supplier_id, "description": "Trade payable"},
                ],
            )
            purchase_invoice_id = await scalar(
                conn,
                """
                INSERT INTO core.fact_purchase_invoice (
                    company_id, company_source_connection_id, source_record_id, supplier_id, journal_id,
                    invoice_number, invoice_date, due_date, posting_date, fiscal_year_number, fiscal_period_number,
                    currency_code, amount_excl_tax_base, tax_amount_base, amount_incl_tax_base, status,
                    description, journal_entry_id
                )
                VALUES (
                    :company_id, :connection_id, :record_id, :supplier_id, :journal_id,
                    :invoice_number, :invoice_date, :due_date, :posting_date, :fiscal_year, :fiscal_period,
                    :currency, :subtotal, :tax, :total, :status, :description, :journal_entry_id
                )
                RETURNING purchase_invoice_id
                """,
                {
                    "company_id": context["company_id"],
                    "connection_id": context["connection_id"],
                    "record_id": f"purchase-{year}-{month:02d}-{index:03d}",
                    "supplier_id": supplier_id,
                    "journal_id": context["journals"]["PURCHASE"],
                    "invoice_number": invoice_number,
                    "invoice_date": posting_date - timedelta(days=8),
                    "due_date": posting_date + timedelta(days=22),
                    "posting_date": posting_date - timedelta(days=8),
                    "fiscal_year": year,
                    "fiscal_period": month,
                    "currency": BASE_CURRENCY,
                    "subtotal": subtotal,
                    "tax": tax,
                    "total": total,
                    "status": "open" if month == 12 and index in {1, 4} else "paid",
                    "description": description,
                    "journal_entry_id": journal_entry_id,
                },
            )
            purchase_invoices.append({"id": purchase_invoice_id, "record_id": f"purchase-{year}-{month:02d}-{index:03d}", "supplier_id": supplier_id, "invoice_number": invoice_number, "invoice_date": posting_date - timedelta(days=8), "due_date": posting_date + timedelta(days=22), "total": total, "month": month})

        payroll = money(Decimal(38500 + month * 420))
        await insert_journal_entry(
            conn,
            context,
            document_types,
            record_id=f"payroll-{year}-{month:02d}",
            source_object_type="manual_journal",
            journal_code="GENERAL",
            document_type_code="MANUAL_JOURNAL",
            document_number=f"PAY-{year}{month:02d}",
            posting_date=month_end(date(year, month, 1)),
            due_date=None,
            description="Monthly payroll accrual",
            lines=[
                {"account": "6000", "debit": payroll, "org_unit_id": context["org_units"]["ENG"], "description": "Salaries"},
                {"account": "1000", "credit": payroll, "description": "Payroll bank payment"},
            ],
        )

    for invoice in sales_invoices:
        if invoice["month"] >= 11:
            open_amount = money(invoice["total"] * (Decimal("0.65") if invoice["month"] == 11 else Decimal("1.00")))
            days_overdue = (snapshot_at.date() - invoice["due_date"]).days
            await insert_open_item(conn, context, snapshot_at, "receivable", invoice, open_amount, days_overdue)
        elif invoice["month"] % 3 == 0:
            await insert_settlement(conn, context, document_types, invoice, "receivable")

    for invoice in purchase_invoices:
        if invoice["month"] == 12 and invoice["invoice_number"].endswith(("001", "004")):
            days_overdue = (snapshot_at.date() - invoice["due_date"]).days
            await insert_open_item(conn, context, snapshot_at, "payable", invoice, money(invoice["total"]), days_overdue)
        elif invoice["month"] % 4 == 0:
            await insert_settlement(conn, context, document_types, invoice, "payable")

    return {
        "journal_entries": 12 * (4 + 5 + 1) + len([i for i in sales_invoices if i["month"] % 3 == 0]) + len([i for i in purchase_invoices if i["month"] % 4 == 0]),
        "sales_invoices": len(sales_invoices),
        "purchase_invoices": len(purchase_invoices),
    }


async def insert_settlement(conn: AsyncConnection, context: dict[str, Any], document_types: dict[str, Any], invoice: dict[str, Any], item_type: str) -> None:
    if item_type == "receivable":
        await insert_journal_entry(
            conn,
            context,
            document_types,
            record_id=f"receipt-{invoice['record_id']}",
            source_object_type="bank_receipt",
            journal_code="BANK",
            document_type_code="BANK_RECEIPT",
            document_number=f"RCPT-{invoice['invoice_number']}",
            posting_date=invoice["due_date"] - timedelta(days=3),
            due_date=None,
            description=f"Customer receipt for {invoice['invoice_number']}",
            lines=[
                {"account": "1000", "debit": invoice["total"], "counterparty_id": invoice["customer_id"], "description": "Bank receipt"},
                {"account": "1200", "credit": invoice["total"], "counterparty_id": invoice["customer_id"], "description": "Receivable cleared"},
            ],
        )
    else:
        await insert_journal_entry(
            conn,
            context,
            document_types,
            record_id=f"payment-{invoice['record_id']}",
            source_object_type="bank_payment",
            journal_code="BANK",
            document_type_code="BANK_PAYMENT",
            document_number=f"PAY-{invoice['invoice_number']}",
            posting_date=invoice["due_date"] - timedelta(days=2),
            due_date=None,
            description=f"Supplier payment for {invoice['invoice_number']}",
            lines=[
                {"account": "2000", "debit": invoice["total"], "counterparty_id": invoice["supplier_id"], "description": "Payable cleared"},
                {"account": "1000", "credit": invoice["total"], "counterparty_id": invoice["supplier_id"], "description": "Bank payment"},
            ],
        )


async def insert_open_item(
    conn: AsyncConnection,
    context: dict[str, Any],
    snapshot_at: datetime,
    item_type: str,
    invoice: dict[str, Any],
    open_amount: Decimal,
    days_overdue: int,
) -> None:
    bucket = "current"
    if days_overdue > 90:
        bucket = "90+"
    elif days_overdue > 60:
        bucket = "61-90"
    elif days_overdue > 30:
        bucket = "31-60"
    elif days_overdue > 0:
        bucket = "1-30"

    await execute(
        conn,
        """
        INSERT INTO core.fact_open_item_snapshot (
            company_id, company_source_connection_id, snapshot_at, source_record_id, item_type,
            counterparty_id, sales_invoice_id, purchase_invoice_id, document_number, invoice_date,
            due_date, currency_code, original_amount_base, open_amount_base, days_overdue,
            aging_bucket, is_overdue
        )
        VALUES (
            :company_id, :connection_id, :snapshot_at, :record_id, :item_type,
            :counterparty_id, :sales_invoice_id, :purchase_invoice_id, :document_number,
            :invoice_date, :due_date, :currency, :original_amount, :open_amount, :days_overdue,
            :aging_bucket, :is_overdue
        )
        """,
        {
            "company_id": context["company_id"],
            "connection_id": context["connection_id"],
            "snapshot_at": snapshot_at,
            "record_id": f"open-{item_type}-{invoice['record_id']}",
            "item_type": item_type,
            "counterparty_id": invoice.get("customer_id") or invoice.get("supplier_id"),
            "sales_invoice_id": invoice["id"] if item_type == "receivable" else None,
            "purchase_invoice_id": invoice["id"] if item_type == "payable" else None,
            "document_number": invoice["invoice_number"],
            "invoice_date": invoice["invoice_date"],
            "due_date": invoice["due_date"],
            "currency": BASE_CURRENCY,
            "original_amount": invoice["total"],
            "open_amount": open_amount,
            "days_overdue": days_overdue,
            "aging_bucket": bucket,
            "is_overdue": days_overdue > 0,
        },
    )


async def seed_budgets(conn: AsyncConnection, context: dict[str, Any], year: int) -> int:
    rows: list[dict[str, Any]] = []
    for month in range(1, 13):
        date_key = date(year, month, 1)
        for account_code, amount in [
            ("4000", Decimal("-39000") - Decimal(month * 900)),
            ("4010", Decimal("-7500") if month % 2 == 0 else Decimal("-3000")),
            ("5000", Decimal("3100") + Decimal(month * 45)),
            ("5100", Decimal("5200") + Decimal(month * 60)),
            ("6000", Decimal("39500") + Decimal(month * 350)),
            ("6100", Decimal("3200")),
            ("6200", Decimal("2400") + Decimal(month * 40)),
            ("6300", Decimal("1100") + Decimal(month * 25)),
        ]:
            rows.append(
                {
                    "company_id": context["company_id"],
                    "connection_id": context["connection_id"],
                    "record_id": f"budget-{year}-{month:02d}-{account_code}",
                    "budget_name": f"{year} Operating Budget",
                    "scenario": "Board Approved",
                    "account_id": context["accounts"][account_code],
                    "org_unit_id": context["org_units"]["ENG"] if account_code in {"5000", "6000", "6300"} else None,
                    "date_key": date_key,
                    "year": year,
                    "period": month,
                    "amount": money(amount),
                }
            )
    await execute(
        conn,
        """
        INSERT INTO core.fact_budget (
            company_id, company_source_connection_id, source_record_id, budget_name, scenario_name,
            ledger_account_id, org_unit_id, date_key, fiscal_year_number, fiscal_period_number, amount_base
        )
        VALUES (
            :company_id, :connection_id, :record_id, :budget_name, :scenario, :account_id,
            :org_unit_id, :date_key, :year, :period, :amount
        )
        """,
        rows,
    )
    return len(rows)


async def seed_sync_metadata(conn: AsyncConnection, context: dict[str, Any]) -> int:
    object_types = ["ledger_accounts", "counterparties", "journals", "sales_invoice", "purchase_invoice", "journal_entry", "open_item_snapshot", "budget"]
    now = datetime.now(UTC)
    for index, object_type in enumerate(object_types):
        started = now - timedelta(minutes=30 - index * 2)
        finished = started + timedelta(seconds=35 + index * 5)
        await execute(
            conn,
            """
            INSERT INTO meta.sync_run (
                company_id, source_system_id, company_source_connection_id, object_type, sync_mode,
                sync_status, cursor_value, started_at, finished_at, rows_read, rows_loaded, rows_rejected, rows_deleted
            )
            VALUES (
                :company_id, :source_id, :connection_id, :object_type, 'full', 'success',
                :cursor_value, :started, :finished, :rows_read, :rows_loaded, 0, 0
            )
            """,
            {
                "company_id": context["company_id"],
                "source_id": context["source_id"],
                "connection_id": context["connection_id"],
                "object_type": object_type,
                "cursor_value": finished.isoformat(),
                "started": started,
                "finished": finished,
                "rows_read": 20 + index * 12,
                "rows_loaded": 20 + index * 12,
            },
        )
        await execute(
            conn,
            """
            INSERT INTO meta.sync_cursor (
                company_id, source_system_id, company_source_connection_id, object_type,
                cursor_type, cursor_value, last_successful_sync_at
            )
            VALUES (:company_id, :source_id, :connection_id, :object_type, 'updated_at', :cursor_value, :finished)
            """,
            {
                "company_id": context["company_id"],
                "source_id": context["source_id"],
                "connection_id": context["connection_id"],
                "object_type": object_type,
                "cursor_value": finished.isoformat(),
                "finished": finished,
            },
        )
    return len(object_types)


async def seed_finance_demo(year: int, reset: bool = True) -> dict[str, int]:
    async with engine.begin() as conn:
        if reset:
            await reset_demo_data(conn)

        reference = await seed_reference_data(conn, year - 1, year + 1)
        context = await seed_company_structure(conn)
        counts = await seed_transactions(conn, context, reference["document_types"], year)
        counts["budgets"] = await seed_budgets(conn, context, year)
        counts["sync_objects"] = await seed_sync_metadata(conn, context)
        counts["companies"] = 1
        counts["accounts"] = len(ACCOUNTS)
        counts["counterparties"] = len(CUSTOMERS) + len(SUPPLIERS)
        counts["org_units"] = len(ORG_UNITS)
        return counts


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed realistic demo finance data into the warehouse.")
    parser.add_argument("--year", type=int, default=2025, help="Fiscal year to seed. Defaults to 2025.")
    parser.add_argument("--no-reset", action="store_true", help="Do not clear existing SOLON-DEMO seed data first.")
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    counts = await seed_finance_demo(year=args.year, reset=not args.no_reset)
    print("Seeded finance demo data:")
    for key in sorted(counts):
        print(f"  {key}: {counts[key]}")


if __name__ == "__main__":
    asyncio.run(main())
