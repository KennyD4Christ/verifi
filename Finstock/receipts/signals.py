from django.db.models.signals import post_save
from django.dispatch import receiver
from invoices.models import Invoice
from receipts.models import Receipt
import logging
logger = logging.getLogger(__name__)

@receiver(post_save, sender=Invoice)
def create_receipt_for_paid_invoice(sender, instance, created, **kwargs):
    from django.utils import timezone
    import logging
    from django.db import transaction
    logger = logging.getLogger(__name__)

    logger.info(f"Signal handler triggered for invoice {instance.id}, status: {instance.status}")
    
    # Skip receipt creation via signal if we're inside a transaction
    # This prevents race conditions with the direct creation method
    if transaction.get_connection().in_atomic_block:
        logger.info(f"Signal handler: Skipping receipt creation for invoice {instance.id} since we're in a transaction block")
        return
    
    if instance.status == 'paid':
        from receipts.models import Receipt
        try:
            # Use select_for_update to lock the row during checking
            with transaction.atomic():
                # Check if receipt exists with row lock to prevent race conditions
                existing_receipt = Receipt.objects.filter(invoice=instance).select_for_update(nowait=True).first()
                if existing_receipt:
                    logger.info(f"Signal handler: Receipt {existing_receipt.receipt_number} already exists for Invoice {instance.invoice_number}")
                    return
                    
                # Create receipt since none exists
                receipt = Receipt.objects.create(
                    user=instance.user,
                    invoice=instance,
                    amount_paid=instance.total_amount,
                    payment_date=timezone.now(),
                    payment_method='online',
                    notes="Automatically generated receipt for paid invoice via signal"
                )
                logger.info(f"Signal handler: Receipt {receipt.receipt_number} created for Invoice {instance.invoice_number}")
                    
        except Exception as e:
            logger.error(f"Signal handler: Error creating receipt for paid invoice {instance.invoice_number}: {str(e)}", exc_info=True)
