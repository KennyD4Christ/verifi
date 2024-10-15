import re
from django.core.exceptions import ValidationError

# Regular expression for validating email addresses
EMAIL_REGEX = re.compile(r"[^@]+@[^@]+\.[^@]+")


def validate_positive_number(value):
    """
    Validates that the given value is a positive number.

    Args:
        value (int, float): The value to validate.

    Raises:
        ValidationError: If the value is not a positive number.
    """
    if value <= 0:
        raise ValidationError({
            'error_code': 'invalid_positive_number',
            'message': 'The value must be a positive number.'
        })


def validate_non_empty_string(value):
    """
    Validates that the given value is a non-empty string.

    Args:
        value (str): The value to validate.

    Raises:
        ValidationError: If the value is an empty string.
    """
    if not isinstance(value, str) or not value.strip():
        raise ValidationError({
            'error_code': 'invalid_non_empty_string',
            'message': 'The value must be a non-empty string.'
        })


def validate_email(value):
    """
    Validates that the given value is a valid email address.

    Args:
        value (str): The value to validate.

    Raises:
        ValidationError: If the value is not a valid email address.
    """
    if not EMAIL_REGEX.match(value):
        raise ValidationError({
            'error_code': 'invalid_email',
            'message': 'The value must be a valid email address.'
        })
