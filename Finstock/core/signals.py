from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order
from decimal import Decimal
from transactions.models import Transaction
from django.db import transaction
from django.core.exceptions import ValidationError
from users.constants import PermissionConstants
from django.core.exceptions import PermissionDenied
from users.models import CustomUser
import logging

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    logger.info(f"Order post_save signal triggered for Order {instance.id}")

    try:
        if not created and instance.previous_status != instance.status:
            logger.info(f"Order {instance.id} status changed from {instance.previous_status} to {instance.status}")
            
            # Only create transaction on status change to shipped/delivered
            if (instance.status in ['shipped', 'delivered'] and 
                instance.previous_status not in ['shipped', 'delivered']):
                
                if not Transaction.objects.filter(order=instance).exists():
                    transaction.on_commit(lambda: create_transaction_from_order(instance))
                    logger.info(f"Scheduled transaction creation for order {instance.id}")
                else:
                    logger.info(f"Transaction already exists for order {instance.id}")

    except Exception as e:
        logger.error(f"Error in order_post_save signal for Order {instance.id}: {str(e)}")

@transaction.atomic
def create_transaction_from_order(order):
    logger.info(f"Creating transaction for order {order.id}")
    try:
        # Refresh to ensure we have latest data
        order.refresh_from_db()

        if Transaction.objects.filter(order=order).exists():
            logger.info(f"Transaction already exists for order {order.id}")
            return

        user = order.sales_rep

        if not user.has_role_permission(PermissionConstants.TRANSACTION_CREATE):
            logger.error(f"User {user.username} does not have permission to create transactions")
            raise PermissionDenied("User does not have permission to create transactions")

        # Create transaction
        transaction = Transaction.objects.create(
            order=order,
            customer=order.customer,
            transaction_type='income',
            amount=order.total_price,
            date=order.shipped_date or order.order_date,
            payment_method='other',
            status='completed',
            category=order.transaction_category,
            description=f"Order #{order.id} by {order.sales_rep.get_full_name()}",
            created_by=user
        )
        logger.info(f"Successfully created transaction {transaction.id} for order {order.id}")
        return transaction

    except Exception as e:
        logger.error(f"Failed to create transaction for order {order.id}: {str(e)}")
        raise
