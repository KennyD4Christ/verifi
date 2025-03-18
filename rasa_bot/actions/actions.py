import sys
import os

sys.path.insert(0, os.path.abspath('/home/kennyd/verifi/Finstock'))

# Set the Django settings module.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

import logging
from typing import Any, Dict, List, Text, Optional
import re
import traceback
import calendar
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from rasa_sdk import Action, FormValidationAction, Tracker
from asgiref.sync import sync_to_async
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.types import DomainDict
from rasa_sdk.events import SlotSet, ActiveLoop
from django.db.models import Sum, Avg, Count, F, Q, ExpressionWrapper, DecimalField
from django.db.models.functions import TruncMonth, TruncDay, ExtractMonth
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta

# Import Django models
from inspection.models import (
    AuthGroup,
    ProductsProduct,
    CoreOrder,
    CoreOrderitem,
    CoreCustomer,
    InvoicesInvoice, 
    TransactionsTransaction, 
    ProductsCategory,
    StockAdjustmentsStockadjustment
)

class ActionCheckAuthorization(Action):
    """Action to check if the user is authorized to access certain data."""

    def name(self) -> Text:
        return "action_check_authorization"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        # Get the user ID from the metadata
        # This is set by our auth middleware
        metadata = tracker.get_slot("session_started_metadata") or {}
        user_id = metadata.get("user_id")

        if not user_id:
            dispatcher.utter_message(text="I'm sorry, but you don't appear to be properly authenticated. Please try logging in again.")
            return [SlotSet("is_authenticated", False)]

        # You can add additional authorization checks here
        # For example, check if the user has access to financial data

        return [SlotSet("is_authenticated", True), SlotSet("user_id", user_id)]

class ActionGetPersonalizedData(Action):
    """Action to get personalized data for the authenticated user."""

    def name(self) -> Text:
        return "action_get_personalized_data"

    async def run(
        self,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: Dict[Text, Any],
    ) -> List[Dict[Text, Any]]:
        # First check if user is authenticated
        is_authenticated = tracker.get_slot("is_authenticated")
        user_id = tracker.get_slot("user_id")

        if not is_authenticated or not user_id:
            dispatcher.utter_message(text="You need to be logged in to access this information.")
            return []

        # Get personalized data for the user
        # In a real application, you would query your database here
        dispatcher.utter_message(text=f"Here's your personalized financial summary for user {user_id}...")

        return []

class ActionParsePeriod(Action):
    def name(self) -> str:
        return "action_parse_time_period"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: dict) -> list:
        logging.info("ActionParsePeriod.run called")

        # First, try to extract the entire message to check for date range patterns
        last_message = tracker.latest_message.get('text', '')
        logging.info(f"Processing full message: {last_message}")

        # Look for date range patterns in the entire message
        date_range_patterns = [
            r'(?:from|between)?\s*(\d{4}-\d{1,2}-\d{1,2})\s+(?:to|and|through|till|until)\s+(\d{4}-\d{1,2}-\d{1,2})',
            r'(\d{4}-\d{1,2}-\d{1,2})\s+(?:to|and|through|till|until)\s+(\d{4}-\d{1,2}-\d{1,2})',
        ]

        for pattern in date_range_patterns:
            match = re.search(pattern, last_message)
            if match:
                start_date_str = self._normalize_date_string(match.group(1))
                end_date_str = self._normalize_date_string(match.group(2))
                logging.info(f"Found date range in message: {start_date_str} to {end_date_str}")

                try:
                    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")

                    # Ensure end_date is the end of the day
                    end_date = end_date.replace(hour=23, minute=59, second=59)

                    start_date_str = start_date.strftime("%Y-%m-%d")
                    end_date_str = end_date.strftime("%Y-%m-%d")
                    logging.info(f"Successfully parsed date range: {start_date_str} to {end_date_str}")
                    return [SlotSet("time_period", f"{start_date_str}|{end_date_str}")]
                except ValueError as e:
                    logging.error(f"Date parsing error in message: {str(e)}")

        # Before checking entities, check the full message for time period phrases
        time_period_keywords = [
            "today", "yesterday", "this week", "last week", "this month", "last month",
            "this quarter", "last quarter", "this year", "last year"
        ]
        
        # Also look for relative time patterns like "last 2 weeks"
        relative_pattern = r'(last|past|previous)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)'
        rel_match = re.search(relative_pattern, last_message.lower())
        
        if rel_match:
            # Extract the full relative time expression
            full_period = rel_match.group(0)
            logging.info(f"Found relative time period in message: {full_period}")
            try:
                start_date, end_date = self._parse_time_period(full_period)
                start_date_str = start_date.strftime("%Y-%m-%d")
                end_date_str = end_date.strftime("%Y-%m-%d")
                logging.info(f"Successfully parsed relative time period: {start_date_str} to {end_date_str}")
                return [SlotSet("time_period", f"{start_date_str}|{end_date_str}")]
            except ValueError as e:
                logging.error(f"Relative time parsing error: {str(e)}")
        
        # Check for common time period keywords
        for keyword in time_period_keywords:
            if keyword.lower() in last_message.lower():
                logging.info(f"Found time period keyword in message: {keyword}")
                try:
                    start_date, end_date = self._parse_time_period(keyword)
                    start_date_str = start_date.strftime("%Y-%m-%d")
                    end_date_str = end_date.strftime("%Y-%m-%d")
                    logging.info(f"Successfully parsed time period keyword: {start_date_str} to {end_date_str}")
                    return [SlotSet("time_period", f"{start_date_str}|{end_date_str}")]
                except ValueError as e:
                    logging.error(f"Keyword time parsing error: {str(e)}")

        # Check for separate date entities
        start_date_entity = next(tracker.get_latest_entity_values("start_date"), None)
        end_date_entity = next(tracker.get_latest_entity_values("end_date"), None)

        # If both start and end dates are provided as separate entities
        if start_date_entity and end_date_entity:
            logging.info(f"Retrieved date range entities: {start_date_entity} to {end_date_entity}")
            try:
                start_date = self._parse_date(start_date_entity)
                end_date = self._parse_date(end_date_entity)

                # Ensure end_date is the end of the day
                end_date = end_date.replace(hour=23, minute=59, second=59)

                start_date_str = start_date.strftime("%Y-%m-%d")
                end_date_str = end_date.strftime("%Y-%m-%d")
                logging.info(f"Parsed date range: {start_date_str} to {end_date_str}")
                return [SlotSet("time_period", f"{start_date_str}|{end_date_str}")]
            except ValueError as e:
                error_message = f"Could not understand the date range '{start_date_entity} to {end_date_entity}'. Please use YYYY-MM-DD format."
                logging.error(f"Date range parsing error: {str(e)}")
                dispatcher.utter_message(text=error_message)
                return []

        # Fall back to regular time_period handling
        time_period = next(tracker.get_latest_entity_values("time_period"), tracker.get_slot("time_period"))
        logging.info(f"Retrieved slot time_period: {time_period}")

        if not time_period:
            dispatcher.utter_message(text="Could not parse time period. Please specify dates like '2025-02-06 to 2025-03-08'.")
            return []

        logging.info(f"Parsing raw time period: {time_period}")
        try:
            start_date, end_date = self._parse_time_period(time_period)
            # Convert dates to string before storing them in slots
            start_date_str = start_date.strftime("%Y-%m-%d")
            end_date_str = end_date.strftime("%Y-%m-%d")
            logging.info(f"Parsed time period: {time_period} → {start_date_str} to {end_date_str}")
            return [SlotSet("time_period", f"{start_date_str}|{end_date_str}")]
        except ValueError as e:
            error_message = f"Could not understand the time period '{time_period}'. Please use formats like '2025-02-06 to 2025-03-08', 'Q1 2024', 'last month', or 'last week'."
            logging.error(f"Time period parsing error: {str(e)}")
            dispatcher.utter_message(text=error_message)
            return []

    def _parse_date(self, date_str: str) -> datetime:
        """Parse a date string in various formats"""
        formats = [
            "%Y-%m-%d",      # 2023-01-01
            "%d/%m/%Y",      # 01/01/2023
            "%m/%d/%Y",      # 01/01/2023
            "%d-%m-%Y",      # 01-01-2023
            "%B %d, %Y",     # January 01, 2023
            "%b %d, %Y",     # Jan 01, 2023
        ]

        for date_format in formats:
            try:
                return datetime.strptime(date_str, date_format)
            except ValueError:
                continue

        raise ValueError(f"Unable to parse date: '{date_str}'")

    def _parse_time_period(self, period: str) -> tuple:
        now = datetime.now()

        # Handle the case where period might already be in "start|end" format
        if '|' in period:
            parts = period.split('|')
            if len(parts) == 2:
                try:
                    start_date = datetime.strptime(parts[0], "%Y-%m-%d")
                    end_date = datetime.strptime(parts[1], "%Y-%m-%d")
                    # Ensure end_date is end of day
                    end_date = end_date.replace(hour=23, minute=59, second=59)
                    return start_date, end_date
                except ValueError:
                    pass  # Continue with other parsing methods if this fails

        period = period.lower().strip()

        # Check for date range pattern first (e.g., "2025-01-01 to 2025-02-28")
        date_range_patterns = [
            r'^(\d{4}-\d{1,2}-\d{1,2})\s+to\s+(\d{4}-\d{1,2}-\d{1,2})$',
            r'^(\d{4}-\d{1,2}-\d{1,2})\s*\|\s*(\d{4}-\d{1,2}-\d{1,2})$',
            r'^(\d{4}-\d{1,2}-\d{1,2})\s*-\s*(\d{4}-\d{1,2}-\d{1,2})$',
            r'^from\s+(\d{4}-\d{1,2}-\d{1,2})\s+to\s+(\d{4}-\d{1,2}-\d{1,2})$',
            r'^between\s+(\d{4}-\d{1,2}-\d{1,2})\s+and\s+(\d{4}-\d{1,2}-\d{1,2})$',
        ]

        for pattern in date_range_patterns:
            match = re.match(pattern, period)
            if match:
                try:
                    # Ensure consistent date format by padding single-digit months and days
                    start_date_str = self._normalize_date_string(match.group(1))
                    end_date_str = self._normalize_date_string(match.group(2))

                    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")

                    # Ensure end_date is end of day
                    end_date = end_date.replace(hour=23, minute=59, second=59)

                    return start_date, end_date
                except ValueError as e:
                    logging.error(f"Date parsing error in range: {str(e)}")
                    continue

        # Pre-defined period mappings
        period_mappings = {
            'last month': ((now.replace(day=1) - timedelta(days=1)).replace(day=1),
                          now.replace(day=1) - timedelta(days=1)),
            'this month': (now.replace(day=1), now),
            'last year': (now.replace(month=1, day=1, year=now.year - 1),
                         now.replace(month=12, day=31, year=now.year - 1)),
            'this year': (now.replace(month=1, day=1), now),
            'last quarter': (self._get_last_quarter_start(now),
                            self._get_current_quarter_start(now) - timedelta(days=1)),
            'this quarter': (self._get_current_quarter_start(now), now),
            # Week handling
            'last week': (now - timedelta(days=now.weekday() + 7),
                         now - timedelta(days=now.weekday() + 1)),
            'this week': (now - timedelta(days=now.weekday()),
                         now),
            'yesterday': (now - timedelta(days=1),
                         now - timedelta(days=1)),
            'today': (now, now),
            # For just "last", default to last week
            'last': (now - timedelta(days=now.weekday() + 7),
                    now - timedelta(days=now.weekday() + 1)),
        }

        if period in period_mappings:
            return period_mappings[period]

        # Handle single date (treat as full day)
        try:
            single_date = self._parse_date(period)
            return single_date.replace(hour=0, minute=0, second=0), single_date.replace(hour=23, minute=59, second=59)
        except ValueError:
            pass

        # Handle relative time periods with regex (e.g., "last 3 weeks", "past 6 months")
        relative_pattern = r'^(last|past|previous)\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)$'
        match = re.match(relative_pattern, period)
        if match:
            quantity = int(match.group(2))
            unit = match.group(3).rstrip('s')  # Remove plural 's' if present

            if unit == 'day':
                end_date = now
                start_date = now - timedelta(days=quantity)
            elif unit == 'week':
                # End of current week
                end_date = now
                # Start n weeks ago
                start_date = now - timedelta(weeks=quantity)
            elif unit == 'month':
                end_date = now
                start_date = now - relativedelta(months=quantity)
            elif unit == 'year':
                end_date = now
                start_date = now - relativedelta(years=quantity)
            else:
                raise ValueError(f"Unrecognized time unit: {unit}")

            return start_date, end_date

        # Handle quarters with regex pattern matching (e.g., "Q1 2024", "q3 2024", "Q4-2023")
        quarter_pattern = r'^q([1-4])[\s-]*(\d{4})$'
        match = re.match(quarter_pattern, period)
        if match:
            quarter = int(match.group(1))
            year = int(match.group(2))

            # Validate quarter number
            if not 1 <= quarter <= 4:
                raise ValueError(f"Invalid quarter number: {quarter}. Must be between 1 and 4.")

            start_date = datetime(year, 3 * quarter - 2, 1)
            end_date = start_date + relativedelta(months=3) - timedelta(days=1)
            # Ensure end_date is end of day
            end_date = end_date.replace(hour=23, minute=59, second=59)
            return start_date, end_date

        # Handle specific years (e.g., "2023")
        if period.isdigit() and len(period) == 4:
            year = int(period)

            # Validate year is reasonable (between 2000 and current year + 10)
            current_year = now.year
            if not 2000 <= year <= current_year + 10:
                raise ValueError(f"Year {year} is outside the reasonable range (2000-{current_year+10}).")

            return datetime(year, 1, 1), datetime(year, 12, 31, 23, 59, 59)

        # Handle month-year formats (e.g., "Jan 2024", "January 2024")
        try:
            date_obj = datetime.strptime(period, "%b %Y")
            return (date_obj.replace(day=1),
                   (date_obj.replace(day=1) + relativedelta(months=1) - timedelta(days=1, seconds=1)))
        except ValueError:
            pass

        try:
            date_obj = datetime.strptime(period, "%B %Y")
            return (date_obj.replace(day=1),
                   (date_obj.replace(day=1) + relativedelta(months=1) - timedelta(days=1, seconds=1)))
        except ValueError:
            pass

        # If we reach here, we couldn't parse the period
        raise ValueError(f"Unable to parse time period: '{period}'. Please use formats like '2025-02-06 to 2025-03-08', 'Q1 2024', 'last month', or 'last week'.")

    def _normalize_date_string(self, date_str):
        """Ensure date string is in YYYY-MM-DD format with padded months and days"""
        parts = date_str.split('-')
        if len(parts) == 3:
            year, month, day = parts
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str

    def _get_last_quarter_start(self, current_date):
        current_quarter_start = self._get_current_quarter_start(current_date)
        return current_quarter_start - relativedelta(months=3)

    def _get_current_quarter_start(self, current_date):
        quarter_month = 3 * ((current_date.month - 1) // 3) + 1
        return current_date.replace(month=quarter_month, day=1)

class FinancialReportForm(Action):
    def name(self) -> Text:
        return "financial_report_form"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        logging.info(f"Running financial_report_form with requested_slot: {tracker.get_slot('requested_slot')}")

        requested_slot = tracker.get_slot("requested_slot") or ""

        # Extract slot values
        time_period = tracker.get_slot("time_period") or next(iter(tracker.get_latest_entity_values("time_period")), None)
        first_time_period = tracker.get_slot("first_time_period") or next(iter(tracker.get_latest_entity_values("first_time_period")), None)
        second_time_period = tracker.get_slot("second_time_period") or next(iter(tracker.get_latest_entity_values("second_time_period")), None)

        logging.info(f"Extracted: time_period={time_period}, first_time_period={first_time_period}, second_time_period={second_time_period}")

        events = []
        if time_period:
            events.append(SlotSet("time_period", time_period))
        if first_time_period:
            events.append(SlotSet("first_time_period", first_time_period))
        if second_time_period:
            events.append(SlotSet("second_time_period", second_time_period))

        # Determine next step
        if not time_period and not (first_time_period and second_time_period):
            dispatcher.utter_message(text="I'll help you generate a financial report. What time period would you like to analyze?")
            return events + [SlotSet("requested_slot", "time_period")]

        if (first_time_period and not second_time_period) or (not first_time_period and second_time_period):
            missing_period = "first" if not first_time_period else "second"
            dispatcher.utter_message(text=f"Please specify the {missing_period} time period for comparison.")
            return events + [SlotSet("requested_slot", f"{missing_period}_time_period")]

        dispatcher.utter_message(text="Would you like a summary or detailed report?")
        return events + [SlotSet("requested_slot", "report_detail_level")]

class ActionResetForm(Action):
    def name(self) -> Text:
        return "action_reset_form"

    def run(self, dispatcher: CollectingDispatcher, tracker: Tracker, domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        logging.info("Resetting form state")
        return [
            ActiveLoop(None),
            SlotSet("requested_slot", None),
            SlotSet("time_period", None),
            SlotSet("first_time_period", None),
            SlotSet("second_time_period", None),
            SlotSet("report_detail_level", None),
        ]

class ActionGenerateFinancialReport(Action):
    def name(self) -> Text:
        return "action_generate_financial_report"

    def _determine_report_type(self, user_message: str, detail_level: str) -> str:
        """
        Determine the type of report to generate based on user message and detail level.
        
        Args:
            user_message: The user's original message
            detail_level: The requested detail level (summary, detailed, etc.)
            
        Returns:
            str: The type of report to generate (revenue_only, financial_metrics, etc.)
        """
        logging.info(f"[DEBUG] Entering _determine_report_type with user_message: '{user_message}', detail_level: '{detail_level}'")
        user_message = user_message.lower()
        
        # Check for revenue-specific request
        if any(term in user_message for term in ["revenue", "income", "earnings", "sales"]):
            if not any(term in user_message for term in ["expense", "profit", "performance", "financial", "metrics"]):
                logging.info("[DEBUG] Report type determined: revenue_only")
                return "revenue_only"
        
        # Check for performance metrics request
        if any(term in user_message for term in ["metrics", "performance", "kpi"]):
            logging.info("[DEBUG] Report type determined: financial_metrics")
            return "financial_metrics"
        
        # Check for detail level in the request itself (overrides the slot)
        if any(term in user_message for term in ["detailed", "comprehensive", "complete", "full", "in-depth"]):
            logging.info("[DEBUG] Report type determined: comprehensive")
            return "comprehensive"
        elif "summary" in user_message or "overview" in user_message:
            logging.info("[DEBUG] Report type determined: summary")
            return "summary"
        
        # If detail level is set and detailed, provide comprehensive report
        if detail_level and detail_level.lower() in ["yes", "detailed", "comprehensive"]:
            logging.info("[DEBUG] Report type determined: detailed")
            return "detailed"
        
        # Default to summary for general requests
        logging.info("[DEBUG] Report type defaulting to: summary")
        return "summary"
    
    async def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        logging.info("[DEBUG] Starting ActionGenerateFinancialReport.run")
        
        try:
            time_period = tracker.get_slot("time_period")
            detail_level = tracker.get_slot("report_detail_level") or "summary"
            
            logging.info(f"[DEBUG] Retrieved slots - time_period: '{time_period}', detail_level: '{detail_level}'")
            
            # Get the user's original message to determine what they're specifically asking for
            user_message = tracker.latest_message.get('text', '')
            logging.info(f"[DEBUG] User's latest message: '{user_message}'")
            
            if not time_period:
                logging.warning("[DEBUG] No time_period slot found, requesting time period from user")
                dispatcher.utter_message(text="Please specify a time period for the financial report.")
                return []
            
            # First, check if the time period is in the expected format (YYYY-MM-DD|YYYY-MM-DD)
            logging.info(f"[DEBUG] Parsing time period: '{time_period}'")
            try:
                if '|' in time_period:
                    # Already parsed format
                    start_date_str, end_date_str = time_period.split('|')
                    start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                    end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                    logging.info(f"[DEBUG] Using parsed time period: {start_date.date()} to {end_date.date()}")
                else:
                    # Need to parse the time period string directly
                    # Import the ActionParsePeriod class to reuse its parsing logic
                    logging.info("[DEBUG] Importing ActionParsePeriod for time period parsing")
                    try:
                        from actions.actions import ActionParsePeriod
                        logging.info(f"[DEBUG] Successfully imported ActionParsePeriod")
                    except ImportError as e:
                        logging.error(f"[DEBUG] Failed to import ActionParsePeriod: {str(e)}")
                        raise
                    
                    logging.info(f"[DEBUG] Parsing raw time period: {time_period}")
                    action_parser = ActionParsePeriod()
                    logging.info("[DEBUG] Created ActionParsePeriod instance")
                    start_date, end_date = action_parser._parse_time_period(time_period)
                    logging.info(f"[DEBUG] Successfully parsed time period: {start_date.date()} to {end_date.date()}")
            except Exception as e:
                logging.error(f"[DEBUG] Failed to parse time period '{time_period}': {str(e)}", exc_info=True)
                dispatcher.utter_message(text=f"Sorry, I couldn't understand the time period '{time_period}'. Please try a different format.")
                return []
            
            # Define synchronous functions for database operations
            logging.info("[DEBUG] Setting up database query functions")
            
            # Inspect the database connection to make sure it's available
            try:
                from django.db import connection
                logging.info(f"[DEBUG] Database connection info - name: {connection.settings_dict['NAME']}")
                logging.info(f"[DEBUG] Database vendor: {connection.vendor}")
                logging.info(f"[DEBUG] Database is connected: {connection.is_usable()}")
            except Exception as e:
                logging.error(f"[DEBUG] Failed to inspect database connection: {str(e)}", exc_info=True)
            
            @sync_to_async
            def get_total_revenue():
                logging.info("[DEBUG] Executing get_total_revenue query")
                try:
                    result = TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='income'
                    ).aggregate(total=Sum('amount'))['total'] or 0
                    logging.info(f"[DEBUG] get_total_revenue result: {result}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_total_revenue: {str(e)}", exc_info=True)
                    raise
            
            @sync_to_async
            def get_total_expenses():
                logging.info("[DEBUG] Executing get_total_expenses query")
                try:
                    result = TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='expense'
                    ).aggregate(total=Sum('amount'))['total'] or 0
                    logging.info(f"[DEBUG] get_total_expenses result: {result}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_total_expenses: {str(e)}", exc_info=True)
                    raise
            
            @sync_to_async
            def get_revenue_by_category():
                logging.info("[DEBUG] Executing get_revenue_by_category query")
                try:
                    result = list(TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='income'
                    ).values('category').annotate(
                        total=Sum('amount')
                    ).order_by('-total'))
                    logging.info(f"[DEBUG] get_revenue_by_category result count: {len(result)}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_revenue_by_category: {str(e)}", exc_info=True)
                    raise
            
            @sync_to_async
            def get_expenses_by_category():
                logging.info("[DEBUG] Executing get_expenses_by_category query")
                try:
                    result = list(TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='expense'
                    ).values('category').annotate(
                        total=Sum('amount')
                    ).order_by('-total'))
                    logging.info(f"[DEBUG] get_expenses_by_category result count: {len(result)}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_expenses_by_category: {str(e)}", exc_info=True)
                    raise
            
            @sync_to_async
            def get_monthly_revenue_trend():
                logging.info("[DEBUG] Executing get_monthly_revenue_trend query")
                try:
                    result = list(TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='income'
                    ).annotate(
                        month=TruncMonth('date')
                    ).values('month').annotate(
                        total=Sum('amount')
                    ).order_by('month'))
                    logging.info(f"[DEBUG] get_monthly_revenue_trend result count: {len(result)}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_monthly_revenue_trend: {str(e)}", exc_info=True)
                    raise
            
            @sync_to_async
            def get_monthly_expense_trend():
                logging.info("[DEBUG] Executing get_monthly_expense_trend query")
                try:
                    result = list(TransactionsTransaction.objects.filter(
                        date__range=[start_date, end_date],
                        transaction_type='expense'
                    ).annotate(
                        month=TruncMonth('date')
                    ).values('month').annotate(
                        total=Sum('amount')
                    ).order_by('month'))
                    logging.info(f"[DEBUG] get_monthly_expense_trend result count: {len(result)}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_monthly_expense_trend: {str(e)}", exc_info=True)
                    raise

            @sync_to_async
            def get_previous_period_data():
                logging.info("[DEBUG] Executing get_previous_period_data")
                try:
                    # Calculate the same duration for the previous period
                    period_duration = (end_date - start_date).days
                    prev_end_date = start_date - timedelta(days=1)
                    prev_start_date = prev_end_date - timedelta(days=period_duration)
                    
                    logging.info(f"[DEBUG] Previous period: {prev_start_date.date()} to {prev_end_date.date()}")
                    
                    prev_revenue = TransactionsTransaction.objects.filter(
                        date__range=[prev_start_date, prev_end_date],
                        transaction_type='income'
                    ).aggregate(total=Sum('amount'))['total'] or 0
                    
                    prev_expenses = TransactionsTransaction.objects.filter(
                        date__range=[prev_start_date, prev_end_date],
                        transaction_type='expense'
                    ).aggregate(total=Sum('amount'))['total'] or 0
                    
                    result = {
                        'revenue': prev_revenue,
                        'expenses': prev_expenses,
                        'profit': prev_revenue - prev_expenses
                    }
                    logging.info(f"[DEBUG] get_previous_period_data result: {result}")
                    return result
                except Exception as e:
                    logging.error(f"[DEBUG] Error in get_previous_period_data: {str(e)}", exc_info=True)
                    raise
            
            # Determine report type
            report_type = self._determine_report_type(user_message, detail_level)
            logging.info(f"[DEBUG] Determined report_type: {report_type}")
            
            # Execute basic queries that are common to most reports
            logging.info("[DEBUG] Starting database queries")
            try:
                logging.info("[DEBUG] Fetching total_revenue")
                total_revenue = await get_total_revenue()
                logging.info(f"[DEBUG] Total revenue fetched: {total_revenue}")
                
                logging.info("[DEBUG] Fetching total_expenses")
                total_expenses = await get_total_expenses()
                logging.info(f"[DEBUG] Total expenses fetched: {total_expenses}")
                
                # Convert to float to ensure consistent type handling
                total_revenue = float(total_revenue)
                total_expenses = float(total_expenses)
                
                profit = total_revenue - total_expenses
                logging.info(f"[DEBUG] Calculated profit: {profit}")
                
                # Safe division - handle zero revenue
                profit_margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
                logging.info(f"[DEBUG] Calculated profit_margin: {profit_margin}")
            except Exception as e:
                logging.error(f"[DEBUG] Failed during basic query execution: {str(e)}", exc_info=True)
                dispatcher.utter_message(text="Sorry, I encountered an issue while retrieving your financial data. Please try again.")
                return []
            
            # Initialize report variable
            report = ""
            
            logging.info(f"[DEBUG] Building report for type: {report_type}")
            
            # Generate the appropriate report based on the determined type
            try:
                if report_type == "revenue_only":
                    logging.info("[DEBUG] Generating revenue_only report")
                    report = f"""
# Revenue Report
**Period: {start_date.date()} to {end_date.date()}**

Total Revenue: N{total_revenue:,.2f}
"""
                    # Add revenue by category if detailed
                    if detail_level.lower() in ['yes', 'detailed']:
                        logging.info("[DEBUG] Adding revenue by category to report")
                        revenue_by_category = await get_revenue_by_category()
                        report += "\n## Revenue by Category:\n"
                        for cat in revenue_by_category[:5]:
                            cat_total = float(cat['total'])
                            cat_percentage = (cat_total / total_revenue * 100) if total_revenue > 0 else 0
                            category_name = cat['category'] or 'Uncategorized'
                            report += f"- {category_name}: N{cat_total:,.2f} ({cat_percentage:.1f}% of total)\n"
                
                    # Add monthly trend if detailed
                    if detail_level.lower() in ['yes', 'detailed']:
                        logging.info("[DEBUG] Adding monthly revenue trend to report")
                        monthly_revenue = await get_monthly_revenue_trend()
                        if monthly_revenue:
                            report += "\n## Monthly Revenue Trend:\n"
                            for month_data in monthly_revenue:
                                month_name = month_data['month'].strftime('%b %Y')
                                monthly_amount = float(month_data['total'])
                                report += f"- {month_name}: N{monthly_amount:,.2f}\n"
            
                elif report_type == "financial_metrics" or report_type == "financial_performance":
                    logging.info("[DEBUG] Generating financial_metrics report")
                    # Get previous period data for comparison
                    logging.info("[DEBUG] Fetching previous period data")
                    try:
                        previous_period = await get_previous_period_data()
                        logging.info(f"[DEBUG] Previous period data fetched: {previous_period}")
                        
                        # Convert to float for safe division
                        prev_revenue = float(previous_period['revenue'])
                        prev_expenses = float(previous_period['expenses'])
                        prev_profit = float(previous_period['profit'])
                        
                        # Calculate changes with safe division
                        revenue_change_pct = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
                        expense_change_pct = ((total_expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
                        profit_change_pct = ((profit - prev_profit) / prev_profit * 100) if prev_profit != 0 else 0
                        
                        logging.info(f"[DEBUG] Calculated metrics - revenue_change_pct: {revenue_change_pct}, expense_change_pct: {expense_change_pct}, profit_change_pct: {profit_change_pct}")
                    except Exception as e:
                        logging.error(f"[DEBUG] Error calculating comparison metrics: {str(e)}", exc_info=True)
                        # Continue with report generation even if comparison fails
                        revenue_change_pct = 0
                        expense_change_pct = 0
                        profit_change_pct = 0
                    
                    report = f"""
# Financial Performance Metrics
**Period: {start_date.date()} to {end_date.date()}**

## Key Metrics
- Revenue: N{total_revenue:,.2f} ({revenue_change_pct:+.1f}% from previous period)
- Expenses: N{total_expenses:,.2f} ({expense_change_pct:+.1f}% from previous period)
- Net Profit: N{profit:,.2f} ({profit_change_pct:+.1f}% from previous period)
- Profit Margin: {profit_margin:.2f}%
"""
                    # Add revenue to expense ratio if detailed
                    if detail_level.lower() in ['yes', 'detailed']:
                        logging.info("[DEBUG] Adding additional detailed metrics")
                        # Add revenue/expense ratio with safe division
                        if total_expenses > 0:
                            revenue_expense_ratio = f"{(total_revenue/total_expenses):.2f}"
                        else:
                            revenue_expense_ratio = "N/A"
                        report += f"- Revenue to Expense Ratio: {revenue_expense_ratio}\n"
                        
                        # Add top revenue and expense categories for detailed metrics
                        logging.info("[DEBUG] Fetching revenue and expense categories")
                        try:
                            revenue_by_category = await get_revenue_by_category()
                            expenses_by_category = await get_expenses_by_category()
                            
                            if revenue_by_category:
                                top_revenue_cat = revenue_by_category[0]['category'] or 'Uncategorized'
                                top_revenue_amount = float(revenue_by_category[0]['total'])
                                report += f"\n## Top Revenue Source\n- {top_revenue_cat}: N{top_revenue_amount:,.2f}\n"
                            
                            if expenses_by_category:
                                top_expense_cat = expenses_by_category[0]['category'] or 'Uncategorized'
                                top_expense_amount = float(expenses_by_category[0]['total'])
                                report += f"\n## Top Expense Category\n- {top_expense_cat}: N{top_expense_amount:,.2f}\n"
                        except Exception as e:
                            logging.error(f"[DEBUG] Error fetching category data: {str(e)}", exc_info=True)
                            # Continue with report generation without category data
                
                elif report_type == "summary":
                    logging.info("[DEBUG] Generating summary report")
                    report = f"""
# Financial Report Summary
**Period: {start_date.date()} to {end_date.date()}**

## Summary Metrics
- Total Revenue: N{total_revenue:,.2f}
- Total Expenses: N{total_expenses:,.2f}
- Net Profit: N{profit:,.2f}
- Profit Margin: {profit_margin:.2f}%
"""
                    # Add basic comparison to previous period
                    logging.info("[DEBUG] Adding previous period comparison to summary")
                    try:
                        previous_period = await get_previous_period_data()
                        prev_profit = float(previous_period['profit'])
                        
                        # Calculate profit change with safe division
                        profit_change_pct = ((profit - prev_profit) / prev_profit * 100) if prev_profit != 0 else 0
                        
                        report += f"\nCompared to the previous period, profit has {'increased' if profit_change_pct >= 0 else 'decreased'} by {abs(profit_change_pct):.1f}%.\n"
                    except Exception as e:
                        logging.error(f"[DEBUG] Error adding previous period comparison: {str(e)}", exc_info=True)
                        # Continue with report generation without comparison
                
                elif report_type == "detailed" or report_type == "comprehensive":
                    logging.info("[DEBUG] Generating detailed/comprehensive report")
                    try:
                        # More granular breakdown
                        logging.info("[DEBUG] Fetching detailed data for comprehensive report")
                        revenue_by_category = await get_revenue_by_category()
                        expenses_by_category = await get_expenses_by_category()
                        previous_period = await get_previous_period_data()
                        monthly_revenue = await get_monthly_revenue_trend()
                        
                        logging.info(f"[DEBUG] Data fetched - revenue categories: {len(revenue_by_category)}, expense categories: {len(expenses_by_category)}, monthly data points: {len(monthly_revenue)}")
                        
                        # Convert to float for safe division
                        prev_revenue = float(previous_period['revenue'])
                        prev_expenses = float(previous_period['expenses'])
                        prev_profit = float(previous_period['profit'])
                        
                        # Calculate YoY or period-over-period changes with safe division
                        revenue_change_pct = ((total_revenue - prev_revenue) / prev_revenue * 100) if prev_revenue > 0 else 0
                        expense_change_pct = ((total_expenses - prev_expenses) / prev_expenses * 100) if prev_expenses > 0 else 0
                        profit_change_pct = ((profit - prev_profit) / prev_profit * 100) if prev_profit != 0 else 0
                        
                        # Calculate revenue expense ratio
                        revenue_expense_ratio = f"{(total_revenue/total_expenses):.2f}" if total_expenses > 0 else "N/A"
                        
                        # Calculate average monthly revenue
                        logging.info("[DEBUG] Calculating average monthly revenue")
                        if monthly_revenue:
                            monthly_amounts = [float(month_data['total']) for month_data in monthly_revenue]
                            avg_monthly_revenue = f"N{sum(monthly_amounts) / len(monthly_amounts):,.2f}" if monthly_amounts else "N0.00"
                        else:
                            avg_monthly_revenue = "N0.00"
                        
                        # Generate recommendations based on data
                        logging.info("[DEBUG] Generating recommendations")
                        if revenue_change_pct < 0:
                            revenue_recommendation = "Focus on strategies to increase revenue, which has decreased compared to the previous period."
                        else:
                            revenue_recommendation = "Continue to build on successful revenue generation strategies that have shown positive growth."
                        if expense_change_pct > 0 and expense_change_pct > revenue_change_pct:
                            expense_recommendation = "Review expense growth which is outpacing revenue growth and identify cost-cutting opportunities."
                        else:
                            expense_recommendation = "Maintain current expense management practices which appear to be effective."
                        
                        if profit_margin < 20:
                            profit_recommendation = "Implement measures to improve profit margin which is currently below target levels."
                        else:
                            profit_recommendation = "Continue current profit optimization strategies which are producing favorable results."
                        
                        report = f"""
# Detailed Financial Report
**Period: {start_date.date()} to {end_date.date()}**

## Executive Summary
Financial performance for this period shows a net profit of N{profit:,.2f}, resulting in a profit margin of {profit_margin:.2f}%.
Compared to the previous period, profit has {"increased" if profit_change_pct >= 0 else "decreased"} by {abs(profit_change_pct):.1f}%.

## Revenue Analysis
Total Revenue: N{total_revenue:,.2f} ({revenue_change_pct:+.1f}% from previous period)
"""
                        
                        # Add revenue by category
                        logging.info("[DEBUG] Adding revenue categories to report")
                        if revenue_by_category:
                            report += "### Revenue by Category:\n"
                            for cat in revenue_by_category[:5]:
                                cat_total = float(cat['total'])
                                cat_percentage = (cat_total / total_revenue * 100) if total_revenue > 0 else 0
                                category_name = cat['category'] or 'Uncategorized'
                                report += f"- {category_name}: N{cat_total:,.2f} ({cat_percentage:.1f}% of total)\n"
                        
                        report += f"""
## Expense Analysis
Total Expenses: N{total_expenses:,.2f} ({expense_change_pct:+.1f}% from previous period)
"""
                        logging.info("[DEBUG] Adding expense categories to report")
                        if expenses_by_category:
                            report += "### Expense by Category:\n"
                            for cat in expenses_by_category[:5]:
                                cat_total = float(cat['total'])
                                cat_percentage = (cat_total / total_expenses * 100) if total_expenses > 0 else 0
                                category_name = cat['category'] or 'Uncategorized'
                                report += f"- {category_name}: N{cat_total:,.2f} ({cat_percentage:.1f}% of total)\n"
                        
                        report += f"""
## Profitability
- Net Profit: N{profit:,.2f}
- Profit Margin: {profit_margin:.2f}%
- Change from Previous Period: {profit_change_pct:+.1f}%

## Key Performance Indicators
- Revenue to Expense Ratio: {revenue_expense_ratio}
- Average Monthly Revenue: {avg_monthly_revenue}

## Outlook and Recommendations
Based on the financial performance analysis, the following recommendations are made:
1. {revenue_recommendation}
2. {expense_recommendation}
3. {profit_recommendation}
"""
                    except Exception as e:
                        logging.error(f"[DEBUG] Error generating detailed report: {str(e)}", exc_info=True)
                        # Fall back to a simpler report format
                        report = f"""
# Financial Report
**Period: {start_date.date()} to {end_date.date()}**

## Key Figures
- Total Revenue: N{total_revenue:,.2f}
- Total Expenses: N{total_expenses:,.2f}
- Net Profit: N{profit:,.2f}
- Profit Margin: {profit_margin:.2f}%

Note: Some detailed information could not be retrieved.
"""
                
                else:
                    # Default fallback report if no specific type is determined
                    logging.info("[DEBUG] Generating default fallback report")
                    report = f"""
# Financial Report
**Period: {start_date.date()} to {end_date.date()}**

## Key Figures
- Total Revenue: N{total_revenue:,.2f}
- Total Expenses: N{total_expenses:,.2f}
- Net Profit: N{profit:,.2f}
- Profit Margin: {profit_margin:.2f}%
"""
                
                # Send the report to the user
                logging.info("[DEBUG] Sending report to user")
                logging.debug(f"[DEBUG] Report content: {report}")
                dispatcher.utter_message(text=report)
                logging.info("[DEBUG] Report sent successfully")
                
            except Exception as e:
                logging.error(f"[DEBUG] Error during report generation: {str(e)}", exc_info=True)
                dispatcher.utter_message(text="Sorry, I encountered an issue while generating your financial report. Please try again.")
        
        except Exception as e:
            logging.error(f"[DEBUG] Financial report generation error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text="Unable to generate financial report. Please try again.")
        
        logging.info("[DEBUG] Completed ActionGenerateFinancialReport.run")
        return []

class ActionSalesAnalytics(Action):
    def name(self) -> Text:
        return "action_sales_analytics"

    async def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        time_period = tracker.get_slot("time_period")
        analysis_type = tracker.get_slot("analysis_type") or "general"

        if not time_period:
            dispatcher.utter_message(text="Please specify a time period for the sales analytics.")
            return []

        try:
            # Parse the time period - reuse the same logic from financial report
            if '|' in time_period:
                # Already parsed format
                start_date_str, end_date_str = time_period.split('|')
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                logging.info(f"Using parsed time period: {start_date.date()} to {end_date.date()}")
            else:
                # Need to parse the time period string directly
                from actions.actions import ActionParsePeriod

                logging.info(f"Parsing raw time period: {time_period}")
                action_parser = ActionParsePeriod()
                start_date, end_date = action_parser._parse_time_period(time_period)
                logging.info(f"Successfully parsed time period: {start_date.date()} to {end_date.date()}")

            # Define synchronous functions for database operations
            @sync_to_async
            def get_total_sales():
                return TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).aggregate(total=Sum('amount'))['total'] or 0

            @sync_to_async
            def get_sales_count():
                return TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).count()

            @sync_to_async
            def get_sales_by_category():
                return list(TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).values('category').annotate(
                    total=Sum('amount'),
                    count=Count('id')
                ).order_by('-total'))

            @sync_to_async
            def get_monthly_sales_trend():
                return list(TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).annotate(
                    month=TruncMonth('date')
                ).values('month').annotate(
                    total=Sum('amount'),
                    count=Count('id')
                ).order_by('month'))

            @sync_to_async
            def get_daily_sales_trend():
                return list(TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).annotate(
                    day=TruncDay('date')
                ).values('day').annotate(
                    total=Sum('amount'),
                    count=Count('id')
                ).order_by('day'))

            @sync_to_async
            def get_previous_period_data():
                # Calculate the same duration for the previous period
                period_duration = (end_date - start_date).days
                prev_end_date = start_date - timedelta(days=1)
                prev_start_date = prev_end_date - timedelta(days=period_duration)

                prev_sales = TransactionsTransaction.objects.filter(
                    date__range=[prev_start_date, prev_end_date],
                    transaction_type='income'
                ).aggregate(
                    total=Sum('amount'),
                    count=Count('id')
                )

                return {
                    'total': prev_sales['total'] or 0,
                    'count': prev_sales['count'] or 0,
                    'period': f"{prev_start_date.date()} to {prev_end_date.date()}"
                }

            @sync_to_async
            def get_top_customers():
                # Join with CoreCustomer model to get customer information
                # Assuming you have a customer_id field in TransactionsTransaction that links to CoreCustomer
                return list(TransactionsTransaction.objects.filter(
                    date__range=[start_date, end_date],
                    transaction_type='income'
                ).values('customer_id').annotate(
                    total=Sum('amount'),
                    count=Count('id')
                ).order_by('-total')[:5])

            @sync_to_async
            def get_customer_details(customer_ids):
                # Get customer names from CoreCustomer model
                return {
                    customer.id: f"{customer.first_name} {customer.last_name}"
                    for customer in CoreCustomer.objects.filter(id__in=customer_ids)
                }

            # Execute database queries asynchronously
            total_sales = await get_total_sales()
            sales_count = await get_sales_count()
            
            # Convert to float to ensure consistent type handling
            total_sales = float(total_sales)
            
            # Calculate average sale value with safe division
            avg_sale_value = total_sales / sales_count if sales_count > 0 else 0

            # Generate report based on analysis type
            if analysis_type.lower() in ['general', 'overview']:
                # Basic sales overview
                previous_period = await get_previous_period_data()
                prev_total = float(previous_period['total'])
                prev_count = previous_period['count']
                
                # Calculate changes with safe division
                sales_change_pct = ((total_sales - prev_total) / prev_total * 100) if prev_total > 0 else 0
                count_change_pct = ((sales_count - prev_count) / prev_count * 100) if prev_count > 0 else 0
                
                report = f"""
# Sales Analytics Overview
**Period: {start_date.date()} to {end_date.date()}**

## Summary Metrics
- Total Sales: N{total_sales:,.2f} ({sales_change_pct:+.1f}% from previous period)
- Number of Transactions: {sales_count} ({count_change_pct:+.1f}% from previous period)
- Average Sale Value: N{avg_sale_value:,.2f}

## Comparison with Previous Period ({previous_period['period']})
- Previous Period Sales: N{prev_total:,.2f}
- Previous Period Transactions: {prev_count}
                """
                
            elif analysis_type.lower() in ['category', 'categories']:
                # Sales breakdown by category
                sales_by_category = await get_sales_by_category()
                
                report = f"""
# Sales by Category
**Period: {start_date.date()} to {end_date.date()}**

## Overall
- Total Sales: N{total_sales:,.2f}
- Number of Transactions: {sales_count}
- Average Sale Value: N{avg_sale_value:,.2f}

## Category Breakdown:
"""
                # Safe handling for categories
                for cat in sales_by_category:
                    cat_total = float(cat['total'])
                    cat_count = cat['count']
                    cat_percentage = (cat_total / total_sales * 100) if total_sales > 0 else 0
                    cat_avg = cat_total / cat_count if cat_count > 0 else 0
                    category_name = cat['category'] or 'Uncategorized'
                    report += f"- {category_name}: N{cat_total:,.2f} ({cat_percentage:.1f}% of total), {cat_count} transactions, avg N{cat_avg:,.2f}\n"
                
            elif analysis_type.lower() in ['trend', 'trends']:
                # Temporal trends analysis
                monthly_trend = await get_monthly_sales_trend()
                daily_trend = await get_daily_sales_trend()
                
                # Calculate growth metrics
                if len(monthly_trend) >= 2:
                    first_month = float(monthly_trend[0]['total'])
                    last_month = float(monthly_trend[-1]['total'])
                    month_growth = ((last_month - first_month) / first_month * 100) if first_month > 0 else 0
                    month_growth_text = f"Monthly Growth Rate: {month_growth:+.1f}%"
                else:
                    month_growth_text = "Monthly Growth Rate: Not enough data"
                
                report = f"""
# Sales Trend Analysis
**Period: {start_date.date()} to {end_date.date()}**

## Overall
- Total Sales: N{total_sales:,.2f}
- Number of Transactions: {sales_count}
- {month_growth_text}

## Monthly Sales Trend:
"""
                # Format monthly trend data
                for month_data in monthly_trend:
                    month_name = month_data['month'].strftime('%b %Y')
                    monthly_amount = float(month_data['total'])
                    monthly_count = month_data['count']
                    report += f"- {month_name}: N{monthly_amount:,.2f} ({monthly_count} transactions)\n"
                
                report += "\n## Daily Sales Sample (last 10 days):\n"
                
                # Show only the last 10 days to keep the report manageable
                for day_data in daily_trend[-10:]:
                    day_name = day_data['day'].strftime('%Y-%m-%d')
                    daily_amount = float(day_data['total'])
                    daily_count = day_data['count']
                    report += f"- {day_name}: N{daily_amount:,.2f} ({daily_count} transactions)\n"
                
            elif analysis_type.lower() in ['customer', 'customers']:
                # Customer-focused analysis
                top_customers_data = await get_top_customers()
                
                # Get customer IDs for lookup
                customer_ids = [c['customer_id'] for c in top_customers_data if c['customer_id'] is not None]
                
                # Get customer details if we have IDs
                customer_details = await get_customer_details(customer_ids) if customer_ids else {}
                
                report = f"""
# Customer Sales Analysis
**Period: {start_date.date()} to {end_date.date()}**

## Overall
- Total Sales: N{total_sales:,.2f}
- Number of Transactions: {sales_count}
- Average Sale Value: N{avg_sale_value:,.2f}

## Top Customers:
"""
                # Check if we have customer data
                if top_customers_data:
                    for i, customer in enumerate(top_customers_data, 1):
                        customer_id = customer['customer_id']
                        customer_name = customer_details.get(customer_id, f"Customer ID: {customer_id}") if customer_id else 'Unnamed Customer'
                        customer_total = float(customer['total'])
                        customer_count = customer['count']
                        customer_avg = customer_total / customer_count if customer_count > 0 else 0
                        customer_percentage = (customer_total / total_sales * 100) if total_sales > 0 else 0
                        
                        report += f"{i}. {customer_name}: N{customer_total:,.2f} ({customer_percentage:.1f}% of total), {customer_count} transactions, avg N{customer_avg:,.2f}\n"
                else:
                    report += "No customer data available for this period.\n"
                
            else:  # comprehensive
                # Full comprehensive report
                sales_by_category = await get_sales_by_category()
                monthly_trend = await get_monthly_sales_trend()
                previous_period = await get_previous_period_data()
                top_customers_data = await get_top_customers()
                
                # Get customer IDs for lookup
                customer_ids = [c['customer_id'] for c in top_customers_data if c['customer_id'] is not None]
                
                # Get customer details if we have IDs
                customer_details = await get_customer_details(customer_ids) if customer_ids else {}
                
                # Calculate metrics
                prev_total = float(previous_period['total'])
                prev_count = previous_period['count']
                
                sales_change_pct = ((total_sales - prev_total) / prev_total * 100) if prev_total > 0 else 0
                count_change_pct = ((sales_count - prev_count) / prev_count * 100) if prev_count > 0 else 0
                
                # Get top performing category
                top_category = sales_by_category[0]['category'] if sales_by_category else None
                top_category_amount = float(sales_by_category[0]['total']) if sales_by_category else 0
                
                # Safe handling for None categories
                if top_category is None:
                    top_category = "Uncategorized"
                
                # Calculate monthly growth if possible
                if len(monthly_trend) >= 2:
                    first_month = float(monthly_trend[0]['total'])
                    last_month = float(monthly_trend[-1]['total'])
                    month_growth = ((last_month - first_month) / first_month * 100) if first_month > 0 else 0
                    month_growth_text = f"Monthly Growth Rate: {month_growth:+.1f}%"
                else:
                    month_growth_text = "Monthly Growth Rate: Not enough data for calculation"
                
                report = f"""
# Comprehensive Sales Analytics Report
**Period: {start_date.date()} to {end_date.date()}**

## Executive Summary
This report presents the sales performance for the period from {start_date.date()} to {end_date.date()}. Overall, the company generated N{total_sales:,.2f} in sales across {sales_count} transactions with an average sale value of N{avg_sale_value:,.2f}.

Compared to the previous period ({previous_period['period']}), sales have {"increased" if sales_change_pct >= 0 else "decreased"} by {abs(sales_change_pct):.1f}%, while transaction volume has {"increased" if count_change_pct >= 0 else "decreased"} by {abs(count_change_pct):.1f}%.

## Sales Performance Overview
- Total Sales: N{total_sales:,.2f} ({sales_change_pct:+.1f}% from previous period)
- Number of Transactions: {sales_count} ({count_change_pct:+.1f}% from previous period)
- Average Sale Value: N{avg_sale_value:,.2f}
- Top Sales Category: {top_category} (N{top_category_amount:,.2f})
- {month_growth_text}

## Sales by Category:
"""
                # Category breakdown
                for cat in sales_by_category[:5]:
                    cat_total = float(cat['total'])
                    cat_count = cat['count']
                    cat_percentage = (cat_total / total_sales * 100) if total_sales > 0 else 0
                    cat_avg = cat_total / cat_count if cat_count > 0 else 0
                    category_name = cat['category'] or 'Uncategorized'
                    report += f"- {category_name}: N{cat_total:,.2f} ({cat_percentage:.1f}% of total), {cat_count} transactions, avg N{cat_avg:,.2f}\n"
                
                report += f"""
## Monthly Sales Trend:
"""
                # Format monthly trend data
                for month_data in monthly_trend:
                    month_name = month_data['month'].strftime('%b %Y')
                    monthly_amount = float(month_data['total'])
                    monthly_count = month_data['count']
                    report += f"- {month_name}: N{monthly_amount:,.2f} ({monthly_count} transactions)\n"
                
                # Only include customer section if we have data
                if top_customers_data:
                    report += f"""
## Top Customers:
"""
                    for i, customer in enumerate(top_customers_data, 1):
                        customer_id = customer['customer_id']
                        customer_name = customer_details.get(customer_id, f"Customer ID: {customer_id}") if customer_id else 'Unnamed Customer'
                        customer_total = float(customer['total'])
                        customer_count = customer['count']
                        customer_avg = customer_total / customer_count if customer_count > 0 else 0
                        customer_percentage = (customer_total / total_sales * 100) if total_sales > 0 else 0
                        
                        report += f"{i}. {customer_name}: N{customer_total:,.2f} ({customer_percentage:.1f}% of total), {customer_count} transactions, avg N{customer_avg:,.2f}\n"
                
                # Create recommendations
                sales_recommendation = "Capitalize on growth in top-performing categories." if sales_change_pct > 0 else "Develop strategies to reverse the sales decline."
                volume_recommendation = "Maintain the positive transaction volume trend." if count_change_pct > 0 else "Implement marketing initiatives to increase transaction volume."
                category_recommendation = f"Focus on promoting {top_category} which represents the largest sales category." if sales_by_category else "Develop clearer product categorization to better track sales performance."
                
                report += f"""
## Recommendations
Based on the sales performance analysis, the following recommendations are made:
1. {sales_recommendation}
2. {volume_recommendation}
3. {category_recommendation}
"""

            dispatcher.utter_message(text=report)

        except Exception as e:
            logging.error(f"Sales analytics generation error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text="Unable to generate sales analytics. Please try again.")

        return []

class ActionSalesForecasting(Action):
    def name(self) -> Text:
        return "action_sales_forecast"

    async def run(self, dispatcher: CollectingDispatcher,
                  tracker: Tracker,
                  domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        time_period = tracker.get_slot("time_period")
        product_name = tracker.get_slot("product_name")
        
        if not time_period:
            dispatcher.utter_message(text="Please specify a time period for the sales forecast.")
            return []
        
        try:
            # Parse the time period - reuse the same logic from financial report
            if '|' in time_period:
                # Already parsed format
                start_date_str, end_date_str = time_period.split('|')
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                logging.info(f"Using parsed time period for forecast: {start_date.date()} to {end_date.date()}")
            else:
                # Need to parse the time period string directly
                from actions.actions import ActionParsePeriod
                
                logging.info(f"Parsing raw time period for forecast: {time_period}")
                action_parser = ActionParsePeriod()
                start_date, end_date = action_parser._parse_time_period(time_period)
                logging.info(f"Successfully parsed time period for forecast: {start_date.date()} to {end_date.date()}")
            
            # Define synchronous functions for database operations
            @sync_to_async
            def get_historical_sales(lookback_months=6):
                # Calculate the start date for historical data
                historical_start = start_date - timedelta(days=30 * lookback_months)
                
                # Get historical sales data
                if product_name:
                    # For specific product
                    return list(TransactionsTransaction.objects.filter(
                        date__range=[historical_start, start_date - timedelta(days=1)],
                        transaction_type='income',
                        category__icontains=product_name
                    ).annotate(
                        month=TruncMonth('date')
                    ).values('month').annotate(
                        total=Sum('amount'),
                        count=Count('id')
                    ).order_by('month'))
                else:
                    # For all products
                    return list(TransactionsTransaction.objects.filter(
                        date__range=[historical_start, start_date - timedelta(days=1)],
                        transaction_type='income'
                    ).annotate(
                        month=TruncMonth('date')
                    ).values('month').annotate(
                        total=Sum('amount'),
                        count=Count('id')
                    ).order_by('month'))
            
            @sync_to_async
            def get_seasonal_factors():
                # Get last year's data to calculate seasonal factors
                current_year = start_date.year
                last_year_start = datetime(current_year-1, 1, 1)
                last_year_end = datetime(current_year-1, 12, 31)
                
                # Query to get monthly sales for calculating seasonality
                if product_name:
                    monthly_data = TransactionsTransaction.objects.filter(
                        date__range=[last_year_start, last_year_end],
                        transaction_type='income',
                        category__icontains=product_name
                    )
                else:
                    monthly_data = TransactionsTransaction.objects.filter(
                        date__range=[last_year_start, last_year_end],
                        transaction_type='income'
                    )
                
                monthly_data = monthly_data.annotate(
                    month=ExtractMonth('date')
                ).values('month').annotate(
                    total=Sum('amount')
                ).order_by('month')
                
                # Convert to dict for easier access
                monthly_totals = {item['month']: float(item['total']) for item in monthly_data}
                
                # Calculate annual average if we have data
                if monthly_totals:
                    annual_avg = sum(monthly_totals.values()) / len(monthly_totals)
                    # Calculate seasonal factors (monthly value / annual average)
                    seasonal_factors = {month: (total / annual_avg if annual_avg > 0 else 1.0) 
                                       for month, total in monthly_totals.items()}
                    return seasonal_factors
                else:
                    # Default to no seasonality if no data
                    return {month: 1.0 for month in range(1, 13)}
            
            @sync_to_async
            def get_growth_trend(data_points):
                if not data_points or len(data_points) < 2:
                    return 1.0  # Default to no growth
                
                # Simple linear regression to estimate growth trend
                x = list(range(len(data_points)))
                y = [float(point['total']) for point in data_points]
                
                if all(val == 0 for val in y):
                    return 1.0  # No growth if all values are zero
                
                # Calculate slope using numpy if available, otherwise use simple calculation
                try:
                    import numpy as np
                    slope, _ = np.polyfit(x, y, 1)
                    # Convert slope to monthly growth factor
                    avg_y = np.mean(y)
                    growth_factor = 1 + (slope / avg_y if avg_y > 0 else 0)
                    return max(0.8, min(1.2, growth_factor))  # Limit growth factor to reasonable range
                except:
                    # Fallback to simple growth calculation if numpy not available
                    if len(data_points) >= 2 and y[0] > 0:
                        growth_rate = (y[-1] / y[0]) ** (1 / len(y)) - 1
                        return 1 + growth_rate
                    return 1.0
            
            # Execute database queries asynchronously
            historical_data = await get_historical_sales()
            seasonal_factors = await get_seasonal_factors()
            growth_trend = await get_growth_trend(historical_data)
            
            # Generate forecast for requested period
            forecast_months = []
            forecast_period = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
            
            # Get the last known sales amount
            last_sales_amount = float(historical_data[-1]['total']) if historical_data else 0
            if last_sales_amount == 0:
                # Fallback if no historical data
                last_sales_amount = 1000  # Placeholder value
            
            # Generate forecast for each month in the forecast period
            current_date = start_date
            total_forecast = 0
            
            for i in range(forecast_period):
                forecast_month = current_date.month
                seasonal_factor = seasonal_factors.get(forecast_month, 1.0)
                
                # Apply growth trend and seasonality
                forecast_value = last_sales_amount * (growth_trend ** (i+1)) * seasonal_factor
                
                # Add to forecast months list
                forecast_months.append({
                    'month': current_date.strftime('%b %Y'),
                    'forecast': forecast_value
                })
                
                total_forecast += forecast_value
                current_date = (current_date.replace(day=1) + timedelta(days=32)).replace(day=1)
            
            # Generate forecast report
            product_text = f"for {product_name}" if product_name else ""
            
            report = f"""
# Sales Forecast {product_text}
**Period: {start_date.date()} to {end_date.date()}**

## Forecast Summary
- Total Forecasted Sales: N{total_forecast:,.2f}
- Forecast Period: {forecast_period} month{'s' if forecast_period != 1 else ''}
- Base Growth Trend: {(growth_trend-1)*100:.1f}% month-over-month

## Monthly Forecast:
"""
            # Add monthly breakdown
            for month_data in forecast_months:
                month_name = month_data['month']
                forecast_amount = month_data['forecast']
                report += f"- {month_name}: N{forecast_amount:,.2f}\n"
            
            # Add forecast methodology and disclaimer
            report += f"""
## Forecast Methodology
This forecast is based on:
- Historical sales data from the past 6 months
- Seasonal patterns derived from last year's data
- Current growth trajectory of {(growth_trend-1)*100:.1f}% month-over-month

**Note:** This forecast is an estimate based on historical patterns and may vary from actual results due to market conditions, promotions, or other external factors.
"""
            
            dispatcher.utter_message(text=report)
            
        except Exception as e:
            logging.error(f"Sales forecast generation error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text="Unable to generate sales forecast. Please try again.")
        
        return []

class ActionSalesComparison(Action):
    def name(self) -> Text:
        return "action_sales_comparison"

    async def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get the entities directly from the latest message
        entities = tracker.latest_message.get('entities', [])
        
        # Extract first_time_period and second_time_period directly from entities
        first_period = next((e['value'] for e in entities if e['entity'] == 'first_time_period'), None)
        second_period = next((e['value'] for e in entities if e['entity'] == 'second_time_period'), None)
        
        # Log what we're getting from the entities
        logging.info(f"Entities from latest message: {entities}")
        logging.info(f"Extracted first_period: {first_period}, second_period: {second_period}")
        
        # Fallback to slots if entities are not found
        if not first_period:
            first_period = tracker.get_slot("first_time_period")
        if not second_period:
            second_period = tracker.get_slot("second_time_period")
        
        # Log the values we're using
        logging.info(f"Using first_period: {first_period}, second_period: {second_period}")

        if not first_period and not second_period:
            dispatcher.utter_message(text="Please specify two time periods to compare sales between, e.g., 'Compare sales between January 2025 and February 2025'")
            return []

        # If only one period is specified, we need to infer the other
        if first_period and not second_period:
            # Check if first_period is a specific reference like "this month"
            if first_period.lower() in ["this month", "current month"]:
                second_period = "last month"
            elif first_period.lower() in ["this quarter", "current quarter"]:
                second_period = "last quarter" 
            elif first_period.lower() in ["this year", "current year"]:
                second_period = "last year"
            # If it's a specific month/year, compare to previous month
            else:
                # We'll handle this in the parsing function
                second_period = "default comparison period"
                
            logging.info(f"Inferred second period as: {second_period}")
            
        elif second_period and not first_period:
            # Similar logic for when only second period is specified
            if second_period.lower() in ["last month", "previous month"]:
                first_period = "this month"
            elif second_period.lower() in ["last quarter", "previous quarter"]:
                first_period = "this quarter"
            elif second_period.lower() in ["last year", "previous year"]:
                first_period = "this year"
            else:
                first_period = "default comparison period"
                
            logging.info(f"Inferred first period as: {first_period}")

        try:
            logging.info(f"Comparing sales between: {first_period} and {second_period}")

            # Parse the time periods                                                                                                        
            # Create an instance of the parser class                                                                                   
            action_parser = ActionParsePeriod()                                                                                             
                                                                                                                                            
            first_start_date, first_end_date = action_parser._parse_time_period(first_period)                                               
            second_start_date, second_end_date = action_parser._parse_time_period(second_period)                                            
                                                                                                                                            
            logging.info(f"Period 1: {first_start_date.date()} to {first_end_date.date()}")                                                 
            logging.info(f"Period 2: {second_start_date.date()} to {second_end_date.date()}")                                               
                                                                                                                                            
            # Define synchronous functions for database operations                                                                          
            @sync_to_async                                                                                                                  
            def get_period_data(start_date, end_date):                                                                                      
                # Get basic sales metrics                                                                                                   
                sales_data = TransactionsTransaction.objects.filter(                                                                        
                    date__range=[start_date, end_date],                                                                                     
                    transaction_type='income'                                                                                               
                ).aggregate(                                                                                                                
                    total=Sum('amount'),                                                                                                    
                    count=Count('id')                                                                                                       
                )                                                                                                                           
                                                                                                                                            
                # Get category breakdown                                                                                                    
                category_data = list(TransactionsTransaction.objects.filter(                                                                
                    date__range=[start_date, end_date],                                                                                     
                    transaction_type='income'                                                                                               
                ).values('category').annotate(                                                                                              
                    total=Sum('amount'),                                                                                                    
                    count=Count('id')
                ).order_by('-total'))

                # Get daily sales
                daily_data = list(TransactionsTransaction.objects.filter(                                                                   
                    date__range=[start_date, end_date],                                                                                     
                    transaction_type='income'                                                                                               
                ).annotate(                                                                                                                 
                    day=TruncDay('date')                                                                                                    
                ).values('day').annotate(                                                                                                   
                    total=Sum('amount'),                                                                                                    
                    count=Count('id')                                                                                                       
                ).order_by('day'))                                                                                                          
                                                                                                                                            
                # Calculate average daily sales                                                                                             
                period_days = (end_date - start_date).days + 1  # Including both start and end dates                                        
                daily_avg = (sales_data['total'] or 0) / period_days if period_days > 0 else 0                                              
                                                                                                                                            
                return {                                                                                                                    
                    'total': sales_data['total'] or 0,                                                                                      
                    'count': sales_data['count'] or 0,                                                                                      
                    'avg_sale': (sales_data['total'] or 0) / (sales_data['count'] or 1) if sales_data['count'] else 0,                      
                    'daily_avg': daily_avg,                                                                                                 
                    'categories': category_data,                                                                                            
                    'daily_data': daily_data,                                                                                               
                    'period_days': period_days                                                                                              
                }                                                                                                                           
                                                                                                                                            
            # Fetch data for both periods asynchronously                                                                                    
            first_period_data = await get_period_data(first_start_date, first_end_date)                                                     
            second_period_data = await get_period_data(second_start_date, second_end_date)                                                  
                                                                                                                                            
            # Convert to float for consistent handling                                                                                      
            first_total = float(first_period_data['total'])                                                                                 
            second_total = float(second_period_data['total'])                                                                               
                                                                                                                                            
            # Calculate changes and percentages                                                                                             
            total_change = second_total - first_total
            total_change_pct = (total_change / first_total * 100) if first_total > 0 else 0                                                 
                                                                                                                                            
            count_change = second_period_data['count'] - first_period_data['count']                                                         
            count_change_pct = (count_change / first_period_data['count'] * 100) if first_period_data['count'] > 0 else 0                   
                                                                                                                                            
            avg_sale_change = second_period_data['avg_sale'] - first_period_data['avg_sale']                                                
            avg_sale_change_pct = (avg_sale_change / first_period_data['avg_sale'] * 100) if first_period_data['avg_sale'] > 0 else 0       
                                                                                                                                            
            daily_avg_change = second_period_data['daily_avg'] - first_period_data['daily_avg']                                             
            daily_avg_change_pct = (daily_avg_change / first_period_data['daily_avg'] * 100) if first_period_data['daily_avg'] > 0 else 0   
                                                                                                                                            
            # Create category comparison                                                                                                    
            category_comparison = {}                                                                                                        
                                                                                                                                            
            # Process first period categories                                                                                               
            for cat in first_period_data['categories']:                                                                                     
                cat_name = cat['category'] or 'Uncategorized'                                                                               
                category_comparison[cat_name] = {                                                                                           
                    'first_period': float(cat['total']),                                                                                    
                    'first_count': cat['count'],                                                                                            
                    'second_period': 0,                                                                                                     
                    'second_count': 0                                                                                                       
                }                                                                                                                           
                                                                                                                                            
            # Process second period categories and update the comparison                                                                    
            for cat in second_period_data['categories']:                                                                                    
                cat_name = cat['category'] or 'Uncategorized'                                                                               
                if cat_name in category_comparison:                                                                                         
                    category_comparison[cat_name]['second_period'] = float(cat['total'])                                                    
                    category_comparison[cat_name]['second_count'] = cat['count']                                                            
                else:                                                                                                                       
                    category_comparison[cat_name] = {                                                                                       
                        'first_period': 0,                                                                                                  
                        'first_count': 0,                                                                                                   
                        'second_period': float(cat['total']),                                                                               
                        'second_count': cat['count']                                                                                        
                    }
                    
            # Format the time periods for display in a more readable way
            # Use more descriptive formats based on period type
            def get_display_period(start_date, end_date):
                # Check for full quarter
                is_quarter_start = start_date.day == 1 and (start_date.month - 1) % 3 == 0
                is_quarter_end = end_date.day == calendar.monthrange(end_date.year, end_date.month)[1] and end_date.month == start_date.month + 2
    
                # Full quarter (e.g., Q1, Q2, etc.)
                if is_quarter_start and is_quarter_end:
                    quarter = (start_date.month - 1) // 3 + 1
                    return f"Q{quarter} {start_date.year}"
    
                # Full month
                elif start_date.day == 1 and end_date.day == calendar.monthrange(end_date.year, end_date.month)[1] and start_date.month == end_date.month:
                    # If it's a full month, just show the month and year
                    return f"{start_date.strftime('%b %Y')}"
    
                # Full year
                elif start_date.day == 1 and start_date.month == 1 and end_date.day == 31 and end_date.month == 12:
                    # If it's a full year, just show the year
                    return f"{start_date.year}"
    
                # Other date ranges
                else:
                    return f"{start_date.strftime('%d %b %Y')} - {end_date.strftime('%d %b %Y')}" 
            first_display_period = get_display_period(first_start_date, first_end_date)
            second_display_period = get_display_period(second_start_date, second_end_date)

            report = f"""
# Sales Comparison: {first_display_period} vs {second_display_period}
**First Period: {first_start_date.date()} to {first_end_date.date()} ({first_period_data['period_days']} days)**
**Second Period: {second_start_date.date()} to {second_end_date.date()} ({second_period_data['period_days']} days)**

## Summary Comparison
| Metric | {first_display_period} | {second_display_period} | Change | % Change |
|--------|--------------|---------------|--------|----------|
| Total Sales | N{first_total:,.2f} | N{second_total:,.2f} | N{total_change:,.2f} | {total_change_pct:+.1f}% |
| Transactions | {first_period_data['count']} | {second_period_data['count']} | {count_change} | {count_change_pct:+.1f}% |
| Avg Sale Value | N{first_period_data['avg_sale']:,.2f} | N{second_period_data['avg_sale']:,.2f} | N{avg_sale_change:,.2f} | {avg_sale_change_pct:+.1f}% |
| Daily Avg Sales | N{first_period_data['daily_avg']:,.2f} | N{second_period_data['daily_avg']:,.2f} | N{daily_avg_change:,.2f} | {daily_avg_change_pct:+.1f}% |

## Performance Analysis
"""
            # Add performance analysis based on the data
            if total_change_pct > 0:
                report += f"Sales increased by {total_change_pct:.1f}% from {first_display_period} to {second_display_period}. "                            
            else:                                                                                                                           
                report += f"Sales decreased by {abs(total_change_pct):.1f}% from {first_display_period} to {second_display_period}. "                       
                                                                                                                                            
            if count_change_pct > 0:                                                                                                        
                report += f"Transaction volume grew by {count_change_pct:.1f}%, "                                                           
            else:                                                                                                                           
                report += f"Transaction volume declined by {abs(count_change_pct):.1f}%, "                                                  
                                                                                                                                            
            if avg_sale_change_pct > 0:                                                                                                     
                report += f"while the average sale value increased by {avg_sale_change_pct:.1f}%.\n\n"                                      
            else:                                                                                                                           
                report += f"while the average sale value decreased by {abs(avg_sale_change_pct):.1f}%.\n\n"                                 
                                                                                                                                            
            # Add category comparison                                                                                                       
            report += "## Category Comparison\n"                                                                                            
                                                                                                                                            
            # Sort categories by second period value for relevance
            sorted_categories = sorted(
                category_comparison.items(),
                key=lambda x: x[1]['second_period'],
                reverse=True
            )

            for cat_name, cat_data in sorted_categories[:5]:  # Top 5 categories
                first_amount = cat_data['first_period']
                second_amount = cat_data['second_period']
                cat_change = second_amount - first_amount
                cat_change_pct = (cat_change / first_amount * 100) if first_amount > 0 else 0

                first_pct = (first_amount / first_total * 100) if first_total > 0 else 0
                second_pct = (second_amount / second_total * 100) if second_total > 0 else 0

                report += f"### {cat_name}\n"
                report += f"- {first_display_period}: N{first_amount:,.2f} ({first_pct:.1f}% of total), {cat_data['first_count']} transactions\n"   
                report += f"- {second_display_period}: N{second_amount:,.2f} ({second_pct:.1f}% of total), {cat_data['second_count']} transactions\n"
                report += f"- Change: N{cat_change:,.2f} ({cat_change_pct:+.1f}%)\n\n"

            # Add insights and recommendations
            report += "## Key Insights & Recommendations\n"

            # Growth or decline recommendations
            if total_change_pct > 5:
                report += "1. **Strong Growth**: Capitalize on the positive sales momentum. Analyze what worked well and scale those strategies.\n"
            elif total_change_pct > 0:
                report += "1. **Modest Growth**: Continue implementing current strategies while identifying opportunities for acceleration.\n"
            elif total_change_pct > -5:
                report += "1. **Slight Decline**: Monitor closely and implement targeted marketing initiatives to reverse the small downward trend.\n"
            else:
                report += "1. **Significant Decline**: Urgent action needed. Identify root causes and develop an immediate recovery plan.\n"
                
            # Category-specific recommendations
            growing_categories = [c for c, d in sorted_categories if d['first_period'] > 0 and d['second_period'] > d['first_period']]      
            declining_categories = [c for c, d in sorted_categories if d['first_period'] > 0 and d['second_period'] < d['first_period']]    

            if growing_categories:
                top_growing = growing_categories[0]
                report += f"2. **Category Focus**: Invest more in the growing '{top_growing}' category which shows positive momentum.\n"    

            if declining_categories:
                top_declining = declining_categories[0]
                report += f"3. **Recovery Strategy**: Develop a targeted plan to address the decline in the '{top_declining}' category.\n"
            # Transaction vs. value recommendation
            if count_change_pct > avg_sale_change_pct:
                report += "4. **Upselling Opportunity**: While transaction volume is growing, focus on increasing average sale value through upselling and premium offerings.\n"
            else:
                report += "4. **Customer Acquisition**: Focus on increasing transaction volume through customer acquisition strategies while maintaining the strong average sale value.\n"

            dispatcher.utter_message(text=report)

        except Exception as e:
            logging.error(f"Sales comparison error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text="I encountered an error while comparing sales data. Please try again or contact support if the issue persists.")
        
        return []

class ActionTopPerformingProducts(Action):
    def name(self) -> Text:
        return "action_top_performing_products"

    async def run(self, dispatcher: CollectingDispatcher,
                  tracker: Tracker,
                  domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        # Extract slot
        time_period = tracker.get_slot("time_period")

        if not time_period:
            dispatcher.utter_message(text="Please specify a time period for the top products query.")
            return []

        try:
            # Parse the time period - reuse the same logic
            if '|' in time_period:
                # Already parsed format
                start_date_str, end_date_str = time_period.split('|')
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                logging.info(f"Parsed time period: {time_period} → {start_date.date()} to {end_date.date()}")
            else:
                # Need to parse the time period string directly
                from actions.actions import ActionParsePeriod

                logging.info(f"Parsing raw time period: {time_period}")
                action_parser = ActionParsePeriod()
                start_date, end_date = action_parser._parse_time_period(time_period)
                logging.info(f"Successfully parsed time period: {start_date.date()} to {end_date.date()}")

            # Define synchronous functions for database operations
            @sync_to_async
            def get_top_products_data(limit=10):
                from django.db import models
                from django.db.models import Sum, F, Q, Case, When, IntegerField, DecimalField, Value
                from django.db.models.functions import Coalesce

                # Create date range filter
                date_filters = Q(
                    coreorderitem__order__order_date__range=[start_date, end_date],
                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped']  # Adjust status values as needed
                )

                # Get top products filtered by date range and calculated sales
                top_products = ProductsProduct.objects.filter(
                    is_active=1
                ).annotate(
                    period_sales=Coalesce(
                        Sum(
                            Case(
                                When(
                                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped'],
                                    then='coreorderitem__quantity'
                                ),
                                default=Value(0),
                                output_field=IntegerField(),
                            ),
                            filter=date_filters
                        ),
                        Value(0),
                        output_field=IntegerField()
                    ),
                    period_revenue=Coalesce(
                        Sum(
                            Case(
                                When(
                                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped'],
                                    then=F('coreorderitem__quantity') * F('coreorderitem__unit_price')
                                ),
                                default=Value(0),
                                output_field=DecimalField(max_digits=10, decimal_places=2)
                            ),
                            filter=date_filters
                        ),
                        Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2)
                    )
                ).order_by('-period_sales')[:limit]

                # Create a list of dictionaries with all needed data
                top_products_data = []
                for product in top_products:
                    top_products_data.append({
                        'name': product.name,
                        'sales': product.period_sales,  # Use period-specific sales
                        'price': float(product.price),
                        'revenue': float(product.period_revenue)  # Add calculated revenue
                    })

                return top_products_data

            @sync_to_async
            def get_worst_products_data(limit=5):
                from django.db import models
                from django.db.models import Sum, F, Q, Case, When, IntegerField, DecimalField, Value
                from django.db.models.functions import Coalesce

                # Create date range filter
                date_filters = Q(
                    coreorderitem__order__order_date__range=[start_date, end_date],
                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped']  # Adjust status values as needed
                )

                # Get worst products filtered by date range and calculated sales
                worst_products = ProductsProduct.objects.filter(
                    is_active=1
                ).annotate(
                    period_sales=Coalesce(
                        Sum(
                            Case(
                                When(
                                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped'],
                                    then='coreorderitem__quantity'
                                ),
                                default=Value(0),
                                output_field=IntegerField(),
                            ),
                            filter=date_filters
                        ),
                        Value(0),
                        output_field=IntegerField()
                    ),
                    period_revenue=Coalesce(
                        Sum(
                            Case(
                                When(
                                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped'],
                                    then=F('coreorderitem__quantity') * F('coreorderitem__unit_price')
                                ),
                                default=Value(0),
                                output_field=DecimalField(max_digits=10, decimal_places=2)
                            ),
                            filter=date_filters
                        ),
                        Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2)
                    )
                ).order_by('period_sales')[:limit]  # Order by ascending sales for worst products

                # Create a list of dictionaries with all needed data
                worst_products_data = []
                for product in worst_products:
                    worst_products_data.append({
                        'name': product.name,
                        'sales': product.period_sales,  # Use period-specific sales
                        'price': float(product.price),
                        'revenue': float(product.period_revenue)  # Add calculated revenue
                    })

                return worst_products_data

            @sync_to_async
            def get_total_sales():
                from django.db import models
                from django.db.models import Sum, Q, Case, When, IntegerField, Value
                from django.db.models.functions import Coalesce

                # Create date range filter
                date_filters = Q(
                    coreorderitem__order__order_date__range=[start_date, end_date],
                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped']
                )

                # Calculate period-specific total sales
                return ProductsProduct.objects.filter(
                    is_active=1
                ).annotate(
                    period_sales=Coalesce(
                        Sum(
                            Case(
                                When(
                                    coreorderitem__order__status__in=['completed', 'delivered', 'shipped'],
                                    then='coreorderitem__quantity'
                                ),
                                default=Value(0),
                                output_field=IntegerField(),
                            ),
                            filter=date_filters
                        ),
                        Value(0),
                        output_field=IntegerField()
                    )
                ).aggregate(total_sales=Sum('period_sales'))['total_sales'] or 0

            # Execute database queries asynchronously
            top_products_data = await get_top_products_data(10)  # Top 10 products
            worst_products_data = await get_worst_products_data(5)  # Bottom 5 products
            total_sales_units = await get_total_sales()

            # Calculate total revenue
            total_revenue = sum(p.get('revenue', 0) for p in top_products_data + worst_products_data)

            # Generate response
            report = f"""
# Top Performing Products
**Period: {start_date.date()} to {end_date.date()}**

## Top 10 Products by Sales Volume
"""
            # Add top products
            if top_products_data:
                for i, product in enumerate(top_products_data, 1):
                    sales_percentage = (product['sales'] / total_sales_units * 100) if total_sales_units > 0 else 0
                    report += f"{i}. {product['name']}: {product['sales']} units sold ({sales_percentage:.1f}% of total), N{product['revenue']:,.2f} revenue\n"
            else:
                report += "No product sales data available for this period.\n"

            # Add underperforming products
            report += f"""
## Underperforming Products
"""
            if worst_products_data:
                for i, product in enumerate(worst_products_data, 1):
                    sales_percentage = (product['sales'] / total_sales_units * 100) if total_sales_units > 0 else 0
                    report += f"{i}. {product['name']}: {product['sales']} units sold ({sales_percentage:.1f}% of total), N{product['revenue']:,.2f} revenue\n"
            else:
                report += "No underperforming product data available for this period.\n"

            dispatcher.utter_message(text=report)

        except Exception as e:
            logging.error(f"Top products query error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text="Unable to retrieve top performing products. Please try again.")

        return []

class ActionProductSalesQuery(Action):
    def name(self) -> Text:
        return "action_product_sales_query"

    async def run(self, dispatcher: CollectingDispatcher,
                  tracker: Tracker,
                  domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        # Extract slots
        product_name = tracker.get_slot("product_name")
        time_period = tracker.get_slot("time_period")

        if not product_name:
            dispatcher.utter_message(text="Please specify which product you'd like to check sales for.")
            return []

        if not time_period:
            dispatcher.utter_message(text="Please specify a time period for the sales query.")
            return []

        try:
            # Parse the time period - reuse the same logic from other actions
            if '|' in time_period:
                # Already parsed format
                start_date_str, end_date_str = time_period.split('|')
                start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
                end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
                logging.info(f"Using parsed time period: {start_date.date()} to {end_date.date()}")
            else:
                # Need to parse the time period string directly
                from actions.actions import ActionParsePeriod
                
                logging.info(f"Parsing raw time period: {time_period}")
                action_parser = ActionParsePeriod()
                start_date, end_date = action_parser._parse_time_period(time_period)
                logging.info(f"Successfully parsed time period: {start_date.date()} to {end_date.date()}")

            @sync_to_async
            def get_product_data():
                from django.db import models
                from django.db.models import Sum, F, Q, Case, When, IntegerField, DecimalField, Value
                from django.db.models.functions import Coalesce
                
                # First find the product by name (case-insensitive partial match)
                products = ProductsProduct.objects.filter(
                    name__icontains=product_name,
                    is_active=1
                )
                
                if not products.exists():
                    return None
                
                # Get the first matching product
                product = products.first()
                
                # Extract category name inside the sync context
                category_name = product.category.name if hasattr(product, 'category') and product.category else 'N/A'
                
                # Extract description in sync context
                description = product.description if product.description else 'No description available.'
                
                # Create date range filter for CoreOrderitem
                date_filters = Q(
                    order__order_date__range=[start_date, end_date],
                    order__status__in=['completed', 'delivered', 'shipped']  # Adjust status values as needed
                )
                
                # Calculate period-specific sales using CoreOrderitem
                period_sales = CoreOrderitem.objects.filter(
                    product=product
                ).filter(date_filters).aggregate(
                    total_quantity=Coalesce(Sum('quantity'), Value(0), output_field=IntegerField())
                )['total_quantity']
                
                # Calculate period revenue using CoreOrderitem
                period_revenue = CoreOrderitem.objects.filter(
                    product=product
                ).filter(date_filters).aggregate(
                    total_revenue=Coalesce(
                        Sum(F('quantity') * F('unit_price')),
                        Value(0),
                        output_field=DecimalField(max_digits=10, decimal_places=2)
                    )
                )['total_revenue']
                
                # If no direct sales in the period, check stock adjustments as a fallback
                if period_sales == 0:
                    try:
                        # Get stock adjustments for this product in the time period
                        stock_adjustments = StockAdjustmentsStockadjustment.objects.filter(
                            product=product,
                            adjustment_date__range=[start_date.date(), end_date.date()],
                            adjustment_type='sales'  # Adjust this based on your actual adjustment types
                        )
                        
                        if stock_adjustments.exists():
                            # Sum the quantities for sales adjustments
                            period_sales = abs(stock_adjustments.aggregate(
                                total_quantity=models.Sum('quantity')
                            )['total_quantity'] or 0)
                            
                            # Calculate revenue based on current price (approximate)
                            period_revenue = float(product.price) * period_sales
                    except Exception as e:
                        logging.error(f"Failed to get stock adjustment data: {str(e)}")
                
                # Create a simple dict with all the product data we need
                product_data = {
                    'id': product.id,
                    'name': product.name,
                    'sku': product.sku,
                    'price': float(product.price),
                    'stock': product.stock,
                    'total_sales': product.sales,  # Lifetime sales
                    'period_sales': period_sales,  # Sales in the specified period
                    'period_revenue': float(period_revenue),
                    'category_name': category_name,
                    'description': description
                }
                
                return product_data
            
            # Execute database query asynchronously
            product_data = await get_product_data()
            
            if not product_data:
                dispatcher.utter_message(text=f"No product found matching '{product_name}'. Please try a different name.")
                return []
            
            # All data is now safely extracted, we can build the report
            period_sales = product_data['period_sales']
            period_revenue = product_data['period_revenue']
            
            report = f"""
# {product_data['name']} Sales Report
**Period: {start_date.date()} to {end_date.date()}**

## Product Information
- SKU: {product_data['sku']}
- Price: N{product_data['price']:,.2f}
- Current Stock: {product_data['stock']} units
- Sales in Period: {period_sales} units
- Revenue in Period: N{period_revenue:,.2f}

## Category
- {product_data['category_name']}

## Description
{product_data['description']}
"""
            
            dispatcher.utter_message(text=report)
            
        except Exception as e:
            logging.error(f"Product sales query error: {str(e)}", exc_info=True)
            dispatcher.utter_message(text=f"Unable to retrieve sales data for {product_name}. Please try again.")
            
        return []

class ActionInventoryAnalysis(Action):
    def name(self) -> Text:
        return "action_inventory_analysis"

    async def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:

        # Get the latest message and intent
        latest_message = tracker.latest_message.get('text', '').lower()
        intent = tracker.latest_message.get('intent', {}).get('name', '')

        # Log the message being processed
        logging.info(f"Processing inventory analysis message: {latest_message}")
        logging.info(f"Detected intent: {intent}")

        # Extract slots
        time_period = tracker.get_slot("time_period")
        first_time_period = tracker.get_slot("first_time_period")
        second_time_period = tracker.get_slot("second_time_period")
        product_name = tracker.get_slot("product_name")
        product_category = tracker.get_slot("product_category")

        # If time periods not in slots, try to extract from message
        if not time_period and not first_time_period:
            time_patterns = [
                r"as of (today|now)",
                r"for (today|this week|this month|this quarter|this year)",
                r"for (january|february|march|april|may|june|july|august|september|october|november|december)( \d{4})?",
                r"for (q[1-4])( \d{4})?",
                r"for (\d{4})"
            ]
            
            for pattern in time_patterns:
                match = re.search(pattern, latest_message)
                if match:
                    time_period = match.group(1)
                    if match.lastindex > 1 and match.group(2):
                        time_period += match.group(2)
                    break

        # Check for comparison terms
        comparison_terms = ["compare", "between", "vs", "versus", "against", "difference"]
        is_comparison_request = any(term in latest_message for term in comparison_terms)

        # If it's a comparison request but we don't have both time periods yet
        if is_comparison_request and (not first_time_period or not second_time_period):
            # Look for patterns like "Q4 2024 and Q1 2025" or "between Jan and Feb"
            comparison_pattern = r"(?:between\s+)?([a-zA-Z0-9\s]+?)\s+(?:and|vs|versus)\s+([a-zA-Z0-9\s]+)"
            comp_match = re.search(comparison_pattern, latest_message)
    
            if comp_match:
                first_time_period = comp_match.group(1).strip()
                second_time_period = comp_match.group(2).strip()
    
        # Final check if this is a comparison request
        is_comparison = bool(first_time_period and second_time_period) or \
                       (is_comparison_request and "changes" not in latest_message)

        # Extract product if not in slots
        if not product_name and not product_category:
            # First check if this is likely a comparison request
            if is_comparison_request:
                # Skip product extraction for comparison requests
                pass
            else:
                ignore_phrases = ["show me", "what is the", "tell me about", "give me", "check", "view", "see"]

                product_patterns = [
                    r"for ([a-zA-Z0-9 ]+?) inventory",
                    r"([\w\s]+) inventory",
                    r"inventory (?:of|for) ([\w\s]+)",
                    r"stock (?:of|for) ([\w\s]+)"
                ]

                for pattern in product_patterns:
                    match = re.search(pattern, latest_message)
                    if match:
                        extracted = match.group(1).strip()

                        if any(extracted.lower() == phrase for phrase in ignore_phrases):
                            continue
                        # Don't extract comparison terms as product names
                        if extracted.lower() not in ["compare", "between", "vs", "versus", "against"]:
                            # Determine if this is likely a product name or category
                            if "category" in latest_message or any(cat in extracted.lower() for cat in ["electronics", "clothing", "furniture", "appliances"]):
                                product_category = extracted
                            else:
                                product_name = extracted
                            break

        try:                
            @sync_to_async
            def get_current_inventory_value():
                inventory_data = ProductsProduct.objects.filter(
                    is_active=1
                ).aggregate(
                    total_products=Count('id'),
                    total_units=Sum('stock'),
                    total_value=Sum(F('stock') * F('price'))
                )
                
                return inventory_data
            
            @sync_to_async
            def get_category_inventory():
                categories = ProductsCategory.objects.filter(is_active=1)
                result = []
                
                for category in categories:
                    cat_data = ProductsProduct.objects.filter(
                        category=category,
                        is_active=1
                    ).aggregate(
                        product_count=Count('id'),
                        total_units=Sum('stock'),
                        total_value=Sum(F('stock') * F('price'))
                    )
                    
                    result.append({
                        'category_name': category.name,
                        'product_count': cat_data['product_count'] or 0,
                        'total_units': cat_data['total_units'] or 0,
                        'total_value': float(cat_data['total_value'] or 0)
                    })
                
                return result
            
            @sync_to_async
            def get_product_inventory(prod_name=None, prod_category=None):
                
                query = Q(is_active=1)
                
                if prod_name:
                    query &= Q(name__icontains=prod_name)
                
                if prod_category:
                    query &= Q(category__name__icontains=prod_category)
                
                products = ProductsProduct.objects.filter(query).values(
                    'id', 'name', 'stock', 'price', 'category__name',
                    'sales', 'modified_at'
                )
                
                return list(products)

            @sync_to_async
            def get_inventory_changes(period1=None, period2=None):
                from django.db.models import Sum
                
                # Convert period strings to date ranges
                date1_start, date1_end = parse_time_period(period1 or "this month")
                
                if period2:
                    date2_start, date2_end = parse_time_period(period2)
                    
                    # Get inventory changes for both periods
                    period1_changes = ProductsInventoryLog.objects.filter(
                        timestamp__range=(date1_start, date1_end)
                    ).values('product__name').annotate(
                        incoming=Sum('quantity', filter=Q(action_type='add')),
                        outgoing=Sum('quantity', filter=Q(action_type='remove'))
                    )
                    
                    period2_changes = ProductsInventoryLog.objects.filter(
                        timestamp__range=(date2_start, date2_end)
                    ).values('product__name').annotate(
                        incoming=Sum('quantity', filter=Q(action_type='add')),
                        outgoing=Sum('quantity', filter=Q(action_type='remove'))
                    )
                    
                    # Combine and compare
                    product_names = set([item['product__name'] for item in period1_changes] + 
                                      [item['product__name'] for item in period2_changes])
                    
                    comparison = []
                    for product in product_names:
                        p1_data = next((item for item in period1_changes if item['product__name'] == product), 
                                      {'incoming': 0, 'outgoing': 0})
                        p2_data = next((item for item in period2_changes if item['product__name'] == product),
                                      {'incoming': 0, 'outgoing': 0})
                        
                        comparison.append({
                            'product': product,
                            'period1': {
                                'incoming': p1_data['incoming'] or 0,
                                'outgoing': p1_data['outgoing'] or 0,
                                'net': (p1_data['incoming'] or 0) - (p1_data['outgoing'] or 0)
                            },
                            'period2': {
                                'incoming': p2_data['incoming'] or 0,
                                'outgoing': p2_data['outgoing'] or 0,
                                'net': (p2_data['incoming'] or 0) - (p2_data['outgoing'] or 0)
                            }
                        })
                    
                    return {
                        'period1': {
                            'name': period1,
                            'start': date1_start,
                            'end': date1_end
                        },
                        'period2': {
                            'name': period2,
                            'start': date2_start,
                            'end': date2_end
                        },
                        'comparison': comparison
                    }
                else:
                    # Single period analysis
                    period_changes = ProductsInventoryLog.objects.filter(
                        timestamp__range=(date1_start, date1_end)
                    ).values('product__name').annotate(
                        incoming=Sum('quantity', filter=Q(action_type='add')) or 0,
                        outgoing=Sum('quantity', filter=Q(action_type='remove')) or 0
                    )
                    
                    changes = []
                    for product in period_changes:
                        incoming = product['incoming'] or 0
                        outgoing = product['outgoing'] or 0
                        net = incoming - outgoing
                        
                        changes.append({
                            'product': product['product__name'],
                            'incoming': incoming,
                            'outgoing': outgoing,
                            'net': net
                        })
                    
                    return {
                        'period': {
                            'name': period1,
                            'start': date1_start,
                            'end': date1_end
                        },
                        'changes': changes
                    }

            def parse_time_period(period):
                from django.utils import timezone
                """Convert time period expressions to date ranges"""
                now = timezone.now()
                period = period.lower()
                
                if period in ["today", "now"]:
                    return now.replace(hour=0, minute=0, second=0), now
                
                if period == "yesterday":
                    yesterday = now - timedelta(days=1)
                    return yesterday.replace(hour=0, minute=0, second=0), yesterday.replace(hour=23, minute=59, second=59)
                
                if period == "this week":
                    start_of_week = now - timedelta(days=now.weekday())
                    return start_of_week.replace(hour=0, minute=0, second=0), now
                
                if period == "last week":
                    start_of_last_week = now - timedelta(days=now.weekday() + 7)
                    end_of_last_week = start_of_last_week + timedelta(days=6)
                    return start_of_last_week.replace(hour=0, minute=0, second=0), end_of_last_week.replace(hour=23, minute=59, second=59)
                
                if period == "this month":
                    start_of_month = now.replace(day=1, hour=0, minute=0, second=0)
                    return start_of_month, now
                
                if period == "last month":
                    last_month = now.replace(day=1) - timedelta(days=1)
                    start_of_last_month = last_month.replace(day=1, hour=0, minute=0, second=0)
                    return start_of_last_month, last_month.replace(hour=23, minute=59, second=59)
                
                # Handle quarters
                quarters = {
                    "q1": (1, 3),
                    "q2": (4, 6),
                    "q3": (7, 9),
                    "q4": (10, 12)
                }
                
                quarter_match = re.match(r"q([1-4])(?:\s+(\d{4}))?", period)
                if quarter_match:
                    quarter = quarter_match.group(1)
                    year = int(quarter_match.group(2)) if quarter_match.group(2) else now.year
                    start_month, end_month = quarters[f"q{quarter}"]
                    
                    start_date = datetime(year, start_month, 1, tzinfo=now.tzinfo)
                    if end_month == 12:
                        end_date = datetime(year, 12, 31, 23, 59, 59, tzinfo=now.tzinfo)
                    else:
                        end_date = datetime(year, end_month + 1, 1, tzinfo=now.tzinfo) - timedelta(seconds=1)
                    
                    return start_date, end_date
                
                # Handle named months
                months = {
                    "january": 1, "february": 2, "march": 3, "april": 4,
                    "may": 5, "june": 6, "july": 7, "august": 8,
                    "september": 9, "october": 10, "november": 11, "december": 12
                }
                
                month_match = re.match(r"(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?", period)
                if month_match:
                    month_name = month_match.group(1).lower()
                    year = int(month_match.group(2)) if month_match.group(2) else now.year
                    month_num = months[month_name]
                    
                    start_date = datetime(year, month_num, 1, tzinfo=now.tzinfo)
                    if month_num == 12:
                        end_date = datetime(year + 1, 1, 1, tzinfo=now.tzinfo) - timedelta(seconds=1)
                    else:
                        end_date = datetime(year, month_num + 1, 1, tzinfo=now.tzinfo) - timedelta(seconds=1)
                    
                    return start_date, end_date
                
                # Handle year
                year_match = re.match(r"(\d{4})", period)
                if year_match:
                    year = int(year_match.group(1))
                    return datetime(year, 1, 1, tzinfo=now.tzinfo), datetime(year, 12, 31, 23, 59, 59, tzinfo=now.tzinfo)
                
                # Default to last 30 days if no match
                thirty_days_ago = now - timedelta(days=30)
                return thirty_days_ago, now

            # Handle different types of inventory analysis queries
            if "value" in latest_message:
                # Current inventory value query
                if time_period in ["today", "now"] or not time_period:
                    inventory_data = await get_current_inventory_value()
                    
                    total_products = inventory_data.get('total_products', 0) or 0
                    total_units = inventory_data.get('total_units', 0) or 0
                    total_value = float(inventory_data.get('total_value', 0) or 0)
                    
                    response = f"Current inventory value as of today: N{total_value:,.2f} across {total_units} units from {total_products} products."
                    
                    # Add category breakdown
                    categories = await get_category_inventory()
                    if categories:
                        response += "\n\nBreakdown by category:"
                        for cat in categories:
                            response += f"\n- {cat['category_name']}: N{cat['total_value']:,.2f} ({cat['total_units']} units, {cat['product_count']} products)"
                    
                    dispatcher.utter_message(text=response)
                else:
                    dispatcher.utter_message(text=f"I can currently only provide inventory value as of today. Historical inventory values for {time_period} are not available.")
            elif product_name or "level" in latest_message or "current inventory" in latest_message or "in stock" in latest_message:
                # Product specific inventory query
                products = await get_product_inventory(product_name, product_category)

                if products:
                    if len(products) == 1:
                        # Single product found
                        product = products[0]
                        product_stock = product.get('stock', 0) or 0
                        product_name = product.get('name', 'Unknown')
                        product_category = product.get('category__name', 'Uncategorized')
                        product_price = float(product.get('price', 0) or 0)
                        product_value = product_stock * product_price
                        product_sales = product.get('sales', 0) or 0
                        last_updated = product.get('modified_at')

                        response = f"Current inventory for {product_name}: {product_stock} units in stock. "
                        response += f"Category: {product_category}. "
                        response += f"Unit price: N{product_price:,.2f}. "
                        response += f"Total value: N{product_value:,.2f}."

                        if last_updated:
                            response += f" Last updated on {last_updated.strftime('%Y-%m-%d')}."

                        dispatcher.utter_message(text=response)
                    else:
                        # Multiple products found
                        total_units = sum(p.get('stock', 0) or 0 for p in products)
                        total_value = sum((p.get('stock', 0) or 0) * (p.get('price', 0) or 0) for p in products)

                        response = f"Found {len(products)} products "
                        if product_name:
                            response += f"matching '{product_name}' "
                        if product_category:
                            response += f"in category '{product_category}' "

                        response += f"with a total of {total_units} units in stock. "
                        response += f"Total value: N{total_value:,.2f}.\n\nTop items:"

                        # Sort by stock value for display
                        products.sort(key=lambda p: (p.get('stock', 0) or 0) * (p.get('price', 0) or 0), reverse=True)

                        for i, product in enumerate(products[:5], 1):
                            prod_name = product.get('name', 'Unknown')
                            prod_stock = product.get('stock', 0) or 0
                            prod_price = float(product.get('price', 0) or 0)
                            prod_value = prod_stock * prod_price

                            response += f"\n{i}. {prod_name}: {prod_stock} units (N{prod_value:,.2f})"

                        if len(products) > 5:
                            response += f"\n... and {len(products) - 5} more products"

                        dispatcher.utter_message(text=response)
                else:
                    search_term = product_name if product_name else (product_category if product_category else "specified criteria")
                    dispatcher.utter_message(text=f"No products matching '{search_term}' were found in our inventory.")

            elif is_comparison or (first_time_period and second_time_period):
                # Comparison between two time periods
                comparison_data = await get_inventory_changes(first_time_period, second_time_period)

                if comparison_data and comparison_data['comparison']:
                    period1_name = comparison_data['period1']['name']
                    period2_name = comparison_data['period2']['name']

                    response = f"Inventory comparison between {period1_name} and {period2_name}:\n\n"

                    # Sort by absolute change in net inventory
                    sorted_products = sorted(
                        comparison_data['comparison'],
                        key=lambda x: abs(x['period2']['net'] - x['period1']['net']),
                        reverse=True
                    )

                    for i, product in enumerate(sorted_products[:10], 1):
                        p1_net = product['period1']['net']
                        p2_net = product['period2']['net']
                        net_change = p2_net - p1_net
                        change_direction = "increased" if net_change > 0 else "decreased" if net_change < 0 else "unchanged"

                        response += f"{i}. {product['product']}: "
                        response += f"Net change: {abs(net_change)} units {change_direction} "
                        response += f"({p1_net} → {p2_net})\n"

                    if len(sorted_products) > 10:
                        response += f"... and {len(sorted_products) - 10} more products"

                    dispatcher.utter_message(text=response)
                else:
                    dispatcher.utter_message(text=f"No inventory changes data available for comparison between {first_time_period or 'first period'} and {second_time_period or 'second period'}.")

            elif "changes" in latest_message or "movement" in latest_message or "trend" in latest_message:
                # Inventory changes for a single time period
                period = time_period or "this month"
                changes_data = await get_inventory_changes(period)

                if changes_data and changes_data.get('changes'):
                    period_name = changes_data['period']['name']
                    start_date = changes_data['period']['start'].strftime('%Y-%m-%d')
                    end_date = changes_data['period']['end'].strftime('%Y-%m-%d')

                    response = f"Inventory Changes Report\nPeriod: {start_date} to {end_date}\n"

                    # Sort by absolute net change
                    sorted_changes = sorted(
                        changes_data['changes'],
                        key=lambda x: abs(x['net']),
                        reverse=True
                    )

                    for i, product in enumerate(sorted_changes[:10], 1):
                        incoming = product['incoming']
                        outgoing = product['outgoing']
                        net = product['net']

                        response += f"\n{i}. {product['product']}:"
                        response += f" Incoming: +{incoming} units"
                        response += f" Outgoing: -{outgoing} units"
                        response += f" Net Change: {'+' if net >= 0 else ''}{net} units"

                    dispatcher.utter_message(text=response)
                else:
                    dispatcher.utter_message(text=f"No inventory changes data available for {period}.")

            elif "turnover" in latest_message or "performance" in latest_message or "efficiency" in latest_message:
                # Inventory turnover and efficiency metrics
                @sync_to_async
                def get_inventory_turnover(period=None):
                    from django.db.models import Sum, F, ExpressionWrapper, FloatField

                    # Parse time period
                    start_date, end_date = parse_time_period(period or "this month")

                    # Get current inventory value
                    inventory_data = ProductsProduct.objects.filter(is_active=1).aggregate(
                        total_value=Sum(ExpressionWrapper(F('stock') * F('price'), output_field=FloatField()))
                    )

                    # Get average inventory value
                    avg_inventory = float(inventory_data.get('total_value', 0) or 0)

                    # Estimate COGS using the sales field and an estimated cost ratio
                    # Assuming cost is roughly 70% of selling price (30% margin)
                    sales_data = ProductsProduct.objects.filter(is_active=1).aggregate(
                        estimated_cogs=Sum(ExpressionWrapper(F('sales') * F('price') * 0.7, output_field=FloatField()))
                    )

                    # Get the estimated COGS
                    estimated_cogs = float(sales_data.get('estimated_cogs', 0) or 0)

                    # If COGS is 0 (no sales recorded), use a percentage of inventory as fallback estimate
                    if estimated_cogs == 0:
                        estimated_cogs = avg_inventory * 0.2  # Assume 20% inventory turnover

                    # Calculate turnover
                    turnover = estimated_cogs / avg_inventory if avg_inventory > 0 else 0

                    # Calculate days inventory outstanding
                    period_days = (end_date - start_date).days
                    dio = period_days / turnover if turnover > 0 else 0

                    return {
                        'period_start': start_date,
                        'period_end': end_date,
                        'cogs': estimated_cogs,
                        'avg_inventory': avg_inventory,
                        'turnover': turnover,
                        'dio': dio
                    }
                turnover_data = await get_inventory_turnover(time_period)

                period_str = time_period or "this month"
                start_date = turnover_data['period_start'].strftime('%Y-%m-%d')
                end_date = turnover_data['period_end'].strftime('%Y-%m-%d')

                response = f"Inventory Performance Metrics for {period_str} ({start_date} to {end_date}):\n\n"
                response += f"• Average Inventory Value: N{turnover_data['avg_inventory']:,.2f}\n"
                response += f"• Cost of Goods Sold: N{turnover_data['cogs']:,.2f}\n"
                response += f"• Inventory Turnover Ratio: {turnover_data['turnover']:.2f}\n"
                response += f"• Days Inventory Outstanding: {turnover_data['dio']:.1f} days"

                if turnover_data['turnover'] > 6:
                    response += "\n\nYour inventory turnover is excellent, indicating efficient inventory management."
                elif turnover_data['turnover'] > 4:
                    response += "\n\nYour inventory turnover is good, showing healthy inventory management."
                elif turnover_data['turnover'] > 2:
                    response += "\n\nYour inventory turnover is average. Consider reviewing slow-moving items."
                else:
                    response += "\n\nYour inventory turnover is below average. Consider reducing inventory levels of slow-moving items."

                dispatcher.utter_message(text=response)

            elif "status" in latest_message or "report" in latest_message or "health" in latest_message or "analysis" in latest_message:
                # General inventory status report
                @sync_to_async
                def get_inventory_health():
                    from django.db.models import Sum, Count, F, Case, When, IntegerField, Q

                    # Overall inventory value
                    overall_data = ProductsProduct.objects.filter(is_active=1).aggregate(
                        total_products=Count('id'),
                        total_units=Sum('stock'),
                        total_value=Sum(F('stock') * F('price')),
                        low_stock=Count('id', filter=Q(stock__gt=0, stock__lte=10)),
                        out_of_stock=Count('id', filter=Q(stock=0)),
                        high_stock=Count('id', filter=Q(stock__gt=50))
                    )

                    # Category breakdown
                    categories = ProductsProduct.objects.filter(is_active=1).values(
                        'category__name'
                    ).annotate(
                        total_products=Count('id'),
                        total_units=Sum('stock'),
                        total_value=Sum(F('stock') * F('price')),
                        low_stock=Count('id', filter=Q(stock__gt=0, stock__lte=10)),
                        out_of_stock=Count('id', filter=Q(stock=0))
                    ).order_by('-total_value')

                    return {
                        'overall': overall_data,
                        'categories': list(categories)
                    }

                health_data = await get_inventory_health()
                overall = health_data['overall']

                total_products = overall.get('total_products', 0) or 0
                total_units = overall.get('total_units', 0) or 0
                total_value = float(overall.get('total_value', 0) or 0)
                low_stock = overall.get('low_stock', 0) or 0
                out_of_stock = overall.get('out_of_stock', 0) or 0
                high_stock = overall.get('high_stock', 0) or 0

                response = f"Inventory Status Report as of {datetime.now().strftime('%Y-%m-%d')}:\n\n"
                response += f"Total Inventory Value: N{total_value:,.2f}\n"
                response += f"Total Products: {total_products}\n"
                response += f"Total Units: {total_units}\n"
                response += f"Low Stock Items: {low_stock} products\n"
                response += f"Out of Stock Items: {out_of_stock} products\n"
                response += f"Overstocked Items: {high_stock} products\n\n"

                # Calculate health score (simple example)
                in_stock_pct = (total_products - out_of_stock) / total_products * 100 if total_products > 0 else 0
                optimal_stock_pct = (total_products - out_of_stock - low_stock - high_stock) / total_products * 100 if total_products > 0 else 0

                response += f"In-Stock Percentage: {in_stock_pct:.1f}%\n"
                response += f"Optimal Stock Levels: {optimal_stock_pct:.1f}%\n\n"

                # Add top categories
                if health_data['categories']:
                    response += "Top Categories by Value:\n"
                    for i, cat in enumerate(health_data['categories'][:3], 1):
                        cat_name = cat.get('category__name', 'Uncategorized')
                        cat_value = float(cat.get('total_value', 0) or 0)
                        cat_units = cat.get('total_units', 0) or 0
                        cat_products = cat.get('total_products', 0) or 0

                        response += f"{i}. {cat_name}: N{cat_value:,.2f} ({cat_units} units across {cat_products} products)\n"

                dispatcher.utter_message(text=response)

            else:
                # Default to overall inventory summary
                inventory_data = await get_current_inventory_value()

                total_products = inventory_data.get('total_products', 0) or 0
                total_units = inventory_data.get('total_units', 0) or 0
                total_value = float(inventory_data.get('total_value', 0) or 0)

                response = f"Current Inventory Summary as of {datetime.now().strftime('%Y-%m-%d')}:\n\n"
                response += f"Total Products: {total_products}\n"
                response += f"Total Units in Stock: {total_units}\n"
                response += f"Total Inventory Value: N{total_value:,.2f}\n\n"

                response += "For more detailed analysis, you can ask about:\n"
                response += "- Inventory value by category\n"
                response += "- Stock levels for specific products\n"
                response += "- Inventory changes over time\n"
                response += "- Inventory performance metrics"

                dispatcher.utter_message(text=response)

        except Exception as e:
            logging.error(f"Error in inventory analysis: {str(e)}")
            logging.error(traceback.format_exc())
            dispatcher.utter_message(text=f"Sorry, I encountered an error while analyzing the inventory: {str(e)}")

        return []

class ActionProductInventoryCheck(Action):
    def name(self) -> Text:
        return "action_product_inventory_check"

    async def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        
        # Get the latest message and intent
        latest_message = tracker.latest_message.get('text', '').lower()
        intent = tracker.latest_message.get('intent', {}).get('name', '')
        
        # Log the message being processed
        logging.info(f"Processing product inventory check message: {latest_message}")
        logging.info(f"Detected intent: {intent}")
        
        # Extract product name from slots or message
        product_name = tracker.get_slot("product_name")
        
        # If product name not in slot, try to extract from message
        if not product_name:
            # Extract product query from message text
            product_query = None
            stock_inquiry_patterns = [
                r"how many (.+?) do we have",
                r"how many (.+?) in stock",
                r"how many (.+?) (is|are) available",
                r"(.+?) stock level",
                r"stock of (.+)",
                r"inventory of (.+)",
                r"available (.+)",
                r"current stock of (.+)",
                r"units of (.+?) available",
                r"quantity of (.+?) available",
                r"do we have enough (.+) in stock",
                r"enough (.+) in stock",
                r"show me (.+) inventory"
            ]

            for pattern in stock_inquiry_patterns:
                match = re.search(pattern, latest_message)
                if match:
                    product_query = match.group(1).strip()
                    logging.info(f"Extracted product query: {product_query}")
                    product_name = product_query
                    break
        
        # Check if we have a product name to work with
        if not product_name:
            dispatcher.utter_message(text="I'm not sure which product you're asking about. Could you specify the product name?")
            return []
        
        logging.info(f"Checking inventory for product: {product_name}")
        
        try:
            @sync_to_async
            def get_product_details(product_name):
                products = list(ProductsProduct.objects.filter(
                    name__icontains=product_name,
                    is_active=1
                ).values(
                    'id', 'name', 'description', 'stock', 'price', 'sku',
                    'category__name', 'sales', 'created_at', 'modified_at'
                ))

                if not products:
                    products = list(ProductsProduct.objects.filter(
                        Q(name__icontains=product_name) |
                        Q(description__icontains=product_name) |
                        Q(category__name__icontains=product_name),
                        is_active=1
                    ).values(
                        'id', 'name', 'description', 'stock', 'price', 'sku',
                        'category__name', 'sales', 'created_at', 'modified_at'
                    ))

                return products

            @sync_to_async
            def get_total_stock_by_product_name(product_name):
                return ProductsProduct.objects.filter(
                    name__icontains=product_name,
                    is_active=1
                ).aggregate(
                    total_stock=Sum('stock'),
                    product_count=Count('id'),
                    total_value=Sum(F('stock') * F('price'))
                )
                
            # Get product details
            product_details = await get_product_details(product_name)
            
            if product_details:
                if len(product_details) == 1:
                    product = product_details[0]
                    product_stock = product.get('stock', 0) or 0
                    product_name = product.get('name', 'Unknown')
                    product_category = product.get('category__name', 'Uncategorized')
                    product_price = float(product.get('price', 0) or 0)
                    product_value = product_stock * product_price
                    product_sales = product.get('sales', 0) or 0
                    last_updated = product.get('modified_at')
                    
                    # If the query was "do we have enough", provide appropriate assessment
                    if "do we have enough" in latest_message or "enough" in latest_message:
                        threshold = 10  # Define what "enough" means
                        if product_stock > threshold:
                            response = f"Yes, we have enough {product_name} in stock. Current stock level is {product_stock} units, which is above our minimum threshold of {threshold} units."
                        else:
                            response = f"No, we don't have enough {product_name} in stock. Current stock level is only {product_stock} units, which is below our minimum threshold of {threshold} units. You may want to consider restocking."
                    else:
                        response = f"We currently have {product_stock} units of {product_name} in stock. "
                        response += f"Category: {product_category}. "
                        response += f"Unit price: N{product_price:,.2f}. "
                        response += f"Total value: N{product_value:,.2f}. "
                        response += f"Total sales: {product_sales} units."

                        if last_updated:
                            response += f" Last updated on {last_updated.strftime('%Y-%m-%d')}."

                    dispatcher.utter_message(text=response)
                else:
                    # Multiple products found
                    total_data = await get_total_stock_by_product_name(product_name)
                    total_stock = total_data.get('total_stock', 0) or 0
                    product_count = total_data.get('product_count', 0) or 0
                    total_value = float(total_data.get('total_value', 0) or 0)

                    response = f"We have a total of {total_stock} units across {product_count} products matching '{product_name}'. "    
                    response += f"Total value: N{total_value:,.2f}.\n\nProduct details:\n"

                    for i, product in enumerate(product_details[:10], 1):
                        prod_name = product.get('name', 'Unknown')
                        prod_stock = product.get('stock', 0) or 0
                        prod_price = float(product.get('price', 0) or 0)
                        prod_category = product.get('category__name', 'Uncategorized')

                        response += f"{i}. {prod_name} ({prod_category}): {prod_stock} units at N{prod_price:,.2f} each\n"

                    if len(product_details) > 10:
                        response += f"... and {len(product_details) - 10} more products"

                    dispatcher.utter_message(text=response)
            else:
                dispatcher.utter_message(text=f"I couldn't find any products matching '{product_name}' in our inventory. Please check the spelling or try a different product name.")
                
        except Exception as e:
            logging.error(f"Error in product inventory check: {str(e)}")
            logging.error(traceback.format_exc())
            dispatcher.utter_message(text=f"Sorry, I encountered an error while checking the inventory: {str(e)}")
        
        return []


class ValidateFinancialReportForm(FormValidationAction):
    def name(self) -> Text:
        return "validate_financial_report_form"

    def validate_time_period(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        if not slot_value:
            dispatcher.utter_message(text="Please specify a time period for the report.")
            return {"time_period": None}

        try:                                                                                                                                
            start_date, end_date = self._parse_time_period(slot_value)  # Use the same parsing function
            formatted_time_period = f"{start_date}|{end_date}"
            return {"time_period": formatted_time_period}  # Store parsed date range
        except ValueError as e:
            dispatcher.utter_message(text=f"I couldn't understand that time period. {str(e)} Please try again.")
            return {"time_period": None}

    def validate_report_detail_level(
        self,
        slot_value: Any,
        dispatcher: CollectingDispatcher,
        tracker: Tracker,
        domain: DomainDict,
    ) -> Dict[Text, Any]:
        if slot_value in ["summary", "detailed"]:
            return {"report_detail_level": slot_value}
        return {"report_detail_level": "summary"}

class ActionDefaultFallback(Action):
    def name(self) -> Text:
        return "action_default_fallback"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: Dict[Text, Any]) -> List[Dict[Text, Any]]:
        dispatcher.utter_message(text="I'm sorry, I didn't understand that. Can you rephrase or try asking about financial reports, sales analytics, or inventory analysis?")
        return []
