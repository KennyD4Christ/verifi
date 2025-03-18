import logging
from django.core.mail import mail_admins

# Get the custom logger and the logger for logging failures
logger = logging.getLogger('custom_logger')
logging_failure_logger = logging.getLogger('logging_failure')


def log_info(message):
    try:
        logger.info(message)
    except OSError as e:
        handle_logging_failure(e, "INFO", message)
    except Exception as e:
        handle_logging_failure(e, "INFO", message)


def log_error(message):
    try:
        logger.error(message)
    except OSError as e:
        handle_logging_failure(e, "ERROR", message)
    except Exception as e:
        handle_logging_failure(e, "ERROR", message)


def log_debug(message):
    try:
        logger.debug(message)
    except OSError as e:
        handle_logging_failure(e, "DEBUG", message)
    except Exception as e:
        handle_logging_failure(e, "DEBUG", message)


def handle_logging_failure(exception, log_level, original_message):
    """
    Handles logging failures by logging the error to a separate logger
    and sending an email notification to the admins.
    """
    failure_message = (
        f"Failed to log {log_level} message: {original_message}\n"
        f"Exception: {exception}"
    )
    logging_failure_logger.error(failure_message)
    notify_admins(failure_message)


def notify_admins(message):
    """
    Send an email to admins when logging fails.
    """
    mail_admins("Logging Failure", message)
