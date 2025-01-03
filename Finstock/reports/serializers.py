from rest_framework import serializers
from django.core import validators
import re
from .models import Report, ReportEntry, ReportFile, CalculatedField, ReportAccessLog
import logging
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)


class ReportFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportFile
        fields = ['id', 'file', 'uploaded_at', 'uploaded_by']

class ReportEntrySerializer(serializers.ModelSerializer):
    files = ReportFileSerializer(many=True, read_only=True)

    class Meta:
        model = ReportEntry
        fields = ['id', 'title', 'content', 'created_at', 'updated_at', 'created_by', 'last_modified_by', 'files', 'order']

class CalculatedFieldSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalculatedField
        fields = ['id', 'name', 'formula', 'created_by', 'created_at']

class ReportSerializer(serializers.ModelSerializer):

    entries = ReportEntrySerializer(many=True, read_only=True)
    calculated_fields = CalculatedFieldSerializer(many=True, read_only=True)
    name = serializers.CharField(
        required=True,
        allow_blank=False,
        allow_null=False,
        trim_whitespace=True,
        max_length=255,
        min_length=3
    )
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Report
        fields = ['id', 'name', 'description', 'start_date', 'end_date', 'created_at', 'updated_at', 'created_by', 'last_modified_by', 'is_archived', 'is_template', 'schedule', 'last_run', 'entries', 'calculated_fields']
        read_only_fields = ['created_by', 'last_modified_by', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        try:
            logger.info(f"Original input data: {data}")
            
            # Handle nested name object
            if isinstance(data.get('name'), dict):
                name_data = data['name']
                processed_data = {
                    **data,
                    'name': name_data.get('name', ''),
                    'start_date': name_data.get('startDate'),
                    'end_date': name_data.get('endDate')
                }
            else:
                processed_data = data.copy()
                if not isinstance(processed_data.get('name'), str):
                    processed_data['name'] = str(processed_data.get('name', ''))

            # Trim name if necessary
            processed_data['name'] = processed_data.get('name', '').strip()[:255]

            logger.info(f"Processed data: {processed_data}")
            return super().to_internal_value(processed_data)

        except Exception as e:
            logger.error(f"Conversion error: {str(e)}")
            raise serializers.ValidationError({
                'name': f'Invalid input: {str(e)}'
            })

    def validate_name(self, value):
        # Additional name validation
        try:
            # Strip and validate name
            cleaned_name = str(value).strip()
            
            if not cleaned_name:
                raise serializers.ValidationError("Report name cannot be empty")
            
            if len(cleaned_name) > 255:
                cleaned_name = cleaned_name[:255]
            
            return cleaned_name

        except Exception as e:
            logger.error(f"Name validation error: {str(e)}")
            raise serializers.ValidationError(f"Invalid name: {str(e)}")

    def validate(self, data):
        """
        Final validation step with comprehensive checks.
        """
        try:
            # Validate name presence and content
            name = data.get('name', '').strip()
            
            if not name:
                logger.warning("Final validation detected empty name")
                raise serializers.ValidationError({
                    'name': 'A valid non-empty report name is required.'
                })

            # Additional custom validations can be added here
            logger.info(f"Final validation passed for report: {name}")
            return data

        except Exception as e:
            logger.error(f"Final validation error: {str(e)}")
            raise serializers.ValidationError({
                'name': f'Validation failed: {str(e)}'
            })

class ReportAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAccessLog
        fields = ['id', 'report', 'user', 'accessed_at', 'action']
