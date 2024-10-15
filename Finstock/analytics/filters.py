from django_filters import rest_framework as filters
from django.utils import timezone
from datetime import timedelta
from transactions.models import Transaction
from core.models import Order

class BaseDateRangeFilter(filters.FilterSet):
    start_date = filters.DateFilter(field_name="date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="date", lookup_expr="lt", method='filter_end_date')

    def filter_end_date(self, queryset, name, value):
        return queryset.filter(**{f"{name}__lt": value + timedelta(days=1)})

class TransactionDateRangeFilter(BaseDateRangeFilter):
    class Meta:
        model = Transaction
        fields = ['start_date', 'end_date']

class OrderDateRangeFilter(BaseDateRangeFilter):
    start_date = filters.DateFilter(field_name="order_date", lookup_expr="gte")
    end_date = filters.DateFilter(field_name="order_date", lookup_expr="lt", method='filter_end_date')

    class Meta:
        model = Order
        fields = ['start_date', 'end_date']
