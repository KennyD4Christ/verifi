from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.timezone import make_aware, utc, now
from core.models import Visit
from django.utils.dateparse import parse_date
from products.models import Product
from transactions.models import Transaction
from products.serializers import ProductSerializer, TopProductSerializer
from transactions.serializers import TransactionSerializer
from django.db.models import Sum, Case, When, F, DecimalField, Q, IntegerField
from django.db.models.functions import TruncDate, Coalesce
from rest_framework import status
import traceback
from django_filters import rest_framework as filters
from datetime import datetime, timedelta, time
import logging

logger = logging.getLogger(__name__)

class DateRangeFilter(filters.FilterSet):
    start_date = filters.DateFilter(field_name="date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = Transaction
        fields = ['start_date', 'end_date']

    def filter_queryset(self, queryset):
        start_date = self.form.cleaned_data.get('start_date')
        end_date = self.form.cleaned_data.get('end_date')

        if start_date:
            start_date = make_aware(datetime.combine(start_date, datetime.min.time()), timezone=utc)
            queryset = queryset.filter(date__gte=start_date)

        if end_date:
            end_date = make_aware(datetime.combine(end_date, datetime.max.time()), timezone=utc)
            queryset = queryset.filter(date__lte=end_date)

        return queryset

class TopProductsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.debug("TopProductsView accessed")
        try:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            logger.debug(f"Received date params - start_date: {start_date}, end_date: {end_date}")
            
            # Initialize base queryset
            queryset = Product.objects.filter(is_active=True)
            
            # Build date range filter
            date_filters = Q()
            if start_date:
                parsed_start = parse_date(start_date)
                start_datetime = make_aware(datetime.combine(parsed_start, datetime.min.time()), timezone=utc)
                date_filters &= Q(order_items__order__order_date__gte=start_datetime)
                logger.debug(f"Start datetime filter: {start_datetime}")
            
            if end_date:
                parsed_end = parse_date(end_date)
                end_datetime = make_aware(datetime.combine(parsed_end, datetime.max.time()), timezone=utc)
                date_filters &= Q(order_items__order__order_date__lte=end_datetime)
                logger.debug(f"End datetime filter: {end_datetime}")

            # Add order status filter to only count completed orders
            date_filters &= Q(order_items__order__status__in=['delivered', 'shipped'])
            
            # Apply annotations with proper filtering and grouping
            top_products = queryset.annotate(
                total_sales=Coalesce(
                    Sum(
                        Case(
                            When(
                                order_items__order__status__in=['delivered', 'shipped'],
                                then='order_items__quantity'
                            ),
                            default=0,
                            output_field=IntegerField(),
                        ),
                        filter=date_filters
                    ),
                    0,
                    output_field=IntegerField()
                ),
                total_revenue=Coalesce(
                    Sum(
                        Case(
                            When(
                                order_items__order__status__in=['delivered', 'shipped'],
                                then=F('order_items__quantity') * F('order_items__unit_price')
                            ),
                            default=0,
                            output_field=DecimalField(max_digits=10, decimal_places=2)
                        ),
                        filter=date_filters
                    ),
                    0,
                    output_field=DecimalField(max_digits=10, decimal_places=2)
                )
            ).filter(
                Q(total_sales__gt=0) | Q(total_revenue__gt=0)
            ).order_by('-total_sales')[:10]
            
            # Debug the generated query
            logger.debug(f"SQL Query: {top_products.query}")
            logger.debug(f"Found {top_products.count()} top products")
            
            # Verify calculations for each product
            for product in top_products:
                logger.debug(f"Product {product.id} - {product.name}:")
                logger.debug(f"Total Sales: {product.total_sales}")
                logger.debug(f"Total Revenue: {product.total_revenue}")
            
            serializer = TopProductSerializer(top_products, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error in TopProductsView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RecentTransactionsView(APIView):
    permission_classes = [IsAuthenticated]
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = DateRangeFilter

    def get(self, request, *args, **kwargs):
        logger.debug("RecentTransactionsView accessed")
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        logger.debug(f"Raw date params received - start_date: {start_date}, end_date: {end_date}")

        queryset = Transaction.objects.all()
        if start_date:
            parsed_start = parse_date(start_date)
            start_datetime = make_aware(datetime.combine(parsed_start, datetime.min.time()), timezone=utc)
            logger.debug(f"Parsed start_date: {parsed_start}, start_datetime: {start_datetime}")
            queryset = queryset.filter(date__gte=start_datetime)
        if end_date:
            parsed_end = parse_date(end_date)
            end_datetime = make_aware(datetime.combine(parsed_end, datetime.max.time()), timezone=utc)
            logger.debug(f"Parsed end_date: {parsed_end}, end_datetime: {end_datetime}")
            queryset = queryset.filter(date__lte=end_datetime)

        logger.debug(f"Generated query: {str(queryset.query)}")

        results = list(queryset)
        logger.debug(f"Query returned {len(results)} results")

        recent_transactions = queryset.order_by('-date')[:10]
        serializer = TransactionSerializer(recent_transactions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConversionRateDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.debug("ConversionRateDataView accessed")
        try:
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')

            if not start_date_str or not end_date_str:
                return Response(
                    {"error": "start_date and end_date parameters are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                start_date = make_aware(datetime.strptime(start_date_str, '%Y-%m-%d'))
                end_date = make_aware(datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59))
            except ValueError:
                return Response(
                    {"error": "start_date and end_date must be in YYYY-MM-DD format."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if start_date > end_date:
                return Response(
                    {"error": "start_date cannot be after end_date."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            total_visitors = Visit.objects.filter(
                timestamp__range=[start_date, end_date]
            ).count()

            conversions = Transaction.objects.filter(
                date__range=[start_date, end_date],
                status='completed'
            ).count()

            if total_visitors > 0:
                conversion_rate = (conversions / total_visitors) * 100
            else:
                conversion_rate = 0

            conversion_rate_data = {
                'total_visitors': total_visitors,
                'conversions': conversions,
                'conversion_rate': round(conversion_rate, 2)
            }

            return Response(conversion_rate_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in ConversionRateDataView: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class NetProfitDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            logger.debug("NetProfitDataView accessed")
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')

            logger.debug(f"Raw date params received - start_date: {start_date_str}, end_date: {end_date_str}")

            # Validate required parameters
            if not start_date_str or not end_date_str:
                return Response(
                    {"error": "start_date and end_date parameters are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            try:
                start_date = make_aware(datetime.strptime(start_date_str, '%Y-%m-%d'))
                end_date = make_aware(datetime.strptime(end_date_str, '%Y-%m-%d').replace(hour=23, minute=59, second=59))
            except ValueError:
                return Response(
                    {"error": "start_date and end_date must be in YYYY-MM-DD format."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            if start_date > end_date:
                return Response(
                    {"error": "start_date cannot be after end_date."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            revenue = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='income'
            ).aggregate(total_revenue=Sum('amount'))['total_revenue'] or 0

            cogs = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='cost_of_services'
            ).aggregate(total_cogs=Sum('amount'))['total_cogs'] or 0

            operating_expenses = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='expense'
            ).aggregate(total_expenses=Sum('amount'))['total_expenses'] or 0

            net_profit = revenue - cogs - operating_expenses

            net_profit_data = {
                'revenue': revenue,
                'cogs': cogs,
                'operating_expenses': operating_expenses,
                'net_profit': net_profit
            }

            return Response(net_profit_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in NetProfitDataView: {str(e)}")
            return Response(
                {"error": "An error occurred while processing your request."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InventoryLevelsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.info("=== Starting InventoryLevelsView.get ===")
        logger.info(f"Request params: {request.query_params}")
        logger.info(f"Request user: {request.user}")

        try:
            # Extract and validate date parameters
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')
            
            logger.debug(f"Processing date range: {start_date} to {end_date}")

            # Basic queryset to verify database connection
            try:
                # First, test if we can access the Product model at all
                test_query = Product.objects.first()
                logger.info(f"Initial product query successful: {test_query is not None}")
            except Exception as db_error:
                logger.error(f"Database connection error: {str(db_error)}")
                logger.error(traceback.format_exc())
                return Response({
                    "error": "Database connection error",
                    "detail": str(db_error)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Initialize the base queryset
            queryset = Product.objects.all()
            logger.info(f"Base queryset created successfully")

            # Apply date filters if provided
            if start_date and end_date:
                try:
                    parsed_start = parse_date(start_date)
                    parsed_end = parse_date(end_date)
                    
                    if not parsed_start or not parsed_end:
                        return Response({
                            "error": "Invalid date format",
                            "detail": "Dates must be in YYYY-MM-DD format"
                        }, status=status.HTTP_400_BAD_REQUEST)

                    start_datetime = make_aware(datetime.combine(parsed_start, datetime.min.time()))
                    end_datetime = make_aware(datetime.combine(parsed_end, datetime.max.time()))
                    
                    logger.debug(f"Parsed date range: {start_datetime} to {end_datetime}")
                    
                    # Log the query before execution
                    queryset = queryset.filter(
                        stock_adjustments__adjustment_date__gte=start_datetime,
                        stock_adjustments__adjustment_date__lte=end_datetime
                    )
                    logger.debug(f"Query SQL: {queryset.query}")
                    
                except Exception as date_error:
                    logger.error(f"Date processing error: {str(date_error)}")
                    logger.error(traceback.format_exc())
                    return Response({
                        "error": "Date processing error",
                        "detail": str(date_error)
                    }, status=status.HTTP_400_BAD_REQUEST)

            try:
                # Execute query with distinct to avoid duplicates
                inventory_items = queryset.distinct()
                
                # Log the count before serialization
                items_count = inventory_items.count()
                logger.info(f"Query returned {items_count} items")
                
                # Verify serializer is imported and accessible
                from .serializers import ProductSerializer
                serializer = ProductSerializer(inventory_items, many=True)
                
                logger.info("=== Successfully completed InventoryLevelsView.get ===")
                return Response({
                    "data": serializer.data,
                    "count": items_count
                }, status=status.HTTP_200_OK)
                
            except Exception as query_error:
                logger.error(f"Query execution error: {str(query_error)}")
                logger.error(traceback.format_exc())
                return Response({
                    "error": "Query execution error",
                    "detail": str(query_error)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except ImportError as import_error:
            logger.error(f"Import error: {str(import_error)}")
            logger.error(traceback.format_exc())
            return Response({
                "error": "Configuration error",
                "detail": "Required models or serializers not found"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                "error": "Unexpected error",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CashFlowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.debug("CashFlowView accessed")
        try:
            start_date_param = request.query_params.get('start_date')
            end_date_param = request.query_params.get('end_date')

            logger.debug(f"Raw date params received - start_date: {start_date_param}, end_date: {end_date_param}")

            # Use current month as default if no dates are provided
            if not start_date_param:
                start_date = now().replace(day=1)
            else:
                start_date = datetime.strptime(start_date_param, "%Y-%m-%d").date()

            if not end_date_param:
                end_date = now().date()
            else:
                end_date = datetime.strptime(end_date_param, "%Y-%m-%d").date()

            start_datetime = make_aware(datetime.combine(start_date, time.min))
            end_datetime = make_aware(datetime.combine(end_date, time.max))

            cash_flow = Transaction.objects.filter(
                date__range=[start_datetime, end_datetime]
            ).annotate(
                trunc_date=TruncDate('date')
            ).values('trunc_date').annotate(
                balance=Sum(Case(
                    When(transaction_type='income', then=F('amount')),
                    When(transaction_type__in=['expense', 'cost_of_services'], then=-F('amount')),
                    output_field=DecimalField()
                ))
            ).order_by('trunc_date')

            # Calculate cumulative balance
            cumulative_balance = 0
            for entry in cash_flow:
                cumulative_balance += entry['balance']
                entry['cumulative_balance'] = cumulative_balance

            return Response(list(cash_flow), status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in CashFlowView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
