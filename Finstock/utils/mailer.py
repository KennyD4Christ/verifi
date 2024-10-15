import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.core.mail.backends.smtp import EmailBackend
from django.core.mail import EmailMessage

logger = logging.getLogger(__name__)


def send_email(subject, message, recipient_list, fail_silently=False):
    """
    Sends an email with the given subject and message to the specified recipients.

    Args:
        subject (str): The subject of the email.
        message (str): The body of the email.
        recipient_list (list): A list of recipient email addresses.
        fail_silently (bool): Whether to suppress exceptions. Default is False.

    Raises:
        SMTPException: If there's an issue with the SMTP server or email sending.
        Exception: For any other unexpected errors.
    """
    email_backend = EmailBackend(
        host=settings.EMAIL_HOST,
        port=settings.EMAIL_PORT,
        username=settings.EMAIL_HOST_USER,
        password=settings.EMAIL_HOST_PASSWORD,
        use_tls=settings.EMAIL_USE_TLS,
        fail_silently=fail_silently,
    )

    email = EmailMessage(
        subject=subject,
        body=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipient_list,
        connection=email_backend,
    )

    try:
        email.send(fail_silently=fail_silently)
        logger.info(f"Email sent to {recipient_list}")
    except smtplib.SMTPException as e:
        logger.error(f"SMTPException occurred while sending email: {e}")
        if not fail_silently:
            raise
    except OSError as e:
        logger.error(f"OSError occurred while accessing the file system: {e}")
        if not fail_silently:
            raise
    except Exception as e:
        logger.error(f"An unexpected error occurred while sending email: {e}")
        if not fail_silently:
            raise


def send_html_email(subject, html_content, recipient_list, fail_silently=False):
    """
    Sends an HTML email with the given subject and content to the specified recipients.

    Args:
        subject (str): The subject of the email.
        html_content (str): The HTML body of the email.
        recipient_list (list): A list of recipient email addresses.
        fail_silently (bool): Whether to suppress exceptions. Default is False.

    Raises:
        SMTPException: If there's an issue with the SMTP server or email sending.
        Exception: For any other unexpected errors.
    """
    email_backend = EmailBackend(
        host=settings.EMAIL_HOST,
        port=settings.EMAIL_PORT,
        username=settings.EMAIL_HOST_USER,
        password=settings.EMAIL_HOST_PASSWORD,
        use_tls=settings.EMAIL_USE_TLS,
        fail_silently=fail_silently,
    )
    email = EmailMessage(
        subject=subject,
        body=html_content,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipient_list,
        connection=email_backend,
    )
    email.content_subtype = "html"

    try:
        email.send(fail_silently=fail_silently)
        logger.info(f"HTML email sent to {recipient_list}")
    except smtplib.SMTPException as e:
        logger.error(f"SMTPException occurred while sending HTML email: {e}")
        if not fail_silently:
            raise
    except OSError as e:
        logger.error(f"OSError occurred while accessing the file system: {e}")
        if not fail_silently:
            raise
    except Exception as e:
        logger.error(f"An unexpected error occurred while sending HTML email: {e}")
        if not fail_silently:
            raise
