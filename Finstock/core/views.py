from django.db.models import Q, DateTimeField
from django.core.exceptions import ValidationError
from django.db import transaction, connection
from django.shortcuts import render  # noqa
from rest_framework import viewsets, permissions, status, filters as drf_filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.shortcuts import get_object_or_404  # noqa
from rest_framework.serializers import ValidationError as DRFValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet
from django_filters import rest_framework as filters
from rest_framework.pagination import PageNumberPagination
from django.utils import timezone
from django.utils.timezone import make_aware, utc
from datetime import datetime, timedelta
from django.utils.dateparse import parse_date
from .models import Customer, Order, OrderItem, Address, CompanyInfo, Promotion
from products.models import Product
from .signals import create_transaction_from_order
from .serializers import (
    CustomerSerializer,
    OrderSerializer,
    OrderItemSerializer,
    AddressSerializer,
    CompanyInfoSerializer,
    PromotionSerializer
)
from users.views import BaseAccessControlViewSet
from users.permissions import DynamicModelPermission
from users.permissions import CanViewResource, CanManageResource, SuperuserOrReadOnly
from users.constants import PermissionConstants
from users.models import CustomUser
import logging

logger = logging.getLogger(__name__)


class DateRangeFilter(filters.FilterSet):
    start_date = filters.DateFilter(field_name="order_date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="order_date", lookup_expr="lte")

    class Meta:
        model = Order
        fields = ['start_date', 'end_date']

    def filter_queryset(self, queryset):
        start_date = self.form.cleaned_data.get('start_date')
        end_date = self.form.cleaned_data.get('end_date')

        if start_date:
            start_date = make_aware(datetime.combine(start_date, datetime.min.time()), timezone=utc)
            queryset = queryset.filter(order_date__gte=start_date)

        if end_date:
            end_date = make_aware(datetime.combine(end_date, datetime.max.time()), timezone=utc)
            queryset = queryset.filter(order_date__lte=end_date)

        return queryset


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CustomerViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing customer instances.
    """
    serializer_class = CustomerSerializer
    queryset = Customer.objects.all()
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def search(self, request):
        query = request.query_params.get('query', '')
        customers = self.queryset.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(email__icontains=query)
        )[:10]  # Limit to 10 results for performance
        serializer = self.get_serializer(customers, many=True)
        return Response(serializer.data)


class CompanyInfoViewSet(viewsets.ModelViewSet):
    queryset = CompanyInfo.objects.all()
    serializer_class = CompanyInfoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Ensure only one CompanyInfo instance exists
        company_info = CompanyInfo.objects.first()
        if not company_info:
            company_info = CompanyInfo.objects.create(name="Default Company", address="Default Address", phone="Default Phone")
        return CompanyInfo.objects.all()


class OrderViewSet(BaseAccessControlViewSet):
    queryset = Order.objects.prefetch_related('items__product').all()
    serializer_class = OrderSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, drf_filters.SearchFilter, drf_filters.OrderingFilter]
    filterset_class = DateRangeFilter
    filterset_fields = ['status', 'order_date', 'shipped_date', 'is_paid']
    search_fields = ['customer__user__first_name', 'customer__user__last_name', 'customer__user__email', 'id']
    ordering_fields = ['order_date', 'shipped_date', 'status', 'total_price']

    model = Order
    model_name = 'order'

    # Map the new Order-specific permissions
    view_permission = PermissionConstants.ORDER_VIEW
    create_permission = PermissionConstants.ORDER_CREATE
    edit_permission = PermissionConstants.ORDER_EDIT
    delete_permission = PermissionConstants.ORDER_DELETE

    def apply_role_based_filtering(self):
        # Implement role-specific filtering logic
        user = self.request.user

        # If user is Sales Representative, show only their own orders
        if user.role.name == 'Sales Representative':
            return self.model.objects.filter(created_by=user)

        # If user is Inventory Manager, show orders related to their inventory
        elif user.role.name == 'Inventory Manager':
            return self.model.objects.filter(
                items__product__in=Product.objects.filter(managed_by=user)
            ).distinct()

        # Default to standard queryset for other roles
        return self.model.objects.all()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except ValidationError as e:
            logger.error(f"Validation error in create: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error in create: {str(e)}")
            return Response({"error": "An unexpected error occurred"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def perform_create(self, serializer):
        logger.debug(f"perform_create called with validated data: {serializer.validated_data}")
        try:
            # Ensure only users with specific roles can create orders
            allowed_roles = ['Sales Representative', 'Administrator']
            if not self.request.user.role.name in allowed_roles:
                logger.warning(f"Unauthorized order creation attempt by user {self.request.user.username}")
                raise PermissionDenied("You are not authorized to create orders")

            # Save the order and set user to the current user
            order = serializer.save(user=self.request.user)

            logger.info(f"Order created successfully. ID: {order.id}")
            logger.debug(f"Order {order.id} items: {list(order.items.all()) if hasattr(order, 'items') else 'No items related.'}")

            # Generate an invoice for the order
            if hasattr(order, 'create_invoice'):
                order.create_invoice()
            else:
                logger.warning(f"Order {order.id} does not have a 'create_invoice' method implemented.")

            # Create a transaction if the order's status warrants it
            if order.status in ['shipped', 'delivered']:
                create_transaction_from_order(order)

        except ValidationError as e:
            logger.error(f"Error creating order: {str(e)}")
            raise DRFValidationError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error creating order: {str(e)}")
            raise

    def get_queryset(self):
        queryset = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            start_date = make_aware(datetime.combine(parse_date(start_date), datetime.min.time()), timezone=utc)
            queryset = queryset.filter(order_date__gte=start_date)

        if end_date:
            end_date = make_aware(datetime.combine(parse_date(end_date), datetime.max.time()), timezone=utc)
            queryset = queryset.filter(order_date__lte=end_date)

        # Role-based queryset filtering
        user = self.request.user

        # Administrator: full access to all orders
        if user.is_superuser or user.is_role('Administrator'):
            pass  # No additional filtering

        # Sales Representative: can only view their own orders
        elif user.is_role('Sales Representative'):
            queryset = queryset.filter(user=user)

        # Accountant: view all orders (maintains date filtering)
        elif user.is_role('Accountant'):
            pass  # No additional filtering needed

        # Auditor: view all orders (maintains date filtering)
        elif user.is_role('Auditor'):
            pass  # No additional filtering needed

        # Inventory Manager: no order access
        elif user.is_role('Inventory Manager'):
            queryset = queryset.none()

        # Default: no access
        else:
            queryset = queryset.none()

        if self.action == 'list':
            return queryset.prefetch_related('items__product')
        return queryset


    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)

    
    @transaction.atomic
    def perform_update(self, serializer):
        try:
            user = self.request.user

            # Implement more granular update permissions
            if not (
                user.role.name in ['Sales Representative', 'Administrator'] or
                (user.role.name == 'Sales Representative' and serializer.instance.user == user)
            ):
                logger.warning(f"Unauthorized order update attempt by user {user.username}")
                raise PermissionDenied("You are not authorized to update this order")

            # Save the order with user field tracking the modifier
            order = serializer.save(user=user)

            # Handle stock update and invoice creation based on status change
            if order.status in ['shipped', 'delivered'] and order.previous_status not in ['shipped', 'delivered']:
                if hasattr(order, 'update_stock'):
                    order.update_stock()
                else:
                    logger.warning(f"Order {order.id} does not have an 'update_stock' method implemented.")

                if hasattr(order, 'create_invoice'):
                    order.create_invoice()
                else:
                    logger.warning(f"Order {order.id} does not have a 'create_invoice' method implemented.")

        except ValidationError as e:
            logger.error(f"Error updating order: {str(e)}")
            raise DRFValidationError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error updating order: {str(e)}")
            raise

    @action(detail=False, methods=['post'])
    def bulk_delete(self, request):
        ids = request.data.get('ids', [])
        if not ids:
            return Response({"error": "No IDs provided"}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(id__in=ids)
        if not request.user.is_staff:
            queryset = queryset.filter(customer__user=request.user)

        deleted_count, _ = queryset.delete()

        return Response({
            "message": f"Successfully deleted {deleted_count} order(s)",
            "deleted_count": deleted_count
        })

    @action(detail=False, methods=['get'])
    def history(self, request):
        orders = self.filter_queryset(self.get_queryset()).order_by('-order_date')
        page = self.paginate_queryset(orders)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reorder(self, request, pk=None):
        old_order = self.get_object()
        new_order = Order.objects.create(
            customer=old_order.customer,
            shipping_address=old_order.shipping_address,
            billing_address=old_order.billing_address,
            special_instructions=old_order.special_instructions
        )
        for item in old_order.items.all():
            if item.product.stock >= item.quantity:
                OrderItem.objects.create(
                    order=new_order,
                    product=item.product,
                    quantity=item.quantity,
                    unit_price=item.product.price,
                    customization=item.customization
                )
            else:
                new_order.delete()
                return Response({"error": f"Insufficient stock for {item.product.name}"}, status=status.HTTP_400_BAD_REQUEST)
        serializer = self.get_serializer(new_order)
        return Response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        logger.info(f"Order data being returned: {data}")
        return Response(data)

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            logger.info(f"Orders data being returned: {serializer.data}")
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        logger.info(f"Orders data being returned: {serializer.data}")
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def apply_promotion(self, request, pk=None):
        order = self.get_object()
        promotion_code = request.data.get('promotion_code')
        try:
            promotion = Promotion.objects.get(code=promotion_code, is_active=True, valid_from__lte=timezone.now(), valid_to__gte=timezone.now())
            order.promotions.add(promotion)
            return Response({"message": "Promotion applied successfully"})
        except Promotion.DoesNotExist:
            return Response({"error": "Invalid or expired promotion code"}, status=status.HTTP_400_BAD_REQUEST)


class OrderItemViewSet(viewsets.ModelViewSet):
    queryset = OrderItem.objects.select_related('product').all()
    serializer_class = OrderItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        order_id = self.request.query_params.get('order_id')
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        return queryset

class OrderDetailViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Order.objects.prefetch_related('items__product')
    serializer_class = OrderSerializer


class PromotionViewSet(viewsets.ModelViewSet):
    queryset = Promotion.objects.all()
    serializer_class = PromotionSerializer
    permission_classes = [permissions.IsAdminUser]


class AddressViewSet(viewsets.ModelViewSet):
    """
    A viewset for viewing and editing address instances.
    """
    serializer_class = AddressSerializer
    queryset = Address.objects.all()
    permission_classes = [permissions.IsAuthenticated]
