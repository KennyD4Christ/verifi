from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils.timezone import make_aware, utc, now
from django.db.models import Q
from core.models import Visit
from django.utils.dateparse import parse_date
from products.models import Product
from transactions.models import Transaction
from products.serializers import ProductSerializer
from transactions.serializers import TransactionSerializer
from rest_framework import status
from django.db.models import Sum
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

            queryset = Product.objects.all()
            if start_date:
                start_date = make_aware(datetime.combine(parse_date(start_date), datetime.min.time()), timezone=utc)
                queryset = queryset.filter(order_items__order__order_date__gte=start_date)
            if end_date:
                end_date = make_aware(datetime.combine(parse_date(end_date), datetime.max.time()), timezone=utc)
                queryset = queryset.filter(order_items__order__order_date__lte=end_date)

            top_products = queryset.annotate(
                total_sales=Sum('order_items__quantity')
            ).order_by('-total_sales')[:10]

            logger.debug(f"Found {top_products.count()} top products")
            serializer = ProductSerializer(top_products, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in TopProductsView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RecentTransactionsView(APIView):
    permission_classes = [IsAuthenticated]
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = DateRangeFilter

    def get(self, request, *args, **kwargs):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        queryset = Transaction.objects.all()
        if start_date:
            start_date = make_aware(datetime.combine(parse_date(start_date), datetime.min.time()), timezone=utc)
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            end_date = make_aware(datetime.combine(parse_date(end_date), datetime.max.time()), timezone=utc)
            queryset = queryset.filter(date__lte=end_date)

        recent_transactions = queryset.order_by('-date')[:10]
        serializer = TransactionSerializer(recent_transactions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConversionRateDataView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')

            if not start_date_str or not end_date_str:
                return Response(
                    {"error": "start_date and end_date parameters are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Parse dates and validate format
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
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

            # Count the number of visits within the date range
            total_visitors = Visit.objects.filter(
                timestamp__date__range=[start_date, end_date]
            ).count() or 1  # To avoid division by zero

            # Count the number of transactions (sales) within the date range
            conversions = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='sale'
            ).count()

            # Calculate the conversion rate
            conversion_rate = (conversions / total_visitors) * 100

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
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            revenue = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='sale'
            ).aggregate(total_revenue=Sum('amount'))['total_revenue'] or 0

            cogs = Transaction.objects.filter(
                date__range=[start_date, end_date],
                transaction_type='purchase'
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
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InventoryLevelsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.debug("InventoryLevelsView accessed")
        try:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            queryset = Product.objects.all()
            if start_date:
                start_date = make_aware(datetime.combine(parse_date(start_date), datetime.min.time()), timezone=utc)
                queryset = queryset.filter(stock_adjustments__adjustment_date__gte=start_date)
            if end_date:
                end_date = make_aware(datetime.combine(parse_date(end_date), datetime.max.time()), timezone=utc)
                queryset = queryset.filter(stock_adjustments__adjustment_date__lte=end_date)

            # Use distinct to ensure no duplicates due to multiple stock adjustments
            inventory_items = queryset.distinct()
            serializer = ProductSerializer(inventory_items, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in InventoryLevelsView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class CashFlowView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        logger.debug("CashFlowView accessed")
        try:
            start_date_param = request.query_params.get('start_date')
            end_date_param = request.query_params.get('end_date')

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
            ).values('date').annotate(
                balance=Sum('amount')
            ).order_by('date')

            return Response(list(cash_flow), status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error in CashFlowView: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
