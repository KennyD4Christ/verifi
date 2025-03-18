from rest_framework import viewsets, filters, status
from rest_framework import serializers
from django.utils.text import slugify
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from users.views import BaseAccessControlViewSet
from users.constants import PermissionConstants
from users.models import CustomUser
from django.http import FileResponse
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.exceptions import ValidationError
from django.core.exceptions import PermissionDenied
from .models import Report, ReportEntry, ReportFile, CalculatedField, ReportAccessLog
from rest_framework.permissions import IsAuthenticated
from .serializers import ReportSerializer, ReportEntrySerializer, ReportFileSerializer, CalculatedFieldSerializer, ReportAccessLogSerializer
from .utils import generate_pdf_report, send_report_email, export_styled_report, export_report_to_excel, calculate_custom_field, save_generated_file, validate_date_range, EmailRecipient, ReportContentGenerator, send_enhanced_report_email, _generate_email_content
from django.core.cache import cache
from django.db.models import Q
import logging
import traceback
from datetime import datetime
from django.utils.timezone import make_aware
from django.contrib.auth import get_user_model
import mimetypes
from django.http import HttpResponse

logger = logging.getLogger(__name__)

class ReportViewSet(BaseAccessControlViewSet):
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['created_by', 'is_archived', 'is_template']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'updated_at', 'name']

    model = Report
    model_name = 'report'


    def get_queryset(self):
        queryset = super().get_queryset()
        logger.debug(f"Base queryset count: {queryset.count()}")
    
        # Skip date filtering for PDF generation endpoint
        if self.action in ['generate_pdf', 'export_csv']:
            return queryset
        
        # Apply date filtering only for list/retrieve actions
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
    
        if start_date and end_date:
            logger.debug(f"Applying date range filter: {start_date} to {end_date}")
            queryset = queryset.filter(created_at__range=[start_date, end_date])
            logger.debug(f"Filtered queryset count: {queryset.count()}")
    
        return queryset

    # Permissions aligned with initialize_system_roles.py
    view_permission = PermissionConstants.REPORT_VIEW
    create_permission = PermissionConstants.REPORT_CREATE
    edit_permission = PermissionConstants.REPORT_EDIT
    delete_permission = PermissionConstants.REPORT_DELETE

    def apply_role_based_filtering(self):
        """
        Apply role-specific filtering to the queryset
        Handles multiple roles with granular permission checks
        """
        user = self.request.user

        # Superuser always sees everything
        if user.is_superuser:
            return self.model.objects.all()

        # Check if user has Administrator role (full access)
        if user.is_role('Administrator'):
            return self.model.objects.all()

        # Check if user has Auditor role (view-only access)
        if user.is_role('Auditor'):
            return self.model.objects.filter(
                **{self.view_permission: True}
            )

        # Default: no access
        return self.model.objects.none()

    def process_date_range(self, request_data):
        """Process and validate date range from request data."""
        try:
            # Check for date range in the nested name object first
            name_data = request_data.get('name', {})
            if isinstance(name_data, dict):
                start_date = name_data.get('startDate') or name_data.get('start_date')
                end_date = name_data.get('endDate') or name_data.get('end_date')
            else:
                # Fall back to checking the root level of request data
                start_date = request_data.get('startDate') or request_data.get('start_date')
                end_date = request_data.get('endDate') or request_data.get('end_date')

            if start_date and end_date:
                validated_start, validated_end = validate_date_range(start_date, end_date)
                return validated_start, validated_end

            logger.info(f"No date range found in request data: {request_data}")
            return None, None

        except Exception as e:
            logger.error(f"Error processing date range: {str(e)}")
            logger.error(f"Request data: {request_data}")
            return None, None

    def create(self, request, *args, **kwargs):
        """
        Enhanced create method with comprehensive error tracking.
        """
        try:
            # Log comprehensive request details
            logger.info(f"Create Report Request Details:")
            logger.info(f"User: {request.user}")
            logger.info(f"Request Data: {request.data}")
            logger.info(f"User Permissions: {request.user.get_all_permissions()}")

            # Validate basic request structure
            if not request.data:
                logger.warning("Empty request data received")
                return Response({
                    'error': 'Invalid Request',
                    'details': 'No data provided'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Extract date range from request data if provided
            data = request.data.copy()
            start_date = data.pop('start_date', None)
            end_date = data.pop('end_date', None)

            # Validate date range if provided
            if start_date and end_date:
                try:
                    start_date, end_date = validate_date_range(start_date, end_date)
                    # Store validated dates in request for use in perform_create
                    request.validated_date_range = {
                        'start_date': start_date,
                        'end_date': end_date
                    }
                except ValidationError as ve:
                    logger.error(f"Date range validation error: {str(ve)}")
                    return Response({
                        'error': 'Invalid date range',
                        'details': str(ve)
                    }, status=status.HTTP_400_BAD_REQUEST)

            # Proceed with standard creation
            return super().create(request, *args, **kwargs)

        except serializers.ValidationError as ve:
            # Handle serializer-specific validation errors
            logger.error(f"Validation Error: {str(ve)}")
            logger.error(f"Validation Traceback: {traceback.format_exc()}")
            
            return Response({
                'error': 'Validation Failed',
                'details': str(ve)
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            # Catch-all for unexpected errors
            logger.error(f"Unexpected Report Creation Error: {str(e)}")
            logger.error(f"Full Traceback: {traceback.format_exc()}")
            
            return Response({
                'error': 'Server Error',
                'details': 'An unexpected error occurred during report creation'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @transaction.atomic
    def perform_create(self, serializer):
        if not self.request.user.is_authenticated:
            logger.warning("Unauthenticated report creation attempt")
            raise PermissionDenied("Authentication required")

        if not self.request.user.is_role('Administrator'):
            logger.warning(f"Unauthorized report creation attempt by {self.request.user.username}")
            raise PermissionDenied("Only Administrators can create reports")

        try:
            # Let the serializer handle all data validation
            report = serializer.save(
                created_by=self.request.user,
                last_modified_by=self.request.user
            )
            
            # Add metadata after creation if needed
            if report.start_date and report.end_date:
                report.metadata = {
                    'date_range': {
                        'start_date': report.start_date.isoformat(),
                        'end_date': report.end_date.isoformat(),
                        'original_request': self.request.data
                    }
                }
                report.save()

            return report

        except Exception as e:
            logger.error(f"Error in perform_create: {str(e)}")
            raise serializers.ValidationError(f"Failed to create report: {str(e)}")


    @transaction.atomic
    def perform_update(self, serializer):
        """
        Update report with role-based restrictions
        Only Administrators can update reports
        """
        try:
            # Strictly limit report updates to Administrators
            if not self.request.user.is_role('Administrator'):
                logger.warning(
                    f"Unauthorized report update attempt by user {self.request.user.username}"
                )
                raise PermissionDenied("Only Administrators can update reports")

            # Validate edit permission
            if not self.has_action_permission('change'):
                raise PermissionDenied("You lack permission to edit reports")

            report = serializer.save(
                last_modified_by=self.request.user
            )

            logger.info(f"Report updated successfully. ID: {report.id}")

        except ValidationError as e:
            logger.error(f"Error updating report: {str(e)}")
            raise DRFValidationError(str(e))
        except Exception as e:
            logger.error(f"Unexpected error updating report: {str(e)}")
            raise

    def destroy(self, request, *args, **kwargs):
        report = self.get_object()
        hard_delete = request.query_params.get('hard_delete', 'false').lower() == 'true'

        if hard_delete and request.user.is_role('Administrator'):
            report.delete()  # Hard delete
            return Response({"message": "Report permanently deleted"}, status=status.HTTP_200_OK)
    
        # Soft delete
        report.is_archived = True
        report.save()
        return Response({"message": "Report successfully archived"}, status=status.HTTP_200_OK)


    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        ReportAccessLog.objects.create(report=instance, user=request.user, action='view')
        return super().retrieve(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def generate_pdf(self, request, pk=None):
        logger.debug(f"Starting PDF generation for report {pk}")
        logger.debug(f"User: {request.user.username}")
        logger.debug(f"Query parameters: {request.query_params}")
        report = self.get_object()
        try:
            # Explicitly get the report using the queryset
            queryset = self.get_queryset()
            report = queryset.get(pk=pk)

            # Initialize date variables
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')
        
            logger.debug(f"Retrieved report: {report.id}")
            logger.debug(f"Date range: {start_date_str} to {end_date_str}")
        
            # Generate PDF with date parameters
            pdf_file = generate_pdf_report(report, start_date_str, end_date_str)
        
            # Save the generated file
            report_file = save_generated_file(report, pdf_file, 'pdf')

            # Create access log with metadata
            metadata = {}
            if start_date_str and end_date_str:
                metadata.update({
                    'date_range': {
                        'start_date': start_date_str,
                        'end_date': end_date_str
                    }
                })
        
            # Log the access
            ReportAccessLog.objects.create(
                report=report,
                user=request.user,
                action='generate_pdf',
                metadata=metadata
            )
        
            # Return the file
            return FileResponse(
                report_file.file,
                as_attachment=True,
                filename=report_file.file.name,
                content_type='application/pdf'
            )
        
        except Report.DoesNotExist:
            logger.error(f"Report {pk} not found in queryset")
            return Response({
                'error': 'Report not found',
                'details': 'The requested report does not exist or you do not have permission to access it'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"PDF generation failed: {str(e)}", exc_info=True)
            return Response({
                'error': 'PDF generation failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

    @action(detail=True, methods=['post'])
    def email_report(self, request, pk=None):
        report = self.get_object()
        recipient_email = request.data.get('email')

        if not recipient_email:
            return Response({'error': 'Recipient email is required.'}, status=400)

        try:
            start_date = request.data.get('start_date')
            end_date = request.data.get('end_date')

            # If not provided in request, fall back to report's stored dates
            if not (start_date and end_date):
                start_date = report.start_date
                end_date = report.end_date

            if not (start_date and end_date):
                return Response({
                    'error': 'Report does not have a valid date range.'
                }, status=400)

            # Convert to string format if they're date objects
            start_date_str = start_date if isinstance(start_date, str) else start_date.strftime('%Y-%m-%d')
            end_date_str = end_date if isinstance(end_date, str) else end_date.strftime('%Y-%m-%d')


            logger.info(f"Generating email report for period: {start_date_str} to {end_date_str}")

            recipient = EmailRecipient(
                email=recipient_email,
                full_name=request.data.get('recipient_name'),
                role=request.user.get_roles(),
                permissions=request.user.get_permissions()
            )

            send_enhanced_report_email(
                report,
                recipient,
                start_date_str=start_date_str,
                end_date_str=end_date_str,
                include_summary=request.data.get('include_summary', True),
                include_charts=request.data.get('include_charts', True)
            )

            return Response({'message': 'Report sent successfully.'})

        except Exception as e:
            logger.error(f"Error sending enhanced report email: {str(e)}")
            return Response(
                {'error': 'Failed to send report email. Please try again.'},
                status=500
            )


    @action(detail=True, methods=['get'])
    def export_excel(self, request, pk=None):
        report = self.get_object()
        try:
            # First check query parameters
            start_date_str = request.query_params.get('start_date')
            end_date_str = request.query_params.get('end_date')

            # If not in query params, use report's stored dates
            if not (start_date_str and end_date_str):
                start_date_str = report.start_date.strftime('%Y-%m-%d') if report.start_date else None
                end_date_str = report.end_date.strftime('%Y-%m-%d') if report.end_date else None

            # Validate and process the dates
            if start_date_str and end_date_str:
                start_date, end_date = validate_date_range(start_date_str, end_date_str)
            else:
                start_date, end_date = validate_date_range(None, None)  # Will use default 30-day range

            # Generate Excel with validated date range
            excel_file = export_report_to_excel(
                report,
                start_date_str=start_date.strftime('%Y-%m-%d'),
                end_date_str=end_date.strftime('%Y-%m-%d')
            )
            report_file = save_generated_file(report, excel_file, 'excel')

            # Read the file content
            file_content = report_file.file.read()

            # Create filename with date range
            date_range = f"_{start_date.strftime('%Y%m%d')}_to_{end_date.strftime('%Y%m%d')}"
            filename = f"{report.name}{date_range}_report.xlsx"

            response = HttpResponse(
                content=file_content,
                content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            response['Content-Length'] = len(file_content)

            # Enhanced logging with date range information
            ReportAccessLog.objects.create(
                report=report,
                user=request.user,
                action='export_excel',
                metadata={
                    'start_date': start_date.strftime('%Y-%m-%d'),
                    'end_date': end_date.strftime('%Y-%m-%d'),
                    'source': 'query_params' if request.query_params.get('start_date') else 'report_stored'
                }
            )

            return response

        except Exception as e:
            logger.error(f"Excel export failed for report {pk}: {str(e)}")
            logger.error(f"Date range attempted: {start_date_str} to {end_date_str}")
            return Response({
                'error': 'Excel export failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def export_csv(self, request, pk=None):
        report = self.get_object()
        try:
            start_date = request.query_params.get('start_date')
            end_date = request.query_params.get('end_date')

            if start_date and end_date:
                try:
                    start_date, end_date = validate_date_range(start_date, end_date)
                except ValidationError as ve:
                    return Response({
                        'error': 'Invalid date range',
                        'details': str(ve)
                    }, status=status.HTTP_400_BAD_REQUEST)

            csv_file = export_styled_report(
                report,
                start_date.strftime('%Y-%m-%d') if start_date else None,
                end_date.strftime('%Y-%m-%d') if end_date else None
            )

            report_file = save_generated_file(report, csv_file, 'csv')

            ReportAccessLog.objects.create(
                report=report,
                user=request.user,
                action='export_csv',
                metadata={
                    'date_range': {
                        'start_date': start_date.isoformat() if start_date else None,
                        'end_date': end_date.isoformat() if end_date else None
                    }
                }
            )

            return FileResponse(
                report_file.file,
                as_attachment=True,
                filename=csv_file.name,
                content_type='text/csv'
            )

        except Exception as e:
            logger.error(f"CSV export failed: {str(e)}", exc_info=True)
            return Response({
                'error': 'CSV export failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [IsAuthenticated]
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
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

class CalculatedFieldViewSet(viewsets.ModelViewSet):
    queryset = CalculatedField.objects.all()
    serializer_class = CalculatedFieldSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            self.permission_classes = [IsAuthenticated]
        else:
            self.permission_classes = [IsAuthenticated]
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
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['report', 'user', 'action']
    ordering_fields = ['accessed_at']
