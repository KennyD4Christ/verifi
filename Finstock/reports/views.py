from rest_framework import viewsets, filters, status
from django.utils.text import slugify
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from users.permissions import CanViewResource, CanManageResource
from .models import Report, ReportEntry, ReportFile, CalculatedField, ReportAccessLog
from rest_framework.permissions import IsAuthenticated
from .serializers import ReportSerializer, ReportEntrySerializer, ReportFileSerializer, CalculatedFieldSerializer, ReportAccessLogSerializer
from .utils import generate_pdf_report, send_report_email, export_report_to_csv, export_report_to_excel, calculate_custom_field
from django.core.cache import cache
from django.db.models import Q

class ReportViewSet(viewsets.ModelViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['created_by', 'is_archived', 'is_template']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date and end_date:
            queryset = queryset.filter(created_at__range=[start_date, end_date])
        
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, last_modified_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        ReportAccessLog.objects.create(report=instance, user=request.user, action='view')
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        report = self.get_object()
        pdf_file = generate_pdf_report(report)
        ReportAccessLog.objects.create(report=report, user=request.user, action='generate_pdf')
        return Response({'pdf_url': pdf_file.url})

    @action(detail=True, methods=['post'])
    def email_report(self, request, pk=None):
        report = self.get_object()
        recipient_email = request.data.get('email')
        if not recipient_email:
            return Response({'error': 'Recipient email is required.'}, status=400)
        send_report_email(report, recipient_email)
        ReportAccessLog.objects.create(report=report, user=request.user, action='email')
        return Response({'message': 'Report sent successfully.'})

    @action(detail=True, methods=['get'])
    def export_csv(self, request, pk=None):
        report = self.get_object()
        csv_file = export_report_to_csv(report)
        ReportAccessLog.objects.create(report=report, user=request.user, action='export_csv')
        return Response({'csv_url': csv_file.url})

    @action(detail=True, methods=['get'])
    def export_excel(self, request, pk=None):
        report = self.get_object()
        excel_file = export_report_to_excel(report)
        ReportAccessLog.objects.create(report=report, user=request.user, action='export_excel')
        return Response({'excel_url': excel_file.url})

    @action(detail=True, methods=['post'])
    def clone_template(self, request, pk=None):
        template = self.get_object()
        if not template.is_template:
            return Response({'error': 'This report is not a template.'}, status=400)
        
        # Generate a unique name for the new report
        base_name = f"Copy of {template.name}"
        name = base_name
        counter = 1
        while Report.objects.filter(name=name).exists():
            name = f"{base_name} ({counter})"
            counter += 1

        try:
            with transaction.atomic():
                new_report = Report.objects.create(
                    name=name,
                    description=template.description,
                    created_by=request.user,
                    last_modified_by=request.user
                )

                for entry in template.entries.all():
                    ReportEntry.objects.create(
                        report=new_report,
                        title=entry.title,
                        content=entry.content,
                        created_by=request.user,
                        last_modified_by=request.user,
                        order=entry.order
                    )

                serializer = self.get_serializer(new_report)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class ReportEntryViewSet(viewsets.ModelViewSet):
    queryset = ReportEntry.objects.all()
    serializer_class = ReportEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['report', 'created_by']
    search_fields = ['title', 'content']
    ordering_fields = ['created_at', 'updated_at', 'order']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, last_modified_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(last_modified_by=self.request.user)

class ReportFileViewSet(viewsets.ModelViewSet):
    queryset = ReportFile.objects.all()
    serializer_class = ReportFileSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['entry', 'uploaded_by']
    ordering_fields = ['uploaded_at']

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

class CalculatedFieldViewSet(viewsets.ModelViewSet):
    queryset = CalculatedField.objects.all()
    serializer_class = CalculatedFieldSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [CanViewResource]
        else:
            self.permission_classes = [CanManageResource]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['get'])
    def calculate(self, request, pk=None):
        calculated_field = self.get_object()
        result = calculate_custom_field(calculated_field)
        return Response({'result': result})

class ReportAccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ReportAccessLog.objects.all()
    serializer_class = ReportAccessLogSerializer
    permission_classes = [IsAuthenticated, CanViewResource]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['report', 'user', 'action']
    ordering_fields = ['accessed_at']
