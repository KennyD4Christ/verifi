# -*- coding: utf-8 -*-

from django.conf import settings
from decimal import Decimal, InvalidOperation
import decimal

class CurrencyFormatter:
    """
    Utility class for handling currency formatting across the application.
    """
    def __init__(self):
        self.currency_symbol = '\u20A6'
        self.decimal_places = getattr(settings, 'CURRENCY_DECIMAL_PLACES', 2)
        self.use_separator = getattr(settings, 'USE_THOUSAND_SEPARATOR', True)
        self.thousand_separator = getattr(settings, 'THOUSAND_SEPARATOR', ',')
        self.decimal_separator = getattr(settings, 'DECIMAL_SEPARATOR', '.')

    def format_currency(self, amount, include_symbol=True):
        """
        Formats a decimal number as currency.
        
        Args:
            amount: Decimal or float number to format
            include_symbol: Boolean to determine if currency symbol should be included
            
        Returns:
            Formatted currency string
        """
        if amount is None:
            return "₦0.00"

        try:
            # Convert to Decimal for precise handling
            decimal_amount = Decimal(str(amount))
            
            # Format the number with thousand separator
            formatted_number = '{:,}'.format(
                decimal_amount.quantize(Decimal(f'0.{"0" * self.decimal_places}'))
            )
            
            # Replace default separators with configured ones
            if self.use_separator:
                formatted_number = formatted_number.replace(',', self.thousand_separator)
                formatted_number = formatted_number.replace('.', self.decimal_separator)
            
            # Add currency symbol if requested
            if include_symbol:
                return f"{self.currency_symbol}{formatted_number}"
            
            return formatted_number
            
        except (TypeError, ValueError, decimal.InvalidOperation):
            return f"{self.currency_symbol}0{self.decimal_separator}00"

    def parse_currency(self, currency_string):
        """
        Converts a formatted currency string back to a Decimal for calculations.

        Args:
            currency_string: Formatted currency string to parse

        Returns:
            Decimal: The parsed amount as a Decimal object
        """
        if currency_string is None:
            return Decimal('0')

        try:
            # Remove currency symbol and thousand separators
            cleaned_string = str(currency_string).replace(self.currency_symbol, '')
            cleaned_string = cleaned_string.replace(self.thousand_separator, '')
            # Replace decimal separator with standard period if different
            if self.decimal_separator != '.':
                cleaned_string = cleaned_string.replace(self.decimal_separator, '.')

            return Decimal(cleaned_string)
        except (TypeError, ValueError, decimal.InvalidOperation):
            return Decimal('0')

# Create a singleton instance
currency_formatter = CurrencyFormatter()
