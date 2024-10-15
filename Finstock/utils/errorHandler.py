import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.exceptions import APIException

logger = logging.getLogger('custom_logger')


def custom_exception_handler(exc, context):
    """
    Custom exception handler that adds custom error codes and
    uses different logging levels based on the exception type.
    """
    response = exception_handler(exc, context)

    if response is not None:
        # Add custom error code based on exception type
        custom_response_data = {
            'error_code': get_custom_error_code(exc),
            'message': get_error_message(exc)
        }
        response.data.update(custom_response_data)

        # Log the error with appropriate logging level
        if isinstance(exc, (DjangoValidationError, DRFValidationError)):
            logger.warning(f"Validation error: {exc}")
        else:
            logger.error(f"Unhandled error: {exc}")

        return response

    # If the exception is not handled by DRF's default handler, create a generic response
    response = Response(
        {'error_code': 'unknown_error', 'message': 'An unknown error occurred'},
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )
    logger.error(f"Unhandled exception: {exc}")
    return response


def get_custom_error_code(exc):
    """
    Returns a custom error code based on the exception type.
    """
    if isinstance(exc, DjangoValidationError):
        return 'validation_error'
    elif isinstance(exc, DRFValidationError):
        return 'drf_validation_error'
    elif isinstance(exc, APIException):
        return exc.get_codes()
    else:
        return 'unknown_error'


def get_error_message(exc):
    """
    Returns a user-friendly error message based on the exception type.
    """
    if isinstance(exc, DjangoValidationError) or isinstance(exc, DRFValidationError):
        return 'There was an issue with the data provided.'
    elif isinstance(exc, APIException):
        return exc.detail
    else:
        return 'An unexpected error occurred. Please try again later.'
