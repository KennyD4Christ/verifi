from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Order
from decimal import Decimal
from transactions.models import Transaction
from django.db import transaction
from django.core.exceptions import ValidationError
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    logger.info(f"Order post_save signal triggered for Order {instance.id}")
    if created:
        logger.info(f"New Order {instance.id} created")
        instance.refresh_from_db()
        if instance.items.exists():
            logger.info(f"Order {instance.id} has {instance.items.count()} items")
            if instance.status in ['shipped', 'delivered']:
                create_transaction_from_order(instance)
        else:
            logger.warning(f"Order {instance.id} created with no items")
    elif instance.previous_status != instance.status:
        logger.info(f"Order {instance.id} status changed from {instance.previous_status} to {instance.status}")
        instance.update_stock()
        if instance.status in ['shipped', 'delivered']:
            create_transaction_from_order(instance)

@transaction.atomic
def create_transaction_from_order(order):
    logger.info(f"Creating transaction for order {order.id}")
    try:
        # Refresh the order from the database to ensure we have the latest data
        order.refresh_from_db()
        
        logger.info(f"Order {order.id} has {order.items.count()} items")
        
        total_price = order.total_price
        logger.info(f"Total price for order {order.id}: {total_price}")

        if not isinstance(total_price, Decimal):
            total_price = Decimal(str(total_price))

        if total_price <= Decimal('0'):
            logger.error(f"Order {order.id} has zero or negative total price: {total_price}")
            raise ValidationError(f"Order total price must be greater than zero. Current total: {total_price}")

        transaction = Transaction.objects.create(
            order=order,
            customer=order.customer,
            transaction_type='income',
            amount=total_price,
            date=order.shipped_date or order.order_date,
            payment_method='other',
            status='completed'
        )
        logger.info(f"Transaction {transaction.id} created successfully for order {order.id}")
    except ValidationError as e:
        logger.error(f"Validation error creating transaction for order {order.id}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error creating transaction for order {order.id}: {str(e)}")
        raise
